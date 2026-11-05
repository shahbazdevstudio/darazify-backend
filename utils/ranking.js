/**
 * Manual ranking for the four game lists: the home banner (hero), Popular games, Latest games and All games.
 *
 * A ranked game stores a "pin" instead of a position: pin = PIN_TOP - position.
 * Sorting by pin DESCENDING puts ranked games first (position 1 first) and every game
 * without a pin (null or missing, e.g. games saved before this feature) after them,
 * in the list's normal default order. So default behaviour never changes until the admin ranks something.
 */
const PIN_TOP = 1000000;

const RANK_LISTS = {
  hero: { field: 'pinHero', base: { isHero: true }, order: { heroAt: 1 } },
  popular: { field: 'pinPopular', base: { isPopular: true }, order: { ratingsCount: -1, createdAt: -1 } },
  // Latest games: the admin's manual order first; then the games switched on most recently; then newest release
  latest: { field: 'pinLatest', base: { isLatest: true }, order: { latestAt: -1, released: -1, createdAt: -1 } },
  all: { field: 'pinAll', base: {}, order: { createdAt: -1 } },
};

const pinOf = (position) => PIN_TOP - position;

/** The one order used by the website AND the admin ranking page (so what you see there is what visitors get). */
const effectiveSort = (list) => ({ [list.field]: -1, ...list.order, _id: 1 });

module.exports = { RANK_LISTS, PIN_TOP, pinOf, effectiveSort };
