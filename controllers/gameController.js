const Game = require('../models/Game');
const Series = require('../models/Series');
const { getGame: getRawgGame, getScreenshots, GAME_PRICE } = require('../utils/rawg');
const SHOT_TIMEOUT = 4000;
const { pcOnly } = require('../utils/gameMatch');
const { RANK_LISTS, effectiveSort } = require('../utils/ranking');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Public shape used by the website (same fields the frontend always had). */
const toPublic = (g) => ({
  id: g.rawgId,
  name: g.name,
  slug: g.slug,
  image: g.image || null,
  image2: (g.screenshots && g.screenshots[0]) || null, // shown when hovering the card
  rating: g.rating || 0,
  ratingsCount: g.ratingsCount || 0,
  metacritic: g.metacritic || null,
  released: g.released || null,
  platforms: pcOnly(g.platforms), // PC only (no Xbox / PlayStation ...)
  genres: g.genres || [],
  price: g.price ?? GAME_PRICE(), // the price the admin set for this game, otherwise the default
});

const SORTS = {
  '-added': { ratingsCount: -1, createdAt: -1 },
  '-rating': { rating: -1, ratingsCount: -1 },
  '-released': { released: -1, createdAt: -1 },
  name: { name: 1 },
};

/** Lists ONLY the games the admin added to the store. */
exports.getGames = asyncHandler(async (req, res) => {
  const { search, genres, type, ordering } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(40, Math.max(1, parseInt(req.query.pageSize, 10) || 16));

  const filter = { isActive: true };
  if (type === 'latest') filter.isLatest = true;
  if (type === 'popular') filter.isPopular = true;
  if (type === 'hero') filter.isHero = true; // the (max 3) games chosen for the home page banner
  if (search) filter.name = new RegExp(escapeRegex(String(search).slice(0, 80)), 'i');
  if (genres) filter.genreSlugs = String(genres);
  if (req.query.series) {
    const s = await Series.findOne({ slug: String(req.query.series), isActive: true }).select('_id').lean();
    filter.series = s ? s._id : null; // unknown series -> no games
    if (!s) filter._id = null;
  }

  // A sort the visitor picked wins. Otherwise: the admin's manual ranking first, then the default order.
  let sort = SORTS[ordering] && { ...SORTS[ordering], _id: 1 };
  if (!sort) sort = type === 'latest' ? { ...SORTS['-released'], _id: 1 } : effectiveSort(RANK_LISTS[type] || RANK_LISTS.all);

  const [docs, total] = await Promise.all([
    Game.find(filter).sort(sort).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Game.countDocuments(filter),
  ]);

  // Older games were saved without screenshots: fetch them once (hover image) and store them.
  const missing = docs.filter((d) => !d.isCustom && !d.screenshotsFetched);
  if (missing.length) {
    await Promise.race([
      Promise.allSettled(missing.map(async (d) => {
        const shots = await getScreenshots(d.rawgId);
        d.screenshots = shots.slice(0, 4);
        d.screenshotsFetched = true;
        await Game.updateOne({ _id: d._id }, { $set: { screenshots: d.screenshots, screenshotsFetched: true } });
      })),
      new Promise((resolve) => setTimeout(resolve, SHOT_TIMEOUT)),
    ]);
  }

  sendSuccess(res, {
    games: docs.map(toPublic),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

/** Game details: stored snapshot, enriched live from RAWG (description, screenshots) when available. */
exports.getGame = asyncHandler(async (req, res) => {
  const stored = await Game.findOne({ rawgId: String(req.params.id), isActive: true }).lean();
  if (!stored) throw new AppError('Game not found', 404);

  const game = toPublic(stored);
  if (stored.isCustom) { // custom games carry all their details; nothing to fetch from RAWG
    Object.assign(game, {
      description: stored.description, developers: stored.developers || [], publishers: stored.publishers || [],
      esrb: stored.esrb || null, screenshots: stored.screenshots || [],
    });
    return sendSuccess(res, { game });
  }
  const [detail, shots] = await Promise.allSettled([getRawgGame(stored.rawgId), getScreenshots(stored.rawgId)]);
  if (detail.status === 'fulfilled') {
    const d = detail.value;
    Object.assign(game, {
      description: d.description, website: d.website, developers: d.developers, publishers: d.publishers,
      esrb: d.esrb, tags: d.tags, rating: d.rating || game.rating, ratingsCount: d.ratingsCount || game.ratingsCount,
      metacritic: d.metacritic || game.metacritic,
    });
  }
  game.screenshots = shots.status === 'fulfilled' ? shots.value : [];
  sendSuccess(res, { game });
});

/** Genres that exist among the games in the store. */
exports.getGenres = asyncHandler(async (_req, res) => {
  const rows = await Game.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$genres' },
    { $group: { _id: '$genres', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  sendSuccess(res, { genres: rows.map((r, i) => ({ id: i + 1, name: r._id, slug: slugify(r._id), count: r.count })) });
});

exports.slugify = slugify;
exports.toPublic = toPublic;
