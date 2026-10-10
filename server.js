
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const {
  notFound,
  errorHandler,
} = require('./middleware/errorMiddleware');

// =========================
// Environment Variables
// =========================

const required = ['MONGODB_URI', 'JWT_SECRET'];

const missing = required.filter(
  (key) => !process.env[key]
);

if (missing.length) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}`
  );

  process.exit(1);
}

// =========================
// Express App
// =========================

const app = express();

app.set('trust proxy', 1);

// =========================
// CORS Configuration
// =========================

// Set FRONTEND_URL in Vercel to your deployed frontend URL(s).
// Multiple origins can be comma-separated.

const configuredOrigins = (
  process.env.FRONTEND_URL || ''
)
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Local development origins.
// Keep these only while local testing is required.

const localOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const isProduction =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.VERCEL);

const allowedOrigins = [
  ...new Set([
    ...configuredOrigins,
    ...(!isProduction ? localOrigins : []),
    // Explicit local testing access to the deployed API:
    ...(process.env.ALLOW_LOCAL_FRONTEND === 'true'
      ? localOrigins
      : []),
  ]),
];

const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header, such as curl.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', normalizedOrigin);

    return callback(
      new Error(`Origin not allowed by CORS: ${normalizedOrigin}`)
    );
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
  ],

  optionsSuccessStatus: 204,
  maxAge: 86400,
};

// CORS must run before security middleware and API routes.
// This middleware also handles browser OPTIONS preflight requests.
app.use(cors(corsOptions));

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
// Logging
// =========================

if (!isProduction) {
  app.use(morgan('dev'));
}

// =========================
// Body Parsers
// =========================

app.use(express.json({ limit: '1mb' }));

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
// Export / Local Server
// =========================

// Exporting the app is useful for a Vercel function entry point.
module.exports = app;

// Start a local server only when running this file directly.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(
          `Darazify API listening on http://localhost:${PORT}`
        );
      });
    })
    .catch((error) => {
      console.error('Failed to start server:', error.message);
      process.exit(1);
    });
}
