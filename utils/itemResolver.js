const Product = require('../models/Product');
const { getGame, GAME_PRICE } = require('./rawg');
const { AppError } = require('./apiResponse');

/**
 * Turns a { itemType, itemId, quantity } reference into a trusted snapshot.
 * Prices always come from the server (DB or fixed game price) — never from the client.
 */
const resolveItem = async ({ itemType, itemId, quantity = 1 }) => {
  const qty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));

  if (itemType === 'product') {
    if (!/^[a-f\d]{24}$/i.test(String(itemId))) throw new AppError('Invalid product', 400);
    const p = await Product.findById(itemId);
    if (!p || !p.isActive) throw new AppError('This product is no longer available', 404);
    if (p.stock < qty) throw new AppError(`Only ${p.stock} unit(s) of "${p.title}" in stock`, 409);
    return {
      itemType: 'product',
      itemId: String(p._id),
      product: p._id,
      name: p.title,
      image: p.images?.[0]?.url || '',
      price: p.price,
      quantity: qty,
      stock: p.stock,
    };
  }

  if (itemType === 'game') {
    let g;
    try {
      g = await getGame(itemId);
    } catch (e) {
      throw new AppError('This game could not be found', 404);
    }
    return { itemType: 'game', itemId: String(g.id), name: g.name, image: g.image || '', price: GAME_PRICE(), quantity: qty };
  }

  throw new AppError('Invalid item type', 400);
};

module.exports = { resolveItem };
