// Authentication middleware
function requireAuth(req, res, next) {
  const authCookie = req.cookies.auth_session;

  if (!authCookie) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const session = JSON.parse(authCookie);
    req.user = session;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid session' });
  }
}

module.exports = { requireAuth };
