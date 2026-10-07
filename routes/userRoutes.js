const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/userController');

router.use(protect);
router.get('/me', c.getProfile);
router.put(
  '/me',
  [
    body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Enter a valid name'),
    body('email').optional().trim().isEmail().withMessage('Enter a valid email'),
    body('phone').optional({ values: 'falsy' }).trim().matches(/^[+\d][\d\s-]{6,18}$/).withMessage('Enter a valid phone number'),
    body('address').optional().trim().isLength({ max: 250 }),
    body('city').optional().trim().isLength({ max: 80 }),
  ],
  validate,
  c.updateProfile
);
router.put(
  '/me/password',
  [
    body('currentPassword').notEmpty().withMessage('Enter your current password'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters').matches(/\d/).withMessage('Password must include a number'),
    body('confirmPassword').custom((v, { req }) => v === req.body.newPassword).withMessage('Passwords do not match'),
  ],
  validate,
  c.changePassword
);
router.delete('/me', [body('password').notEmpty().withMessage('Enter your password to confirm')], validate, c.deleteAccount);

module.exports = router;
