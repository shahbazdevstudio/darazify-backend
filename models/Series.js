const mongoose = require('mongoose');

/** A "playlist" of games (e.g. GTA). Shown as a card (name + total games) on the home page. */
const seriesSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, index: true },
    image: { url: { type: String, default: '' }, publicId: { type: String, default: '' } }, // legacy logo, no longer required or shown
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Series', seriesSchema);
