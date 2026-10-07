const router = require('express').Router();
const c = require('../controllers/gameController');

router.get('/', c.getGames);
router.get('/genres', c.getGenres);
router.get('/:id', c.getGame);

module.exports = router;
