const User = require('../models/User');
const Cart = require('../models/Cart');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const { clearToken, COOKIE_USER } = require('../utils/generateToken');

exports.getProfile = asyncHandler(async (req, res) =>
  sendSuccess(res, { user: req.user, hasDeliveryInfo: req.user.hasDeliveryInfo() })
);

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  const { name, email, phone, address, city, bio, currentPassword } = req.body;

  if (email && email.toLowerCase() !== user.email) {
    if (!currentPassword || !(await user.matchPassword(currentPassword))) throw new AppError('Enter your current password to change your email', 401);
    if (await User.findOne({ email: email.toLowerCase() })) throw new AppError('That email is already in use', 409);
    user.email = email;
  }
  ['name', 'phone', 'address', 'city', 'bio'].forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f];
  });
  await user.save();
  sendSuccess(res, { user, hasDeliveryInfo: user.hasDeliveryInfo() }, 'Profile updated');
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.currentPassword))) throw new AppError('Current password is incorrect', 401);
  user.password = req.body.newPassword;
  await user.save();
  sendSuccess(res, {}, 'Password changed successfully');
});

exports.deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.password))) throw new AppError('Password is incorrect', 401);
  await Cart.deleteOne({ user: user._id });
  await user.deleteOne();
  clearToken(res, COOKIE_USER);
  sendSuccess(res, {}, 'Your account has been deleted');
});
