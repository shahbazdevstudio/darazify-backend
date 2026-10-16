const mongoose = require('mongoose');

/** A visitor's request for a game that is not in the store yet. Managed from the admin panel. */
const gameRequestSchema = new mongoose.Schema(
  {
    gameName: { type: String, required: true, trim: true, maxlength: 120 },
    name: { type: String, default: '', trim: true, maxlength: 60 },
    contact: { type: String, required: true, trim: true, maxlength: 100 }, // email or phone / WhatsApp
    note: { type: String, default: '', trim: true, maxlength: 500 },
    status: { type: String, enum: ['new', 'added', 'rejected'], default: 'new', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameRequest', gameRequestSchema);
