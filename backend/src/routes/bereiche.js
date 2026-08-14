const express = require('express');
const db = require('../db/database');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { uuid } = require('../util/uuid');

const router = express.Router();

router.get('/', requireLogin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.name, b.aktiv,
              (SELECT COUNT(*) FROM tickets t WHERE t.bereich_id = b.id) AS ticket_count,
              (SELECT COUNT(*) FROM user_bereiche ub WHERE ub.bereich_id = b.id) AS user_count
         FROM bereiche b ORDER BY b.name`
    )
    .all();
  res.json({ bereiche: rows.map((r) => ({ ...r, aktiv: !!r.aktiv })) });
});

router.post('/', requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ fehler: 'Name erforderlich' });
  if (db.prepare('SELECT id FROM bereiche WHERE name = ?').get(name)) {
    return res.status(409).json({ fehler: 'Bereich existiert bereits' });
  }
  const id = uuid();
  db.prepare('INSERT INTO bereiche (id, name) VALUES (?, ?)').run(id, name);
  res.status(201).json({ bereich: { id, name, aktiv: true, ticket_count: 0, user_count: 0 } });
});

router.patch('/:id', requireAdmin, (req, res) => {
  const b = db.prepare('SELECT * FROM bereiche WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ fehler: 'Bereich nicht gefunden' });
  const patches = {};
  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    const nm = req.body.name.trim();
    if (nm !== b.name && db.prepare('SELECT id FROM bereiche WHERE name = ?').get(nm)) {
      return res.status(409).json({ fehler: 'Name bereits vergeben' });
    }
    patches.name = nm;
  }
  if (typeof req.body.aktiv === 'boolean') patches.aktiv = req.body.aktiv ? 1 : 0;
  if (!Object.keys(patches).length) return res.json({ ok: true, geaendert: false });
  const setClause = Object.keys(patches).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE bereiche SET ${setClause} WHERE id = ?`).run(...Object.values(patches), b.id);
  res.json({ ok: true, geaendert: true });
});

module.exports = router;
