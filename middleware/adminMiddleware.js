const { AppError } = require('../utils/apiResponse');
const { protectAdminCookie } = require('./authMiddleware');

/** Ensures the authenticated user has the admin role. */
const adminOnly = (req, _res, next) => {
  if (!req.user || req.user.role !== 'admin') return next(new AppError('Admin access required', 403));
  next();
};

/** Use on every admin route: authenticates via the admin cookie, then checks the role. */
const adminProtect = [protectAdminCookie, adminOnly];

module.exports = { adminOnly, adminProtect };
