const jwt = require('jsonwebtoken');

const COOKIE_USER = 'dz_token';
const COOKIE_ADMIN = 'dz_admin_token';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cookie attributes depend on where the site runs:
 *  - local development (frontend :5500, API :5000 on localhost): same-site, so SameSite=Lax works.
 *  - production with the frontend and API on DIFFERENT domains (e.g. darazify.site + *.vercel.app):
 *    the browser only sends the cookie on cross-site requests when it is SameSite=None AND Secure.
 * Override with COOKIE_SAMESITE=lax|none|strict if you need to.
 */
const isProduction = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const cookieOptions = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || (isProduction() ? 'none' : 'lax')).toLowerCase();
  return {
    httpOnly: true,
    sameSite,
    secure: isProduction() || sameSite === 'none',
    maxAge: SEVEN_DAYS,
    path: '/',
  };
};

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

/**
 * Signs a JWT, stores it in an httpOnly cookie (admins and users use different cookies) and
 * returns it so the frontend can ALSO keep it as a Bearer token. The Bearer fallback keeps
 * login working in browsers that block third-party cookies (e.g. Safari).
 */
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
