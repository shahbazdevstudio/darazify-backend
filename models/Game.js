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
    screenshots: { type: [String], default: [] },      // first one is the card hover image
    screenshotsFetched: { type: Boolean, default: false },
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
    series: { type: mongoose.Schema.Types.ObjectId, ref: 'Series', default: null, index: true }, // the series (playlist) this game belongs to
    // Custom games (created by the admin, not from RAWG) keep their own details
    isCustom: { type: Boolean, default: false, index: true },
    description: { type: String, default: '' },
    developers: [String],
    publishers: [String],
    esrb: { type: String, default: '' },
    // Manual ranking (see utils/ranking.js). null = not ranked, follows the default order.
    pinHero: { type: Number, default: null },
    pinPopular: { type: Number, default: null },
    pinAll: { type: Number, default: null, index: true },
    isHero: { type: Boolean, default: false, index: true }, // shown in the home page hero banner (max 3)
    heroAt: { type: Date, default: null },
    isPopular: { type: Boolean, default: false, index: true },
    isLatest: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

gameSchema.index({ name: 'text' });
// Serve the ranked lists (see utils/ranking.js effectiveSort) straight from an index
gameSchema.index({ isActive: 1, pinAll: -1, createdAt: -1, _id: 1 });
gameSchema.index({ isActive: 1, isPopular: 1, pinPopular: -1, ratingsCount: -1, createdAt: -1, _id: 1 });

module.exports = mongoose.model('Game', gameSchema);
