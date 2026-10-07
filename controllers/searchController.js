const Product = require('../models/Product');
const { listGames } = require('../utils/rawg');
const { asyncHandler, sendSuccess } = require('../utils/apiResponse');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Global search used by the navbar suggestions (games + leather products). */
exports.suggest = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return sendSuccess(res, { games: [], products: [] });

  const rx = new RegExp(escapeRegex(q), 'i');
  const [games, products] = await Promise.allSettled([
    listGames({ search: q, pageSize: 5 }),
    Product.find({ isActive: true, $or: [{ title: rx }, { category: rx }] }).select('title price images category slug').limit(5).lean(),
  ]);

  sendSuccess(res, {
    games: games.status === 'fulfilled' ? games.value.results : [],
    products: products.status === 'fulfilled' ? products.value : [],
  });
});
