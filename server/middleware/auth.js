const jwt = require('jsonwebtoken');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable not set!');
  console.error('Please create a .env file with a secure JWT_SECRET');
  process.exit(1);
}

// Authentication middleware
function requireAuth(req, res, next) {
  const authCookie = req.cookies.auth_session;

  if (!authCookie) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Verify JWT signature and expiration
    const session = jwt.verify(authCookie, JWT_SECRET);
    req.user = session;
    next();
  } catch (error) {
    // JWT verification failed (invalid signature, expired, malformed, etc.)
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { requireAuth };
