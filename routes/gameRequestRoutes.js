const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/gameRequestController');

// 6 requests per hour per visitor keeps the inbox free of spam
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'You have sent several requests already. Please try again later.' },
});

router.post('/', limiter, c.create);

module.exports = router;
