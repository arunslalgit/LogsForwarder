const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../db/init');

// Login endpoint
router.post('/login', async (req, res) => {
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

    // Set HTTP-only cookie with user session
    res.cookie('auth_session', JSON.stringify({ userId: user.id, username: user.username }), {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
    const session = JSON.parse(authCookie);
    res.json({ authenticated: true, user: { id: session.userId, username: session.username } });
  } catch (error) {
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

    const session = JSON.parse(authCookie);
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
