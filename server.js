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

const missing = required.filter((key) => !process.env[key]);

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
// Security Headers
// =========================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

// =========================
// CORS Configuration
// =========================

// Add your actual frontend domains to FRONTEND_URL
// in the backend environment variables.
// Multiple origins can be comma-separated.

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header, such as server-to-server.
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.replace(/\/+$/, '');

    // Permit explicitly configured frontend domains.
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // Permit localhost only outside production.
    if (
      process.env.NODE_ENV !== 'production' &&
      !process.env.VERCEL &&
      isLocalOrigin(cleanOrigin)
    ) {
      return callback(null, true);
    }

    // Reject unknown origins.
    return callback(new Error('Origin not allowed by CORS'));
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
};

app.use(cors(corsOptions));

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
      console.log(`Darazify API listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
