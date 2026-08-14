const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { uuid } = require('../util/uuid');

const router = express.Router();
router.use(requireAdmin);

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    ist_admin: !!row.ist_admin,
    aktiv: !!row.aktiv,
    benachrichtigungen: !!row.benachrichtigungen,
    erstellt_am: row.erstellt_am,
    bereiche: db
      .prepare(
        `SELECT b.id, b.name FROM bereiche b
           JOIN user_bereiche ub ON ub.bereich_id = b.id
          WHERE ub.user_id = ? ORDER BY b.name`
      )
      .all(row.id),
  };
}

router.get('/', (_req, res) => {
  const rows = db
    .prepare(
      'SELECT id, name, email, ist_admin, aktiv, benachrichtigungen, erstellt_am FROM users ORDER BY name'
    )
    .all();
  res.json({ users: rows.map(serialize) });
});

router.post('/', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const istAdmin = !!req.body?.ist_admin;
  const bereichIds = Array.isArray(req.body?.bereich_ids) ? req.body.bereich_ids : [];

  if (!name || !email || !password) {
    return res.status(400).json({ fehler: 'Name, E-Mail und Passwort erforderlich' });
  }
  if (password.length < 8) {
    return res.status(400).json({ fehler: 'Passwort muss mindestens 8 Zeichen haben' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ fehler: 'E-Mail bereits vergeben' });
  }

  const id = uuid();
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO users (id, name, email, password_hash, ist_admin) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, email, bcrypt.hashSync(password, 10), istAdmin ? 1 : 0);
    const ins = db.prepare('INSERT INTO user_bereiche (user_id, bereich_id) VALUES (?, ?)');
    for (const bid of bereichIds) {
      const b = db.prepare('SELECT id FROM bereiche WHERE id = ?').get(bid);
      if (b) ins.run(id, bid);
    }
  });
  tx();

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ user: serialize(row) });
});

router.patch('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ fehler: 'Benutzer nicht gefunden' });

  const patches = {};
  if (typeof req.body.name === 'string' && req.body.name.trim()) patches.name = req.body.name.trim();
  if (typeof req.body.email === 'string' && req.body.email.trim()) {
    const em = req.body.email.trim().toLowerCase();
    if (em !== user.email && db.prepare('SELECT id FROM users WHERE email = ?').get(em)) {
      return res.status(409).json({ fehler: 'E-Mail bereits vergeben' });
    }
    patches.email = em;
  }
  if (typeof req.body.ist_admin === 'boolean') patches.ist_admin = req.body.ist_admin ? 1 : 0;
  if (typeof req.body.aktiv === 'boolean') {
    if (user.id === req.user.id && req.body.aktiv === false) {
      return res.status(400).json({ fehler: 'Sie können sich nicht selbst deaktivieren' });
    }
    patches.aktiv = req.body.aktiv ? 1 : 0;
  }
  if (typeof req.body.benachrichtigungen === 'boolean') {
    patches.benachrichtigungen = req.body.benachrichtigungen ? 1 : 0;
  }
  if (typeof req.body.password === 'string' && req.body.password.length > 0) {
    if (req.body.password.length < 8) {
      return res.status(400).json({ fehler: 'Passwort muss mindestens 8 Zeichen haben' });
    }
    patches.password_hash = bcrypt.hashSync(req.body.password, 10);
  }

  const bereichIds = Array.isArray(req.body?.bereich_ids) ? req.body.bereich_ids : null;

  const tx = db.transaction(() => {
    if (Object.keys(patches).length) {
      const setClause = Object.keys(patches).map((k) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...Object.values(patches), user.id);
    }
    if (bereichIds) {
      db.prepare('DELETE FROM user_bereiche WHERE user_id = ?').run(user.id);
      const ins = db.prepare('INSERT INTO user_bereiche (user_id, bereich_id) VALUES (?, ?)');
      for (const bid of bereichIds) {
        const b = db.prepare('SELECT id FROM bereiche WHERE id = ?').get(bid);
        if (b) ins.run(user.id, bid);
      }
    }
  });
  tx();

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: serialize(row) });
});

module.exports = router;
