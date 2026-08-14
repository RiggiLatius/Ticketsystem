const { loadUserById } = require('../services/userService');

function attachUser(req, _res, next) {
  if (req.session && req.session.userId) {
    const user = loadUserById(req.session.userId);
    if (user && user.aktiv) req.user = user;
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ fehler: 'Nicht angemeldet' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ fehler: 'Nicht angemeldet' });
  if (!req.user.ist_admin) return res.status(403).json({ fehler: 'Nur für Administratoren' });
  next();
}

module.exports = { attachUser, requireLogin, requireAdmin };
