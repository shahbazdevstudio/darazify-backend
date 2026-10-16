const mongoose = require('mongoose');

/** A "playlist" of games (e.g. GTA). Shown as a white logo card on the home page. */
const seriesSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, index: true },
    image: { url: { type: String, required: true }, publicId: { type: String, default: '' } },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Series', seriesSchema);
