const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'CastError') { status = 400; message = 'Invalid ID format'; }
  else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `That ${field} is already in use`;
  } else if (err.name === 'ValidationError') {
    status = 422;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5MB or smaller' : err.message;
  } else if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }

  if (status >= 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production' && !err.isOperational) message = 'Something went wrong';
  }

  res.status(status).json({ success: false, message, ...(err.errors ? { errors: err.errors } : {}) });
};

module.exports = { notFound, errorHandler };
