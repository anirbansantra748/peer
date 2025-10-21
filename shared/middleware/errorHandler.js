const logger = require('../utils/prettyLogger');
const { notifyApiError } = require('../utils/errorNotification');

/**
 * Async route wrapper to catch errors
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware
 * Should be placed at the end of all routes
 */
function globalErrorHandler(err, req, res, next) {
  // Log the error
  logger.error('errorHandler', 'Unhandled error caught', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?._id,
  });

  // Notify user if authenticated
  if (req.user?._id) {
    notifyApiError(
      req.user._id,
      'Request',
      'An unexpected error occurred. Our team has been notified.',
      null
    ).catch(notifErr => {
      logger.error('errorHandler', 'Failed to send error notification', {
        error: notifErr.message,
      });
    });
  }

  // Determine if this is an API request or web request
  const isApiRequest = req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json');

  // Send appropriate response
  if (isApiRequest) {
    res.status(err.statusCode || 500).json({
      ok: false,
      error: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  } else {
    // For web requests, set flash message and redirect
    if (req.session) {
      req.session.errorMessage = err.message || 'An unexpected error occurred';
    }
    res.status(err.statusCode || 500).render('error', {
      title: 'Error',
      error: err,
      message: err.message || 'An unexpected error occurred',
      status: err.statusCode || 500,
    });
  }
}

/**
 * 404 handler for routes not found
 */
function notFoundHandler(req, res, next) {
  const error = new Error('Page not found');
  error.statusCode = 404;
  next(error);
}

/**
 * Custom error class for operational errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle specific error types
 */
function handleSpecificErrors(err, req, res, next) {
  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    err.message = `${field} already exists`;
    err.statusCode = 409;
  }

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    err.message = errors.join(', ');
    err.statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    err.message = 'Invalid token';
    err.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    err.message = 'Token expired';
    err.statusCode = 401;
  }

  // Axios errors (from API calls)
  if (err.isAxiosError) {
    err.message = err.response?.data?.error || err.message || 'External API request failed';
    err.statusCode = err.response?.status || 500;
  }

  next(err);
}

module.exports = {
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  handleSpecificErrors,
  AppError,
};
