const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },
    bio: { type: String, trim: true, maxlength: 300, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isBlocked: { type: Boolean, default: false },
    lastLoginAt: Date,
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

/** Returns the raw token (emailed to the user); only its SHA-256 hash is stored. */
userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return raw;
};

userSchema.methods.hasDeliveryInfo = function hasDeliveryInfo() {
  return Boolean(this.name && this.phone && this.address && this.city);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
