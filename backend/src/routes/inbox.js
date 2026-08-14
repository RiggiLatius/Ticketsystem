const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { pollOnce, isConfigured } = require('../services/imapPoller');

const router = express.Router();
router.use(requireAdmin);

router.get('/', (_req, res) => {
  const mails = db
    .prepare(
      `SELECT id, absender, betreff, body, erhalten_am, verarbeitet
         FROM inbox_mails
        ORDER BY id DESC
        LIMIT 200`
    )
    .all();
  res.json({ mails, imap_konfiguriert: isConfigured() });
});

router.post('/:id/verarbeitet', (req, res) => {
  const r = db
    .prepare('UPDATE inbox_mails SET verarbeitet = 1 WHERE id = ?')
    .run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ fehler: 'Mail nicht gefunden' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM inbox_mails WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ fehler: 'Mail nicht gefunden' });
  res.json({ ok: true });
});

router.post('/poll', async (_req, res) => {
  const result = await pollOnce();
  res.json(result);
});

module.exports = router;
