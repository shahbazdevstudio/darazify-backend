const crypto = require('crypto');
const User = require('../models/User');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const { attachToken, clearToken, COOKIE_USER, COOKIE_ADMIN } = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

const loginWith = async (req, res, requiredRole) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new AppError(GENERIC_LOGIN_ERROR, 401);
  if (requiredRole === 'admin' && user.role !== 'admin') throw new AppError(GENERIC_LOGIN_ERROR, 401);
  if (requiredRole === 'user' && user.role === 'admin') throw new AppError('Please use the admin login page', 403);
  if (user.isBlocked) throw new AppError('Your account has been blocked. Contact support.', 403);

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  const token = attachToken(res, user);
  return sendSuccess(res, { user, token }, 'Logged in successfully');
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ email: String(email).toLowerCase() })) throw new AppError('An account with this email already exists', 409);
  const user = await User.create({ name, email, password });
  const token = attachToken(res, user);
  sendSuccess(res, { user, token }, 'Account created successfully', 201);
});

exports.login = asyncHandler((req, res) => loginWith(req, res, 'user'));
exports.adminLogin = asyncHandler((req, res) => loginWith(req, res, 'admin'));

exports.logout = asyncHandler(async (_req, res) => {
  clearToken(res, COOKIE_USER);
  sendSuccess(res, {}, 'Logged out');
});

exports.adminLogout = asyncHandler(async (_req, res) => {
  clearToken(res, COOKIE_ADMIN);
  sendSuccess(res, {}, 'Logged out');
});

exports.me = asyncHandler(async (req, res) => sendSuccess(res, { user: req.user }));

exports.forgotPassword = asyncHandler(async (req, res) => {
  const message = 'If an account exists for that email, a reset link has been sent.';
  const user = await User.findOne({ email: String(req.body.email).toLowerCase() });
  if (!user || user.isBlocked) return sendSuccess(res, {}, message); // never reveal which emails exist

  const raw = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const base = (process.env.FRONTEND_URL || 'http://localhost:5500').split(',')[0].trim().replace(/\/$/, '');
  const link = `${base}/pages/reset-password.html?token=${raw}`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your Darazify password',
      text: `Hi ${user.name},\n\nUse the link below to reset your password. It expires in 30 minutes.\n${link}\n\nIf you did not request this, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto"><h2>Reset your password</h2><p>Hi ${user.name.replace(/[<>&]/g, '')},</p><p>Click the button below to choose a new password. This link expires in 30 minutes.</p><p><a href="${link}" style="background:#b5651d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p><p style="color:#777;font-size:13px">If you did not request this, you can safely ignore this email.</p></div>`,
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.error('Reset email failed:', err.message);
    throw new AppError('We could not send the reset email. Please try again later.', 500);
  }
  sendSuccess(res, {}, message);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash('sha256').update(String(req.body.token)).digest('hex');
  const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } }).select('+passwordResetToken +passwordResetExpires');
  if (!user) throw new AppError('This reset link is invalid or has expired', 400);

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  sendSuccess(res, {}, 'Password reset successfully. You can now log in.');
});
