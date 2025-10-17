/**
 * Utility for safe error responses in production
 */

/**
 * Get safe error message for client response
 * In production, hides internal details. In development, shows full details.
 * @param {Error} error - The error object
 * @returns {Object} - Safe error response object
 */
function getSafeErrorResponse(error) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Development: return full error details
    return {
      error: error.message,
      stack: error.stack,
      details: error.details || null
    };
  } else {
    // Production: return generic message, hide stack traces
    const genericMessages = {
      'ECONNREFUSED': 'Service unavailable. Please try again later.',
      'ETIMEDOUT': 'Request timed out. Please try again.',
      'ENOTFOUND': 'External service not found.',
      'SQLITE_CONSTRAINT': 'Database constraint violation.',
      'SQLITE_ERROR': 'Database error occurred.'
    };

    let safeMessage = 'An error occurred while processing your request.';

    // Check for known error codes/types
    if (error.code && genericMessages[error.code]) {
      safeMessage = genericMessages[error.code];
    } else if (error.message && error.message.includes('UNIQUE constraint failed')) {
      safeMessage = 'A record with this value already exists.';
    } else if (error.message && error.message.includes('NOT NULL constraint failed')) {
      safeMessage = 'Required field is missing.';
    } else if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      safeMessage = 'Cannot delete: record is referenced by other data.';
    }

    return {
      error: safeMessage
    };
  }
}

/**
 * Express middleware to catch all unhandled errors
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function globalErrorHandler(err, req, res, next) {
  console.error('[GlobalErrorHandler] Unhandled error:', err);

  const safeError = getSafeErrorResponse(err);
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json(safeError);
}

module.exports = {
  getSafeErrorResponse,
  globalErrorHandler
};
