const Software = require('../models/Software');
const createCatalogController = require('./catalogFactory');

/** Software (collection: software), completely separate from leather products. */
module.exports = createCatalogController(Software, { noun: 'software', single: 'software', plural: 'software', folder: 'darazify/software' });
