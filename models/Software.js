const mongoose = require('mongoose');

/** Software has its own collection (separate from leather products), with the same fields. */
const softwareSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 140 },
    slug: { type: String, index: true },
    category: { type: String, required: [true, 'Category is required'], trim: true, index: true },
    description: { type: String, default: '' }, // sanitized HTML from the rich-text editor
    shortDescription: { type: String, trim: true, maxlength: 220, default: '' },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    stock: { type: Number, default: 999, min: 0 }, // available copies / licences
    images: [{ url: { type: String, required: true }, publicId: { type: String, required: true }, _id: false }],
    featured: { type: Boolean, default: false, index: true },
    popular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: 'software' }
);

softwareSchema.index({ title: 'text', category: 'text' });

softwareSchema.pre('save', function compute(next) {
  if (this.originalPrice && this.originalPrice > this.price) {
    this.discountPercent = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  } else {
    this.discountPercent = 0;
    if (!this.originalPrice) this.originalPrice = undefined;
  }
  if (this.isModified('title') || !this.slug) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('Software', softwareSchema);
