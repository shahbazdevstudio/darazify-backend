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

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5500').split(',').map((s) => s.trim().replace(/\/$/, ''));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
  credentials: true,
}));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize());

// Rate limiting
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Please slow down.' } }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' } });
['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/admin/login'].forEach((p) => app.use(p, authLimiter));

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Darazify API is running' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/games', require('./routes/gameRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Darazify API listening on http://localhost:${PORT}`)))
  .catch((err) => { console.error('Failed to start server:', err.message); process.exit(1); });
