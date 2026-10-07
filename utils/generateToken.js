const jwt = require('jsonwebtoken');

const COOKIE_USER = 'dz_token';
const COOKIE_ADMIN = 'dz_admin_token';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SEVEN_DAYS,
  path: '/',
});

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

/** Signs a JWT and stores it in an httpOnly cookie (admins and users use different cookies). */
const attachToken = (res, user) => {
  const token = signToken(user._id, user.role);
  res.cookie(user.role === 'admin' ? COOKIE_ADMIN : COOKIE_USER, token, cookieOptions());
  return token;
};

const clearToken = (res, cookieName) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(cookieName, opts);
};

module.exports = { signToken, attachToken, clearToken, COOKIE_USER, COOKIE_ADMIN };
