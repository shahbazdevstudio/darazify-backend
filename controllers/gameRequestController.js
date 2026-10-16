const GameRequest = require('../models/GameRequest');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
const STATUSES = GameRequest.schema.path('status').enumValues;

/** Public: anyone can ask for a game. */
exports.create = asyncHandler(async (req, res) => {
  if (req.body.website) return sendSuccess(res, {}, 'Request received', 201); // honeypot: bots fill this hidden field

  const gameName = clean(req.body.gameName, 120);
  const contact = clean(req.body.contact, 100);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
  const isPhone = contact.replace(/\D/g, '').length >= 7 && /^[+\d\s()-]+$/.test(contact);
  if (gameName.length < 2) throw new AppError('Enter the name of the game', 422);
  if (!isEmail && !isPhone) throw new AppError('Enter a valid email or phone / WhatsApp number so we can reach you', 422);

  // The same person asking twice for the same game is stored once
  const dup = await GameRequest.findOne({ status: 'new', contact, gameName: new RegExp(`^${escapeRegex(gameName)}$`, 'i') }).select('_id').lean();
  if (!dup) await GameRequest.create({ gameName, contact, name: clean(req.body.name, 60), note: clean(req.body.note, 500) });
  sendSuccess(res, {}, 'Thanks! We received your request', 201);
});

/** Admin */
exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const q = {};
  if (STATUSES.includes(req.query.status)) q.status = req.query.status;
  if (req.query.search) q.gameName = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');

  const [requests, total, grouped] = await Promise.all([
    GameRequest.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    GameRequest.countDocuments(q),
    GameRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const counts = { all: 0, new: 0, added: 0, rejected: 0 };
  grouped.forEach((g) => { counts[g._id] = g.n; counts.all += g.n; });
  sendSuccess(res, { requests, counts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.setStatus = asyncHandler(async (req, res) => {
  if (!STATUSES.includes(req.body.status)) throw new AppError(`Status must be one of: ${STATUSES.join(', ')}`, 422);
  const r = await GameRequest.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!r) throw new AppError('Request not found', 404);
  sendSuccess(res, { request: r }, 'Request updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await GameRequest.findByIdAndDelete(req.params.id);
  if (!r) throw new AppError('Request not found', 404);
  sendSuccess(res, {}, 'Request deleted');
});
