const Game = require('../models/Game');
const { listGames, getGame: getRawgGame } = require('../utils/rawg');
const { normKey, pickBest, mapLimit } = require('../utils/gameMatch');
const { slugify } = require('./gameController');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBool = (v) => v === true || v === 'true';
const HERO_MAX = 3;

/** '' / null -> null (use the default price), otherwise a whole number >= 1. */
const parsePrice = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 10000000) throw new AppError('Enter a price of 1 PKR or more (leave it empty for the default price)', 422);
  return Math.round(n);
};

/** Fields copied from a catalogue result into the store. */
const snapshot = (g) => ({
  rawgId: g.id, name: g.name, slug: g.slug, image: g.image || '', rating: g.rating, ratingsCount: g.ratingsCount,
  metacritic: g.metacritic, released: g.released || '', platforms: ['PC'], genres: g.genres,
  genreSlugs: (g.genres || []).map(slugify), nameKey: normKey(g.name),
});

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
    return { ...g, added: Boolean(s), storeId: s?._id || null, price: s?.price ?? null, isHero: Boolean(s?.isHero), isPopular: Boolean(s?.isPopular), isLatest: Boolean(s?.isLatest), isActive: s ? s.isActive : true };
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
  if (filter === 'hero') q.isHero = true;

  const [games, total, counts] = await Promise.all([
    Game.find(q).sort(filter === 'hero' ? { heroAt: 1 } : { createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Game.countDocuments(q),
    Game.aggregate([{ $group: { _id: null, all: { $sum: 1 }, popular: { $sum: { $cond: ['$isPopular', 1, 0] } }, latest: { $sum: { $cond: ['$isLatest', 1, 0] } }, hero: { $sum: { $cond: ['$isHero', 1, 0] } }, hidden: { $sum: { $cond: ['$isActive', 0, 1] } } } }]),
  ]);
  sendSuccess(res, {
    games,
    counts: counts[0] || { all: 0, popular: 0, latest: 0, hero: 0, hidden: 0 },
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

  const price = parsePrice(req.body.price);
  const wantsHero = toBool(req.body.isHero);
  if (wantsHero && (await Game.countDocuments({ isHero: true })) >= HERO_MAX) throw new AppError(`The home banner already has ${HERO_MAX} games. Turn one off first.`, 409);

  const game = await Game.create({
    ...snapshot(g), price,
    isPopular: toBool(req.body.isPopular), isLatest: toBool(req.body.isLatest),
    isHero: wantsHero, heroAt: wantsHero ? new Date() : null, isActive: true,
  });
  sendSuccess(res, { game }, 'Game added to the store', 201);
});

/** Update price and the Popular / Latest / Hero / Visible switches. */
exports.updateGame = asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) throw new AppError('Game not found', 404);

  if (req.body.price !== undefined) game.price = parsePrice(req.body.price);

  if (req.body.isHero !== undefined) {
    const on = toBool(req.body.isHero);
    if (on && !game.isHero) {
      const taken = await Game.countDocuments({ isHero: true, _id: { $ne: game._id } });
      if (taken >= HERO_MAX) throw new AppError(`The home banner already has ${HERO_MAX} games. Turn one off first.`, 409);
      game.heroAt = new Date();
    }
    if (!on) game.heroAt = null;
    game.isHero = on;
  }

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

/**
 * Bulk import. The browser reads the uploaded .txt file (one game title per line) and sends the
 * titles in small batches (max 12). For each title we skip games already in the store, otherwise
 * search the catalogue (PC), accept only a close match, and add it with the default price.
 */
const importOne = async (rawName) => {
  const name = String(rawName).replace(/\s+/g, ' ').trim().slice(0, 120);
  const key = normKey(name);
  if (!key) return { name, status: 'skipped' };

  const known = await Game.findOne({ $or: [{ nameKey: key }, { aliasKeys: key }] }).select('name').lean();
  if (known) return { name, status: 'exists', match: known.name };

  let results;
  try {
    ({ results } = await listGames({ search: name, pageSize: 8, precise: false, timeout: 7000 }));
  } catch {
    return { name, status: 'error', message: 'The games catalogue did not respond' };
  }

  const best = pickBest(name, results);
  if (!best) return { name, status: 'not_found', suggestion: results[0]?.name || '' };

  const dup = await Game.findOne({ rawgId: best.id }).select('name').lean();
  if (dup) {
    await Game.updateOne({ rawgId: best.id }, { $addToSet: { aliasKeys: key } });
    return { name, status: 'exists', match: dup.name };
  }
  try {
    await Game.create({ ...snapshot(best), aliasKeys: [key], isActive: true });
  } catch (err) {
    if (err.code === 11000) return { name, status: 'exists', match: best.name }; // added by a parallel request
    return { name, status: 'error', message: 'Could not save this game' };
  }
  return { name, status: 'added', match: best.name };
};

exports.importGames = asyncHandler(async (req, res) => {
  const names = Array.isArray(req.body.names) ? req.body.names : [];
  const list = [...new Set(names.map((n) => String(n).replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 12);
  if (!list.length) throw new AppError('No game names received', 400);
  const results = await mapLimit(list, 5, importOne);
  sendSuccess(res, { results });
});
