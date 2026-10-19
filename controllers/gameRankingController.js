const mongoose = require('mongoose');
const Game = require('../models/Game');
const { RANK_LISTS, pinOf, effectiveSort } = require('../utils/ranking');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const MAX_POSITION = 2000;

const listOf = (req) => {
  const list = RANK_LISTS[req.params.list];
  if (!list) throw new AppError('Unknown list. Use hero, popular or all', 404);
  return list;
};
const query = (list) => ({ isActive: true, ...list.base }); // hidden games are never shown, so they are never ranked

/** The list exactly as visitors see it, with each game's position. */
exports.list = asyncHandler(async (req, res) => {
  const list = listOf(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const q = query(list);
  const [docs, total, pinned] = await Promise.all([
    Game.find(q).sort(effectiveSort(list)).skip((page - 1) * limit).limit(limit).select(`name image rawgId isCustom ${list.field}`).lean(),
    Game.countDocuments(q),
    Game.countDocuments({ ...q, [list.field]: { $ne: null } }),
  ]);
  const games = docs.map((g, i) => ({ _id: g._id, id: g.rawgId, name: g.name, image: g.image || null, isCustom: !!g.isCustom, position: (page - 1) * limit + i + 1, pinned: g[list.field] != null }));
  sendSuccess(res, { games, pinned, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

/**
 * Put a game at an exact position. Everything above it is pinned in its current order first,
 * so no other game jumps around, and the games it pushes down move by one.
 */
exports.move = asyncHandler(async (req, res) => {
  const list = listOf(req);
  const position = Number(req.body.position);
  if (!Number.isInteger(position) || position < 1 || position > MAX_POSITION) throw new AppError(`Position must be a whole number from 1 to ${MAX_POSITION}`, 422);
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Game not found', 404);

  const q = query(list);
  const game = await Game.findOne({ _id: req.params.id, ...q }).select(list.field).lean();
  if (!game) throw new AppError('This game is not in this list (it may be hidden or switched off)', 404);

  const [total, pinned] = await Promise.all([Game.countDocuments(q), Game.countDocuments({ ...q, [list.field]: { $ne: null } })]);
  const target = Math.min(position, total);
  const self = String(game._id);
  const keep = Math.max(target - 1, pinned - (game[list.field] != null ? 1 : 0)); // the other games that must hold a pin

  const others = (await Game.find(q).sort(effectiveSort(list)).limit(keep + 1).select('_id').lean())
    .map((d) => String(d._id)).filter((id) => id !== self).slice(0, keep);
  others.splice(target - 1, 0, self);

  await Game.bulkWrite(others.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { [list.field]: pinOf(i + 1) } } } })));
  sendSuccess(res, { position: target }, `Moved to position ${target}`);
});

/** Take one game out of the manual order: it goes back to the default order. */
exports.unpin = asyncHandler(async (req, res) => {
  const list = listOf(req);
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Game not found', 404);
  await Game.updateOne({ _id: req.params.id }, { $set: { [list.field]: null } });
  sendSuccess(res, {}, 'Back to the default order');
});

/** Clear the whole manual order of a list. */
exports.reset = asyncHandler(async (req, res) => {
  const list = listOf(req);
  const r = await Game.updateMany({ [list.field]: { $ne: null } }, { $set: { [list.field]: null } });
  sendSuccess(res, { cleared: r.modifiedCount }, 'The list is back to its default order');
});
