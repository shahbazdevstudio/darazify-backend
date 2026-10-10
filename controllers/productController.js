const Product = require('../models/Product');
const createCatalogController = require('./catalogFactory');

/** Leather products (collection: products). */
module.exports = createCatalogController(Product, { noun: 'product', single: 'product', plural: 'products', folder: 'darazify/products' });
