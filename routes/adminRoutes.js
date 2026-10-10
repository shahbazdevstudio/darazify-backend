const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { adminProtect } = require('../middleware/adminMiddleware');
const { STATUSES } = require('../models/Order');
const admin = require('../controllers/adminController');
const products = require('../controllers/productController');
const software = require('../controllers/softwareController');
const games = require('../controllers/adminGameController');

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
router.get('/products', adminView, products.getItems);
router.get('/products/:id', adminView, products.getItem);
router.get('/software', adminView, software.getItems);
router.get('/software/:id', adminView, software.getItem);

// Games the store sells (picked from the RAWG catalogue)
router.get('/games/search', games.searchCatalogue);
router.get('/games/catalogue', games.browseCatalogue);
router.get('/games', games.listStoreGames);
router.post('/games', [body('rawgId').notEmpty().withMessage('Choose a game from the suggestions')], validate, games.addGame);
router.patch('/games/:id', games.updateGame);
router.delete('/games/:id', games.deleteGame);

router.get('/orders', admin.getOrders);
router.get('/orders/:id', admin.getOrder);
router.patch('/orders/:id/status', [body('status').isIn(STATUSES).withMessage(`Status must be one of: ${STATUSES.join(', ')}`)], validate, admin.updateOrderStatus);

module.exports = router;
