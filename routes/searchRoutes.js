const router = require('express').Router();
const { suggest } = require('../controllers/searchController');

router.get('/', suggest);

module.exports = router;
