const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Game = require('../models/Game');
const Software = require('../models/Software');
const { STATUSES } = require('../models/Order');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const { restock } = require('./orderController');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const paging = (q, def = 10) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || def));
  return { page, limit, skip: (page - 1) * limit };
};

/* ------------------------------ Dashboard ------------------------------ */
exports.getStats = asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [totalUsers, blockedUsers, totalProducts, totalSoftware, totalGames, totalOrders, byStatus, revenueAgg, daily, recentOrders, lowStock] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'user', isBlocked: true }),
    Product.countDocuments(),
    Software.countDocuments(),
    Game.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: { $ne: 'Cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'Cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
    Order.find().sort({ createdAt: -1 }).limit(6).lean(),
    Product.find({ stock: { $lte: 5 }, isActive: true }).sort({ stock: 1 }).limit(5).select('title stock images').lean(),
  ]);

  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  byStatus.forEach((s) => { statusCounts[s._id] = s.count; });

  // Fill days with no orders so the chart has a continuous axis
  const map = Object.fromEntries(daily.map((d) => [d._id, d]));
  const series = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, revenue: map[key]?.revenue || 0, orders: map[key]?.orders || 0 });
  }

  sendSuccess(res, {
    totalUsers, blockedUsers, totalProducts, totalSoftware, totalGames, totalOrders, statusCounts,
    revenue: revenueAgg[0]?.total || 0,
    daily: series, recentOrders, lowStock,
  });
});

/* -------------------------------- Users -------------------------------- */
exports.getUsers = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const { page, limit, skip } = paging(req.query);
  const filter = { role: 'user' };
  if (search) {
    const rx = new RegExp(escapeRegex(String(search).slice(0, 60)), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (status === 'blocked') filter.isBlocked = true;
  if (status === 'active') filter.isBlocked = false;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Order.aggregate([{ $match: { user: { $in: users.map((u) => u._id) } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  users.forEach((u) => { u.orderCount = countMap[String(u._id)] || 0; delete u.password; });

  sendSuccess(res, { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

const findCustomer = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Admin accounts cannot be modified here', 403);
  return user;
};

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 }).lean();
  const totalSpent = orders.filter((o) => o.status !== 'Cancelled').reduce((n, o) => n + o.total, 0);
  sendSuccess(res, { user, orders, totalSpent });
});

exports.getUserOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.params.id }).sort({ createdAt: -1 }).lean();
  sendSuccess(res, { orders });
});

const setBlocked = (blocked) =>
  asyncHandler(async (req, res) => {
    const user = await findCustomer(req.params.id);
    user.isBlocked = blocked;
    await user.save({ validateBeforeSave: false });
    sendSuccess(res, { user }, blocked ? 'User blocked' : 'User unblocked');
  });
exports.blockUser = setBlocked(true);
exports.unblockUser = setBlocked(false);

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await findCustomer(req.params.id);
  await Cart.deleteOne({ user: user._id });
  await user.deleteOne(); // orders are kept (they hold their own customer snapshot)
  sendSuccess(res, {}, 'User deleted');
});

/* ------------------------------- Orders -------------------------------- */
exports.getOrders = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const { page, limit, skip } = paging(req.query);
  const filter = {};
  if (status && STATUSES.includes(status)) filter.status = status;
  if (search) {
    const rx = new RegExp(escapeRegex(String(search).slice(0, 60)), 'i');
    filter.$or = [{ orderId: rx }, { 'customer.name': rx }, { 'customer.email': rx }, { 'customer.phone': rx }];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  sendSuccess(res, { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const order = await Order.findOne(/^[a-f\d]{24}$/i.test(id) ? { _id: id } : { orderId: id.toUpperCase() }).populate('user', 'name email phone isBlocked').lean();
  if (!order) throw new AppError('Order not found', 404);
  sendSuccess(res, { order });
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status === status) return sendSuccess(res, { order }, 'Status unchanged');
  if (order.status === 'Cancelled') throw new AppError('A cancelled order cannot be reopened', 409);

  if (status === 'Cancelled') await restock(order);
  order.status = status;
  order.statusHistory.push({ status });
  await order.save();
  sendSuccess(res, { order }, `Order marked as ${status}`);
});
