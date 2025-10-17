/**
 * Utility functions for sanitizing sensitive data before logging
 */

/**
 * Redact sensitive fields from an object for safe logging
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized copy of the object
 */
function redactSensitiveFields(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveFields = [
    'password',
    'password_hash',
    'token',
    'dynatrace_token',
    'splunk_token',
    'proxy_password',
    'auth',
    'authorization'
  ];

  const sanitized = { ...obj };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = sanitized[field] ? '***REDACTED***' : null;
    }
  }

  return sanitized;
}

/**
 * Redact passwords from URLs (e.g., proxy URLs with embedded credentials)
 * @param {string} url - URL string
 * @returns {string} - URL with password redacted
 */
function redactUrlPassword(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.password) {
      urlObj.password = '***';
    }
    return urlObj.toString();
  } catch (error) {
    // Not a valid URL, return as-is
    return url;
  }
}

module.exports = {
  redactSensitiveFields,
  redactUrlPassword
};
