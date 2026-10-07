class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const sendSuccess = (res, data = {}, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

module.exports = { AppError, asyncHandler, sendSuccess };
