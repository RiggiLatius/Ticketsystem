const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const {
  listTickets,
  statistik,
  canAccessTicket,
  STATUS,
} = require('../services/ticketQueries');
const { shortId } = require('../util/uuid');
const { addEvent } = require('../services/ticketService');
const { notifyAssignment } = require('../services/notifications');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const router = express.Router();

router.use(requireLogin);

function loadTicketOr403(req, res) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) {
    res.status(404).json({ fehler: 'Ticket nicht gefunden' });
    return null;
  }
  if (!canAccessTicket(req.user, ticket)) {
    res.status(403).json({ fehler: 'Kein Zugriff' });
    return null;
  }
  return ticket;
}

router.get('/', (req, res) => {
  const items = listTickets(req.user, req.query);
  res.json({
    tickets: items.map((t) => ({ ...t, kurz_id: shortId(t.id) })),
    count: items.length,
  });
});

router.get('/statistik', (req, res) => {
  res.json(statistik(req.user));
});

router.get('/meta/zuweisbare-benutzer', (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.ist_admin,
              (SELECT GROUP_CONCAT(b.name, ', ')
                 FROM user_bereiche ub JOIN bereiche b ON b.id = ub.bereich_id
                WHERE ub.user_id = u.id) AS bereiche
         FROM users u WHERE u.aktiv = 1 ORDER BY u.name`
    )
    .all();
  res.json({ users });
});

router.get('/meta/bereiche', (_req, res) => {
  const bereiche = db.prepare('SELECT id, name FROM bereiche WHERE aktiv = 1 ORDER BY name').all();
  res.json({ bereiche });
});

router.get('/:id', (req, res) => {
  const ticket = loadTicketOr403(req, res);
  if (!ticket) return;

  const bereich = ticket.bereich_id
    ? db.prepare('SELECT id, name FROM bereiche WHERE id = ?').get(ticket.bereich_id)
    : null;
  const zugewiesen = ticket.zugewiesen_an
    ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(ticket.zugewiesen_an)
    : null;

  const events = db
    .prepare(
      `SELECT e.id, e.typ, e.inhalt, e.erstellt_am, e.erstellt_von,
              u.name AS erstellt_von_name
         FROM ticket_events e
         LEFT JOIN users u ON u.id = e.erstellt_von
        WHERE e.ticket_id = ?
        ORDER BY e.id ASC`
    )
    .all(ticket.id);

  res.json({
    ticket: { ...ticket, kurz_id: shortId(ticket.id), bereich, zugewiesen },
    events,
  });
});

router.patch('/:id', (req, res, next) => {
  try {
    const ticket = loadTicketOr403(req, res);
    if (!ticket) return;

    const patches = {};
    const eventEntries = [];

    if (typeof req.body.status === 'string') {
      const s = req.body.status;
      if (!STATUS.includes(s)) return res.status(400).json({ fehler: 'Ungültiger Status' });
      if (s !== ticket.status) {
        patches.status = s;
        eventEntries.push({
          typ: 'statuswechsel',
          inhalt: JSON.stringify({ von: ticket.status, nach: s }),
        });
      }
    }

    if ('bereich_id' in req.body) {
      const bId = req.body.bereich_id || null;
      if (bId) {
        const b = db.prepare('SELECT id, name FROM bereiche WHERE id = ? AND aktiv = 1').get(bId);
        if (!b) return res.status(400).json({ fehler: 'Bereich nicht gefunden' });
      }
      if (bId !== ticket.bereich_id) {
        const oldName = ticket.bereich_id
          ? db.prepare('SELECT name FROM bereiche WHERE id = ?').get(ticket.bereich_id)?.name
          : null;
        const newName = bId
          ? db.prepare('SELECT name FROM bereiche WHERE id = ?').get(bId)?.name
          : null;
        patches.bereich_id = bId;
        eventEntries.push({
          typ: 'zuweisung',
          inhalt: JSON.stringify({ art: 'bereich', von: oldName, nach: newName }),
        });
      }
    }

    let assigneeChanged = null;
    if ('zugewiesen_an' in req.body) {
      const uid = req.body.zugewiesen_an || null;
      if (uid) {
        const u = db.prepare('SELECT id, name FROM users WHERE id = ? AND aktiv = 1').get(uid);
        if (!u) return res.status(400).json({ fehler: 'Benutzer nicht gefunden' });
      }
      if (uid !== ticket.zugewiesen_an) {
        const oldName = ticket.zugewiesen_an
          ? db.prepare('SELECT name FROM users WHERE id = ?').get(ticket.zugewiesen_an)?.name
          : null;
        const newName = uid
          ? db.prepare('SELECT name FROM users WHERE id = ?').get(uid)?.name
          : null;
        patches.zugewiesen_an = uid;
        eventEntries.push({
          typ: 'zuweisung',
          inhalt: JSON.stringify({ art: 'person', von: oldName, nach: newName }),
        });
        assigneeChanged = uid;
      }
    }

    if (Object.keys(patches).length === 0) {
      return res.json({ ok: true, geaendert: false });
    }

    const setClause = Object.keys(patches)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = Object.values(patches);
    db.prepare(
      `UPDATE tickets SET ${setClause}, aktualisiert_am = datetime('now') WHERE id = ?`
    ).run(...values, ticket.id);

    for (const ev of eventEntries) {
      addEvent({ ticketId: ticket.id, typ: ev.typ, inhalt: ev.inhalt, userId: req.user.id });
    }

    if (assigneeChanged) {
      notifyAssignment(ticket.id, assigneeChanged).catch((e) =>
        console.error('[tickets] notifyAssignment:', e.message)
      );
    }

    res.json({ ok: true, geaendert: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/mail', async (req, res, next) => {
  try {
    const ticket = loadTicketOr403(req, res);
    if (!ticket) return;
    const to = String(req.body?.to || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!to || !body) return res.status(400).json({ fehler: 'Empfänger und Nachricht erforderlich' });
    const { sendMail } = require('../services/mailer');
    await sendMail({ to, subject: subject || `[Ticket #${shortId(ticket.id)}] ${ticket.betreff}`, text: body });
    addEvent({
      ticketId: ticket.id,
      typ: 'mail_ausgehend',
      inhalt: JSON.stringify({ empfaenger: to, betreff: subject, body }),
      userId: req.user.id,
    });
    db.prepare(`UPDATE tickets SET aktualisiert_am = datetime('now') WHERE id = ?`).run(ticket.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/kommentar', (req, res) => {
  const ticket = loadTicketOr403(req, res);
  if (!ticket) return;
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ fehler: 'Kommentar darf nicht leer sein' });
  addEvent({ ticketId: ticket.id, typ: 'kommentar', inhalt: text, userId: req.user.id });
  db.prepare(`UPDATE tickets SET aktualisiert_am = datetime('now') WHERE id = ?`).run(ticket.id);
  res.status(201).json({ ok: true });
});

// Anhang-Download unter /api/anhang/:ticketId (siehe server.js)
function anhangHandler(req, res) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ fehler: 'Ticket nicht gefunden' });
  if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ fehler: 'Kein Zugriff' });
  if (!ticket.anhang_pfad) return res.status(404).json({ fehler: 'Kein Anhang' });
  const full = path.join(config.paths.uploads, ticket.anhang_pfad);
  if (!full.startsWith(config.paths.uploads) || !fs.existsSync(full)) {
    return res.status(404).json({ fehler: 'Datei nicht gefunden' });
  }
  res.sendFile(full);
}

module.exports = router;
module.exports.anhangHandler = anhangHandler;
