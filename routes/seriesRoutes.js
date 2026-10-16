const router = require('express').Router();
const c = require('../controllers/seriesController');

router.get('/', c.listPublic);
router.get('/:slug', c.getPublic);

module.exports = router;
