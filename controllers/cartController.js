const Cart = require('../models/Cart');
const { resolveItem } = require('../utils/itemResolver');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const MAX_QTY = 99;

const getOrCreate = async (userId) => (await Cart.findOne({ user: userId })) || new Cart({ user: userId, items: [] });

const present = (cart) => {
  const items = cart.items.map((i) => (i.toObject ? i.toObject() : i));
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  return { items, itemCount, subtotal, total: subtotal };
};

exports.getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  sendSuccess(res, present(cart));
});

exports.addItem = asyncHandler(async (req, res) => {
  const { itemType, itemId, quantity = 1 } = req.body;
  const cart = await getOrCreate(req.user._id);
  const existing = cart.items.find((i) => i.itemType === itemType && i.itemId === String(itemId));
  const newQty = Math.min(MAX_QTY, (existing?.quantity || 0) + (parseInt(quantity, 10) || 1));

  const snap = await resolveItem({ itemType, itemId, quantity: newQty });
  const { stock, ...clean } = snap;
  if (existing) Object.assign(existing, clean);
  else cart.items.push(clean);

  await cart.save();
  sendSuccess(res, present(cart), 'Added to cart', 201);
});

exports.updateItem = asyncHandler(async (req, res) => {
  const { itemType, itemId, quantity } = req.body;
  const cart = await getOrCreate(req.user._id);
  const item = cart.items.find((i) => i.itemType === itemType && i.itemId === String(itemId));
  if (!item) throw new AppError('Item not found in your cart', 404);

  const qty = parseInt(quantity, 10);
  if (qty <= 0) cart.items = cart.items.filter((i) => i !== item);
  else {
    const snap = await resolveItem({ itemType, itemId, quantity: qty });
    item.quantity = snap.quantity;
    item.price = snap.price; // keep price fresh
  }
  await cart.save();
  sendSuccess(res, present(cart), 'Cart updated');
});

exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  cart.items = cart.items.filter((i) => !(i.itemType === req.params.itemType && i.itemId === req.params.itemId));
  await cart.save();
  sendSuccess(res, present(cart), 'Item removed');
});

exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  cart.items = [];
  await cart.save();
  sendSuccess(res, present(cart), 'Cart cleared');
});

/** Merges a guest (localStorage) cart into the user's server cart right after login. */
exports.mergeCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  for (const raw of (req.body.items || []).slice(0, 30)) {
    try {
      const existing = cart.items.find((i) => i.itemType === raw.itemType && i.itemId === String(raw.itemId));
      const qty = Math.min(MAX_QTY, (existing?.quantity || 0) + (parseInt(raw.quantity, 10) || 1));
      const { stock, ...clean } = await resolveItem({ ...raw, quantity: qty });
      if (existing) Object.assign(existing, clean);
      else cart.items.push(clean);
    } catch { /* skip items that are no longer available */ }
  }
  await cart.save();
  sendSuccess(res, present(cart), 'Cart synced');
});
