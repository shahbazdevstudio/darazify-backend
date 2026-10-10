const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { adminProtect } = require('../middleware/adminMiddleware');

const rules = [
  body('title').trim().isLength({ min: 2, max: 140 }).withMessage('Title is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('originalPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Original price must be a number'),
  body('price').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Price must be a number'),
  body('stock').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Stock must be 0 or more'),
  body().custom((b) => b.price || (b.originalPrice && b.discountPercent)).withMessage('Provide a price (or original price + discount)'),
];
const updateRules = rules.slice(0, 5); // price presence is optional on update

/** Builds the public + admin routes for a catalog controller (products or software). */
module.exports = (c) => {
  const router = express.Router();
  router.get('/', c.getItems);
  router.get('/categories', c.getCategories);
  router.get('/:id', c.getItem);
  router.post('/', adminProtect, upload.array('images', 8), rules, validate, c.createItem);
  router.put('/:id', adminProtect, upload.array('images', 8), updateRules, validate, c.updateItem);
  router.delete('/:id', adminProtect, c.deleteItem);
  return router;
};
