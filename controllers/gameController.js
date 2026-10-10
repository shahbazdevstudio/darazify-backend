const Game = require('../models/Game');
const { getGame: getRawgGame, getScreenshots, GAME_PRICE } = require('../utils/rawg');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const MAX_PAGES = 100;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Public shape used by the website (same fields the frontend always had). */
const toPublic = (g) => ({
  id: g.rawgId,
  name: g.name,
  slug: g.slug,
  image: g.image || null,
  rating: g.rating || 0,
  ratingsCount: g.ratingsCount || 0,
  metacritic: g.metacritic || null,
  released: g.released || null,
  platforms: g.platforms || [],
  genres: g.genres || [],
  price: GAME_PRICE(),
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
  if (search) filter.name = new RegExp(escapeRegex(String(search).slice(0, 80)), 'i');
  if (genres) filter.genreSlugs = String(genres);

  let sort = SORTS[ordering];
  if (!sort) sort = type === 'latest' ? SORTS['-released'] : type === 'popular' ? SORTS['-added'] : { createdAt: -1 };

  const [docs, total] = await Promise.all([
    Game.find(filter).sort(sort).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Game.countDocuments(filter),
  ]);

  sendSuccess(res, {
    games: docs.map(toPublic),
    pagination: { page, pageSize, total, totalPages: Math.min(MAX_PAGES, Math.ceil(total / pageSize)) },
  });
});

/** Game details: stored snapshot, enriched live from RAWG (description, screenshots) when available. */
exports.getGame = asyncHandler(async (req, res) => {
  const stored = await Game.findOne({ rawgId: String(req.params.id), isActive: true }).lean();
  if (!stored) throw new AppError('Game not found', 404);

  const game = toPublic(stored);
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
