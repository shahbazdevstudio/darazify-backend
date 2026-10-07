const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { adminProtect } = require('../middleware/adminMiddleware');
const { STATUSES } = require('../models/Order');
const admin = require('../controllers/adminController');
const { getProducts, getProduct } = require('../controllers/productController');

router.use(adminProtect);

router.get('/stats', admin.getStats);

router.get('/users', admin.getUsers);
router.get('/users/:id', admin.getUser);
router.get('/users/:id/orders', admin.getUserOrders);
router.patch('/users/:id/block', admin.blockUser);
router.patch('/users/:id/unblock', admin.unblockUser);
router.delete('/users/:id', admin.deleteUser);

// Admin product listing includes inactive products
const adminView = (req, _res, next) => { req.adminView = true; next(); };
router.get('/products', adminView, getProducts);
router.get('/products/:id', adminView, getProduct);

router.get('/orders', admin.getOrders);
router.get('/orders/:id', admin.getOrder);
router.patch('/orders/:id/status', [body('status').isIn(STATUSES).withMessage(`Status must be one of: ${STATUSES.join(', ')}`)], validate, admin.updateOrderStatus);

module.exports = router;
