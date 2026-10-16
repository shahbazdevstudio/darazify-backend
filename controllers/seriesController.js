const Series = require('../models/Series');
const Game = require('../models/Game');
const { uploadBuffer, deleteImage } = require('../config/cloudinary');
const { slugify } = require('./gameController');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const uniqueSlug = async (name, selfId) => {
  const base = slugify(name) || 'series';
  let slug = base;
  for (let n = 2; await Series.exists({ slug, _id: { $ne: selfId } }); n += 1) slug = `${base}-${n}`;
  return slug;
};

const countGames = async (match = {}) => {
  const rows = await Game.aggregate([{ $match: { series: { $ne: null }, ...match } }, { $group: { _id: '$series', n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
};

const cleanName = (v) => {
  const name = String(v || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 60) throw new AppError('Series name must be 2 to 60 characters', 422);
  return name;
};

/* ------------------------------- Public ------------------------------- */
exports.listPublic = asyncHandler(async (_req, res) => {
  const [list, counts] = await Promise.all([Series.find({ isActive: true }).sort({ createdAt: 1 }).lean(), countGames({ isActive: true })]);
  const series = list.filter((s) => counts.get(String(s._id))).map((s) => ({ id: s._id, name: s.name, slug: s.slug, image: s.image.url, count: counts.get(String(s._id)) }));
  sendSuccess(res, { series });
});

exports.getPublic = asyncHandler(async (req, res) => {
  const s = await Series.findOne({ slug: String(req.params.slug), isActive: true }).lean();
  if (!s) throw new AppError('Series not found', 404);
  sendSuccess(res, { series: { id: s._id, name: s.name, slug: s.slug, image: s.image.url } });
});

/* -------------------------------- Admin -------------------------------- */
exports.listAdmin = asyncHandler(async (_req, res) => {
  const [list, counts] = await Promise.all([Series.find().sort({ createdAt: 1 }).lean(), countGames()]);
  sendSuccess(res, { series: list.map((s) => ({ ...s, count: counts.get(String(s._id)) || 0 })) });
});

exports.create = asyncHandler(async (req, res) => {
  const name = cleanName(req.body.name);
  if (!req.file) throw new AppError('Upload a PNG logo for the series', 422);
  const img = await uploadBuffer(req.file.buffer, 'darazify/series');
  const series = await Series.create({ name, slug: await uniqueSlug(name), image: { url: img.url, publicId: img.publicId } });
  sendSuccess(res, { series }, 'Series created', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const s = await Series.findById(req.params.id);
  if (!s) throw new AppError('Series not found', 404);
  if (req.body.name !== undefined && cleanName(req.body.name) !== s.name) { s.name = cleanName(req.body.name); s.slug = await uniqueSlug(s.name, s._id); }
  if (req.body.isActive !== undefined) s.isActive = req.body.isActive === true || req.body.isActive === 'true';
  if (req.file) {
    const old = s.image.publicId;
    const img = await uploadBuffer(req.file.buffer, 'darazify/series');
    s.image = { url: img.url, publicId: img.publicId };
    if (old) deleteImage(old);
  }
  await s.save();
  sendSuccess(res, { series: s }, 'Series updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const s = await Series.findById(req.params.id);
  if (!s) throw new AppError('Series not found', 404);
  await Game.updateMany({ series: s._id }, { $set: { series: null } }); // the games stay in the store
  if (s.image.publicId) deleteImage(s.image.publicId);
  await s.deleteOne();
  sendSuccess(res, {}, 'Series deleted');
});
