const Product = require('../models/Product');
const Software = require('../models/Software');
const Game = require('../models/Game');
const { GAME_PRICE } = require('./rawg');
const { AppError } = require('./apiResponse');

const MODELS = { product: Product, software: Software };
const LABEL = { product: 'product', software: 'software' };

/**
 * Turns a { itemType, itemId, quantity } reference into a trusted snapshot.
 * Prices always come from the server (DB or fixed game price) — never from the client.
 *   product  -> leather product (collection: products)
 *   software -> software        (collection: software)
 *   game     -> only games the admin added to the store
 */
const resolveItem = async ({ itemType, itemId, quantity = 1 }) => {
  const qty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));

  if (MODELS[itemType]) {
    if (!/^[a-f\d]{24}$/i.test(String(itemId))) throw new AppError(`Invalid ${LABEL[itemType]}`, 400);
    const p = await MODELS[itemType].findById(itemId);
    if (!p || !p.isActive) throw new AppError(`This ${LABEL[itemType]} is no longer available`, 404);
    if (p.stock < qty) throw new AppError(`Only ${p.stock} unit(s) of "${p.title}" available`, 409);
    return {
      itemType,
      itemId: String(p._id),
      [itemType]: p._id, // product: ObjectId  |  software: ObjectId
      name: p.title,
      image: p.images?.[0]?.url || '',
      price: p.price,
      quantity: qty,
      stock: p.stock,
    };
  }

  if (itemType === 'game') {
    const g = await Game.findOne({ rawgId: String(itemId), isActive: true });
    if (!g) throw new AppError('This game is no longer available', 404);
    return { itemType: 'game', itemId: g.rawgId, name: g.name, image: g.image || '', price: GAME_PRICE(), quantity: qty };
  }

  throw new AppError('Invalid item type', 400);
};

module.exports = { resolveItem, MODELS };
