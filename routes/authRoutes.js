const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protectAllowBlocked, protectAdminCookie } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const c = require('../controllers/authController');

const email = body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail();
const strongPassword = (field) =>
  body(field)
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/).withMessage('Password must include a letter')
    .matches(/\d/).withMessage('Password must include a number');
const confirm = (field = 'password') =>
  body('confirmPassword').custom((v, { req }) => v === req.body[field]).withMessage('Passwords do not match');

router.post('/register', [body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Enter your name'), email, strongPassword('password'), confirm()], validate, c.register);
router.post('/login', [email, body('password').notEmpty().withMessage('Enter your password')], validate, c.login);
router.post('/logout', c.logout);
router.get('/me', protectAllowBlocked, c.me);

router.post('/admin/login', [email, body('password').notEmpty().withMessage('Enter your password')], validate, c.adminLogin);
router.post('/admin/logout', c.adminLogout);
router.get('/admin/me', protectAdminCookie, adminOnly, c.me);

router.post('/forgot-password', [email], validate, c.forgotPassword);
router.post('/reset-password', [body('token').notEmpty().withMessage('Reset token is missing'), strongPassword('password'), confirm()], validate, c.resetPassword);

module.exports = router;
