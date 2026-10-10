const Game = require('../models/Game');
const { listGames, getGame: getRawgGame } = require('../utils/rawg');
const { slugify } = require('./gameController');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBool = (v) => v === true || v === 'true';

/** Search the RAWG catalogue so the admin can pick a game (marks the ones already in the store). */
exports.searchCatalogue = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return sendSuccess(res, { games: [] });

  let results;
  try {
    ({ results } = await listGames({ search: q, pageSize: 8 }));
  } catch {
    throw new AppError('The games catalogue is not reachable right now. Try again in a moment.', 502);
  }
  const existing = await Game.find({ rawgId: { $in: results.map((g) => g.id) } }).select('rawgId').lean();
  const have = new Set(existing.map((g) => g.rawgId));
  sendSuccess(res, { games: results.map((g) => ({ ...g, added: have.has(g.id) })) });
});

/**
 * Browse the WHOLE games catalogue (paginated). Each game shows whether it is already in the store
 * and, if so, its Popular / Latest / Visible state, so the admin can choose what appears on the website.
 */
const ORDERINGS = ['-added', '-rating', '-released', 'name'];
exports.browseCatalogue = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(40, Math.max(8, parseInt(req.query.pageSize, 10) || 24));
  const search = String(req.query.search || '').trim().slice(0, 80) || undefined;
  const ordering = ORDERINGS.includes(req.query.ordering) ? req.query.ordering : '-added';

  let data;
  try {
    data = await listGames({ page, pageSize, search, ordering });
  } catch {
    throw new AppError('The games catalogue is not reachable right now. Try again in a moment.', 502);
  }
  const stored = await Game.find({ rawgId: { $in: data.results.map((g) => g.id) } }).lean();
  const byRawg = new Map(stored.map((s) => [s.rawgId, s]));

  const games = data.results.map((g) => {
    const s = byRawg.get(g.id);
    return { ...g, added: Boolean(s), storeId: s?._id || null, isPopular: Boolean(s?.isPopular), isLatest: Boolean(s?.isLatest), isActive: s ? s.isActive : true };
  });
  sendSuccess(res, { games, pagination: { page, pageSize, total: data.count, totalPages: Math.min(100, Math.ceil(data.count / pageSize)) } });
});

/** Games already in the store (including hidden ones). */
exports.listStoreGames = asyncHandler(async (req, res) => {
  const { search, filter } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const q = {};
  if (search) q.name = new RegExp(escapeRegex(String(search).slice(0, 80)), 'i');
  if (filter === 'popular') q.isPopular = true;
  if (filter === 'latest') q.isLatest = true;
  if (filter === 'hidden') q.isActive = false;

  const [games, total, counts] = await Promise.all([
    Game.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Game.countDocuments(q),
    Game.aggregate([{ $group: { _id: null, all: { $sum: 1 }, popular: { $sum: { $cond: ['$isPopular', 1, 0] } }, latest: { $sum: { $cond: ['$isLatest', 1, 0] } }, hidden: { $sum: { $cond: ['$isActive', 0, 1] } } } }]),
  ]);
  sendSuccess(res, {
    games,
    counts: counts[0] || { all: 0, popular: 0, latest: 0, hidden: 0 },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** Adds a game picked from the catalogue to the store. */
exports.addGame = asyncHandler(async (req, res) => {
  const rawgId = String(req.body.rawgId || '').trim();
  if (!/^\d+$/.test(rawgId)) throw new AppError('Choose a game from the suggestions first', 400);
  if (await Game.findOne({ rawgId })) throw new AppError('This game is already in your store', 409);

  let g;
  try {
    g = await getRawgGame(rawgId);
  } catch (err) {
    throw new AppError(err.statusCode === 404 ? 'That game was not found in the catalogue' : 'The games catalogue is not reachable right now', err.statusCode === 404 ? 404 : 502);
  }

  const game = await Game.create({
    rawgId: g.id, name: g.name, slug: g.slug, image: g.image || '', rating: g.rating, ratingsCount: g.ratingsCount,
    metacritic: g.metacritic, released: g.released || '', platforms: g.platforms, genres: g.genres,
    genreSlugs: (g.genres || []).map(slugify),
    isPopular: toBool(req.body.isPopular), isLatest: toBool(req.body.isLatest), isActive: true,
  });
  sendSuccess(res, { game }, 'Game added to the store', 201);
});

/** Toggle Popular / Latest / Visible. */
exports.updateGame = asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) throw new AppError('Game not found', 404);
  ['isPopular', 'isLatest', 'isActive'].forEach((k) => { if (req.body[k] !== undefined) game[k] = toBool(req.body[k]); });
  await game.save();
  sendSuccess(res, { game }, 'Game updated');
});

exports.deleteGame = asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) throw new AppError('Game not found', 404);
  await game.deleteOne();
  sendSuccess(res, {}, 'Game removed from the store');
});
