const mongoose = require('mongoose');

/**
 * A game the admin has chosen to sell. Only games stored here are shown on the website.
 * The details are a snapshot taken from the RAWG API when the game is added.
 */
const gameSchema = new mongoose.Schema(
  {
    rawgId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, default: '' },
    image: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    metacritic: { type: Number, default: null },
    released: { type: String, default: '' }, // YYYY-MM-DD (sorts correctly as text)
    platforms: [String],
    genres: [String],
    genreSlugs: [String],
    price: { type: Number, default: null, min: 1 }, // null = use the default game price (GAME_PRICE, 250)
    nameKey: { type: String, index: true },          // normalised title, used to skip duplicates on import
    aliasKeys: { type: [String], index: true },      // other titles (from uploaded files) that map to this game
    isHero: { type: Boolean, default: false, index: true }, // shown in the home page hero banner (max 3)
    heroAt: { type: Date, default: null },
    isPopular: { type: Boolean, default: false, index: true },
    isLatest: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

gameSchema.index({ name: 'text' });

module.exports = mongoose.model('Game', gameSchema);
