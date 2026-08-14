const express = require('express');
const bcrypt = require('bcrypt');
const { findByEmail, loadUserById } = require('../services/userService');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ fehler: 'E-Mail und Passwort erforderlich' });
  }
  const row = findByEmail(email);
  if (!row || !row.aktiv || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ fehler: 'E-Mail oder Passwort falsch' });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ fehler: 'Session-Fehler' });
    req.session.userId = row.id;
    req.session.save(() => res.json({ user: loadUserById(row.id) }));
  });
});

router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireLogin, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
