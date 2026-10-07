const { validationResult } = require('express-validator');

/** Runs after express-validator chains; returns a consistent 422 response. */
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return res.status(422).json({ success: false, message: errors[0].message, errors });
};
