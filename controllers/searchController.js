const Product = require('../models/Product');
const Software = require('../models/Software');
const Game = require('../models/Game');
const { toPublic } = require('./gameController');
const { asyncHandler, sendSuccess } = require('../utils/apiResponse');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Global search used by the navbar suggestions: games in the store, leather products and software. */
exports.suggest = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return sendSuccess(res, { games: [], products: [], software: [] });

  const rx = new RegExp(escapeRegex(q), 'i');
  const find = (Model) =>
    Model.find({ isActive: true, $or: [{ title: rx }, { category: rx }] }).select('title price images category slug').limit(5).lean();

  const [games, products, software] = await Promise.allSettled([
    Game.find({ isActive: true, name: rx }).sort({ ratingsCount: -1 }).limit(5).lean(),
    find(Product),
    find(Software),
  ]);

  sendSuccess(res, {
    games: games.status === 'fulfilled' ? games.value.map(toPublic) : [],
    products: products.status === 'fulfilled' ? products.value : [],
    software: software.status === 'fulfilled' ? software.value : [],
  });
});
