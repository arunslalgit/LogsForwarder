const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDatabase } = require('../db/init');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable not set!');
  console.error('Please create a .env file with a secure JWT_SECRET');
  process.exit(1);
}

// Rate limiter for login endpoint - 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Login endpoint with rate limiting
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate JWT token with expiration (24 hours)
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie with JWT
    res.cookie('auth_session', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (match JWT expiration)
      sameSite: 'strict'
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('auth_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check if user is authenticated
router.get('/check', (req, res) => {
  const authCookie = req.cookies.auth_session;

  if (!authCookie) {
    return res.json({ authenticated: false });
  }

  try {
    // Verify JWT signature and expiration
    const session = jwt.verify(authCookie, JWT_SECRET);
    res.json({ authenticated: true, user: { id: session.userId, username: session.username } });
  } catch (error) {
    // JWT verification failed (invalid signature, expired, etc.)
    res.clearCookie('auth_session');
    res.json({ authenticated: false });
  }
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
  try {
    const authCookie = req.cookies.auth_session;

    if (!authCookie) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Verify JWT signature and expiration
    const session = jwt.verify(authCookie, JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(session.userId);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = bcrypt.compareSync(currentPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Update password
    const newPasswordHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admin_users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(newPasswordHash, user.id);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
