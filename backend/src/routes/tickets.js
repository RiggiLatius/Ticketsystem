const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const { listTickets, statistik, canAccessTicket } = require('../services/ticketQueries');
const { shortId } = require('../util/uuid');

const router = express.Router();

router.use(requireLogin);

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

router.get('/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ fehler: 'Ticket nicht gefunden' });
  if (!canAccessTicket(req.user, ticket)) return res.status(403).json({ fehler: 'Kein Zugriff' });

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

module.exports = router;
