const mongoose = require('mongoose');

const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

/** Atomic counter used to generate human-friendly order numbers (DRZ-10001, ...). */
const Counter = mongoose.models.Counter || mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }));

const orderItemSchema = new mongoose.Schema(
  {
    itemType: { type: String, enum: ['product', 'game', 'software'], required: true },
    itemId: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    software: { type: mongoose.Schema.Types.ObjectId, ref: 'Software' },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
    },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: STATUSES, default: 'Pending', index: true },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, _id: false }],
    whatsappNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.pre('validate', async function genId(next) {
  if (this.orderId) return next();
  const c = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  this.orderId = `DRZ-${10000 + c.seq}`;
  next();
});

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
