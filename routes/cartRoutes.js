const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/cartController');

const item = [
  body('itemType').isIn(['product', 'game', 'software']).withMessage('Invalid item type'),
  body('itemId').notEmpty().withMessage('Item is required'),
];

router.use(protect);
router.get('/', c.getCart);
router.post('/', [...item, body('quantity').optional().isInt({ min: 1, max: 99 })], validate, c.addItem);
router.put('/', [...item, body('quantity').isInt({ min: 0, max: 99 }).withMessage('Invalid quantity')], validate, c.updateItem);
router.post('/merge', c.mergeCart);
router.delete('/', c.clearCart);
router.delete('/:itemType/:itemId', c.removeItem);

module.exports = router;
