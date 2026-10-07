const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { resolveItem } = require('../utils/itemResolver');
const { sendOrderWhatsApp } = require('../utils/whatsappMessage');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const DELIVERY_MSG = 'Please complete your delivery information before placing your order.';

/** Atomically reserves stock for product lines; rolls back everything if any line fails. */
const reserveStock = async (lines) => {
  const done = [];
  try {
    for (const l of lines.filter((x) => x.itemType === 'product')) {
      const r = await Product.updateOne({ _id: l.product, stock: { $gte: l.quantity } }, { $inc: { stock: -l.quantity } });
      if (!r.modifiedCount) throw new AppError(`"${l.name}" just went out of stock`, 409);
      done.push(l);
    }
  } catch (err) {
    await Promise.all(done.map((l) => Product.updateOne({ _id: l.product }, { $inc: { stock: l.quantity } })));
    throw err;
  }
};

const restock = (order) =>
  Promise.all(order.items.filter((i) => i.itemType === 'product' && i.product).map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })));

exports.createOrder = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { source = 'cart', items: directItems, shipping = {} } = req.body;

  // 1. Delivery information (use what is saved, allow overriding / completing it)
  const customer = {
    name: (shipping.fullName || user.name || '').trim(),
    email: user.email,
    phone: (shipping.phone || user.phone || '').trim(),
    address: (shipping.address || user.address || '').trim(),
    city: (shipping.city || user.city || '').trim(),
  };
  if (!customer.name || !customer.phone || !customer.address || !customer.city) throw new AppError(DELIVERY_MSG, 422);

  // 2. Resolve items with trusted prices
  let refs;
  let cart;
  if (source === 'direct') {
    if (!Array.isArray(directItems) || !directItems.length) throw new AppError('No items to order', 400);
    refs = directItems.slice(0, 20);
  } else {
    cart = await Cart.findOne({ user: user._id });
    if (!cart?.items.length) throw new AppError('Your cart is empty', 400);
    refs = cart.items.map((i) => ({ itemType: i.itemType, itemId: i.itemId, quantity: i.quantity }));
  }
  const lines = await Promise.all(refs.map(resolveItem));
  await reserveStock(lines);

  const orderItems = lines.map(({ stock, ...l }) => l);
  const subtotal = orderItems.reduce((n, i) => n + i.price * i.quantity, 0);

  let order;
  try {
    order = await Order.create({
      user: user._id,
      customer,
      items: orderItems,
      subtotal,
      shippingFee: 0,
      total: subtotal,
      statusHistory: [{ status: 'Pending' }],
    });
  } catch (err) {
    await Promise.all(lines.filter((l) => l.itemType === 'product').map((l) => Product.updateOne({ _id: l.product }, { $inc: { stock: l.quantity } })));
    throw err;
  }

  // 3. Save delivery info to the profile where it was missing, clear cart
  ['phone', 'address', 'city'].forEach((f) => { if (!user[f]) user[f] = customer[f]; });
  await user.save({ validateBeforeSave: false });
  if (cart) { cart.items = []; await cart.save(); }

  // 4. WhatsApp notification (non-blocking; a failure never fails the order)
  sendOrderWhatsApp(order).then((ok) => ok && Order.updateOne({ _id: order._id }, { whatsappNotified: true }).exec());

  sendSuccess(res, { order }, 'Order placed successfully', 201);
});

exports.getMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, parseInt(req.query.limit, 10) || 10);
  const [orders, total] = await Promise.all([
    Order.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments({ user: req.user._id }),
  ]);
  sendSuccess(res, { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.getMyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderId: id.toUpperCase() };
  const order = await Order.findOne({ ...query, user: req.user._id }).lean();
  if (!order) throw new AppError('Order not found', 404);
  sendSuccess(res, { order });
});

exports.cancelMyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderId: id.toUpperCase() };
  const order = await Order.findOne({ ...query, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== 'Pending') throw new AppError('Only pending orders can be cancelled', 409);
  order.status = 'Cancelled';
  order.statusHistory.push({ status: 'Cancelled' });
  await order.save();
  await restock(order);
  sendSuccess(res, { order }, 'Order cancelled');
});

exports.restock = restock;
