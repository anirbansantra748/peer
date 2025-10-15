/**
 * Middleware to require authentication
 * Redirects to login page if user is not authenticated
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Save the original URL to redirect back after login
  req.session.returnTo = req.originalUrl;
  
  // Redirect to login page
  res.redirect('/login');
}

/**
 * Middleware to require authentication for API endpoints
 * Returns 401 if not authenticated (for AJAX requests)
 */
function requireAuthAPI(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Middleware to check if user is already authenticated
 * Redirects to dashboard if logged in (for login page)
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

module.exports = {
  requireAuth,
  requireAuthAPI,
  redirectIfAuthenticated,
};
