const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    itemType: { type: String, enum: ['product', 'game'], required: true },
    itemId: { type: String, required: true }, // Mongo _id for products, RAWG id for games
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
