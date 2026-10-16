require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// =========================
// Environment Variables
// =========================

const required = ['MONGODB_URI', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(
    `Missing required environment variables: ${ missing.join(', ') } `
  );

  process.exit(1);
}

// =========================
// Express App
// =========================

const app = express();

app.set('trust proxy', 1);

// =========================
// Security
// =========================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

// =========================
// CORS
// =========================
// Allowed frontends:
//   - FRONTEND_URL (comma separated, trailing slashes ignored)
//   - the live site (DEFAULT_ORIGINS below, so a missing env var can never break it)
//   - any localhost / 127.0.0.1 port (so you can run the frontend locally against this API).
//     Set CORS_ALLOW_LOCALHOST=false to switch that off.

const DEFAULT_ORIGINS = ['https://www.darazify.site', 'https://darazify.site'];

const allowedOrigins = [
  ...DEFAULT_ORIGINS,
  ...(process.env.FRONTEND_URL || '').split(',').map((url) => url.trim().replace(/\/+$/, '')).filter(Boolean),
];

const allowLocalhost = String(process.env.CORS_ALLOW_LOCALHOST || 'true').toLowerCase() !== 'false';
const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // curl, server-to-server
      const clean = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(clean) || (allowLocalhost && isLocalOrigin(clean))) return callback(null, true);
      return callback(null, false); // browser blocks it
    },
    credentials: true,
  })
);

// =========================
// Logging
// =========================

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// =========================
// Body Parsers
// =========================

app.use(
  express.json({
    limit: '1mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  })
);

app.use(cookieParser());

// =========================
// MongoDB Sanitization
// =========================

app.use(mongoSanitize());

// =========================
// General API Rate Limiting
// =========================

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please slow down.',
    },
  })
);

// =========================
// Authentication Rate Limiting
// =========================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again in a few minutes.',
  },
});

[
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/admin/login',
].forEach((route) => {
  app.use(route, authLimiter);
});

// =========================
// Health Check
// =========================

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Darazify API is running',
  });
});

// =========================
// API Routes
// =========================

app.use('/api/auth', require('./routes/authRoutes'));

app.use('/api/users', require('./routes/userRoutes'));

app.use('/api/products', require('./routes/productRoutes'));

app.use('/api/software', require('./routes/softwareRoutes'));

app.use('/api/games', require('./routes/gameRoutes'));

app.use('/api/series', require('./routes/seriesRoutes'));

app.use('/api/game-requests', require('./routes/gameRequestRoutes'));

app.use('/api/search', require('./routes/searchRoutes'));

app.use('/api/cart', require('./routes/cartRoutes'));

app.use('/api/orders', require('./routes/orderRoutes'));

app.use('/api/admin', require('./routes/adminRoutes'));

// =========================
// 404 Handler
// =========================

app.use(notFound);

// =========================
// Global Error Handler
// =========================

app.use(errorHandler);

// =========================
// Server
// =========================

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Darazify API listening on http://localhost:${ PORT }`
      );
    });
  })
  .catch((error) => {
    console.error(
      'Failed to start server:',
      error.message
    );

    process.exit(1);
  });
