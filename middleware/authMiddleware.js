const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/apiResponse');
const { COOKIE_USER, COOKIE_ADMIN } = require('../utils/generateToken');

/** Builds a middleware that authenticates from a given cookie and attaches req.user. */
const authenticate = (cookieName, { allowBlocked = false } = {}) =>
  asyncHandler(async (req, _res, next) => {
    const token = req.cookies?.[cookieName];
    if (!token) throw new AppError('Please log in to continue', 401);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new AppError('Your session has expired. Please log in again', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) throw new AppError('Account no longer exists', 401);
    if (user.isBlocked && !allowBlocked) throw new AppError('Your account has been blocked. Contact support.', 403);
    req.user = user;
    next();
  });

/** Regular customer routes. */
const protect = authenticate(COOKIE_USER);
/** Customer who may be blocked (used only for read-only session checks). */
const protectAllowBlocked = authenticate(COOKIE_USER, { allowBlocked: true });
/** Admin cookie authentication (role is checked again in adminMiddleware). */
const protectAdminCookie = authenticate(COOKIE_ADMIN);

/** Attaches req.user if a valid session exists, never errors (for optional-auth endpoints). */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    const token = req.cookies?.[COOKIE_USER];
    if (token) {
      const d = jwt.verify(token, process.env.JWT_SECRET);
      const u = await User.findById(d.id);
      if (u && !u.isBlocked) req.user = u;
    }
  } catch { /* ignore */ }
  next();
});

module.exports = { protect, protectAllowBlocked, protectAdminCookie, optionalAuth };
