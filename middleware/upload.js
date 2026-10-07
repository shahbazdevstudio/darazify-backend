const multer = require('multer');
const { AppError } = require('../utils/apiResponse');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Images are kept in memory only and streamed to Cloudinary — nothing is written to disk. */
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new AppError('Only JPG, PNG, WEBP or AVIF images are allowed', 400)),
});
