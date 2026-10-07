const sanitizeHtml = require("sanitize-html");
const Product = require('../models/Product');
const { uploadBuffer, deleteImage } = require('../config/cloudinary');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Allow-list for the rich-text editor output. Prevents stored XSS. */
const cleanHtml = (html = '') =>
  sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote', 'span', 'hr'],
    allowedAttributes: { a: ['href', 'target', 'rel'], span: ['style'], p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'] },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i],
        'text-align': [/^(left|right|center|justify)$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  });

const toBool = (v) => v === true || v === 'true' || v === 'on' || v === '1';
const toNum = (v) => (v === undefined || v === '' || v === null ? undefined : Number(v));

/** Reads numeric/boolean fields from multipart or JSON bodies. */
const parseBody = (body) => {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title).trim();
  if (body.category !== undefined) out.category = String(body.category).trim();
  if (body.description !== undefined) out.description = cleanHtml(body.description);
  if (body.shortDescription !== undefined) out.shortDescription = String(body.shortDescription).trim();
  const price = toNum(body.price);
  const originalPrice = toNum(body.originalPrice);
  const discount = toNum(body.discountPercent);
  if (originalPrice !== undefined) out.originalPrice = originalPrice;
  else if (body.originalPrice === '') out.originalPrice = undefined; // admin cleared the field
  if (price !== undefined) out.price = price;
  else if (originalPrice && discount) out.price = Math.round(originalPrice * (1 - discount / 100));
  if (toNum(body.stock) !== undefined) out.stock = toNum(body.stock);
  ['featured', 'popular', 'isActive'].forEach((k) => { if (body[k] !== undefined) out[k] = toBool(body[k]); });
  return out;
};

exports.getProducts = asyncHandler(async (req, res) => {
  const { search, category, sort = 'newest', featured, popular, minPrice, maxPrice } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const filter = req.adminView ? {} : { isActive: true };
  if (search) {
    const rx = new RegExp(escapeRegex(String(search).slice(0, 60)), 'i');
    filter.$or = [{ title: rx }, { category: rx }];
  }
  if (category && category !== 'all') filter.category = new RegExp(`^${escapeRegex(String(category))}$`, 'i');
  if (featured === 'true') filter.featured = true;
  if (popular === 'true') filter.popular = true;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const sorts = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    discount: { discountPercent: -1 },
    name: { title: 1 },
  };

  const [items, total] = await Promise.all([
    Product.find(filter).sort(sorts[sort] || sorts.newest).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  sendSuccess(res, { products: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.getCategories = asyncHandler(async (_req, res) => {
  const cats = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  sendSuccess(res, { categories: cats.map((c) => ({ name: c._id, count: c.count })) });
});

exports.getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { slug: id };
  const product = await Product.findOne(query).lean();
  if (!product || (!product.isActive && !req.adminView)) throw new AppError('Product not found', 404);

  const related = await Product.find({ category: product.category, _id: { $ne: product._id }, isActive: true }).limit(4).lean();
  sendSuccess(res, { product, related });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const data = parseBody(req.body);
  if (!req.files?.length) throw new AppError('Please upload at least one product image', 400);

  const images = await Promise.all(req.files.map((f) => uploadBuffer(f.buffer)));
  try {
    const product = await Product.create({ ...data, images });
    sendSuccess(res, { product }, 'Product created successfully', 201);
  } catch (err) {
    await Promise.all(images.map((i) => deleteImage(i.publicId))); // don't leave orphaned uploads
    throw err;
  }
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  Object.assign(product, parseBody(req.body));

  // Remove images selected for deletion
  let remove = req.body.removeImages || [];
  if (typeof remove === 'string') remove = remove.startsWith('[') ? JSON.parse(remove) : [remove];
  if (remove.length) {
    const toDelete = product.images.filter((i) => remove.includes(i.publicId));
    product.images = product.images.filter((i) => !remove.includes(i.publicId));
    await Promise.all(toDelete.map((i) => deleteImage(i.publicId)));
  }

  if (req.files?.length) {
    const uploaded = await Promise.all(req.files.map((f) => uploadBuffer(f.buffer)));
    product.images.push(...uploaded);
  }
  if (!product.images.length) throw new AppError('A product needs at least one image', 400);

  await product.save();
  sendSuccess(res, { product }, 'Product updated successfully');
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  await Promise.all(product.images.map((i) => deleteImage(i.publicId)));
  await product.deleteOne();
  sendSuccess(res, {}, 'Product deleted successfully');
});
