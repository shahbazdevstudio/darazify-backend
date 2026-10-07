const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/orderController');

router.use(protect);
router.post(
  '/',
  [
    body('source').optional().isIn(['cart', 'direct']),
    body('shipping.phone').optional({ values: 'falsy' }).matches(/^[+\d][\d\s-]{6,18}$/).withMessage('Enter a valid phone number'),
    body('shipping.fullName').optional().trim().isLength({ max: 80 }),
    body('shipping.address').optional().trim().isLength({ max: 250 }),
    body('shipping.city').optional().trim().isLength({ max: 80 }),
  ],
  validate,
  c.createOrder
);
router.get('/', c.getMyOrders);
router.get('/:id', c.getMyOrder);
router.patch('/:id/cancel', c.cancelMyOrder);

module.exports = router;
