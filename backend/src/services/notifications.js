const db = require('../db/database');
const { sendMail } = require('./mailer');
const { shortId } = require('../util/uuid');
const config = require('../config');

async function notifyAssignment(ticketId, userId) {
  const user = db
    .prepare('SELECT name, email, benachrichtigungen FROM users WHERE id = ? AND aktiv = 1')
    .get(userId);
  if (!user || !user.benachrichtigungen) return;
  const ticket = db.prepare('SELECT id, betreff, prioritaet FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return;
  const kurz = shortId(ticket.id);
  await sendMail({
    to: user.email,
    subject: `[Ticket #${kurz}] Ihnen zugewiesen: ${ticket.betreff}`,
    text: [
      `Guten Tag ${user.name},`,
      '',
      `Ihnen wurde ein Ticket zugewiesen:`,
      '',
      `  Ticket-Nummer: ${kurz}`,
      `  Betreff:       ${ticket.betreff}`,
      `  Priorität:     ${ticket.prioritaet}`,
      '',
      `Zum Ticket im System öffnen und weiter bearbeiten.`,
      '',
      `${config.firmaName} — Reklamations-Ticketsystem`,
    ].join('\n'),
  });
}

async function notifyIncomingMail(ticketId, absender) {
  const ticket = db
    .prepare(
      `SELECT t.id, t.betreff, t.zugewiesen_an, u.name AS user_name, u.email AS user_email,
              u.benachrichtigungen
         FROM tickets t LEFT JOIN users u ON u.id = t.zugewiesen_an WHERE t.id = ?`
    )
    .get(ticketId);
  if (!ticket || !ticket.user_email || !ticket.benachrichtigungen) return;
  const kurz = shortId(ticket.id);
  await sendMail({
    to: ticket.user_email,
    subject: `[Ticket #${kurz}] Neue Antwort im Ticket: ${ticket.betreff}`,
    text: [
      `Guten Tag ${ticket.user_name},`,
      '',
      `Zu einem Ihnen zugewiesenen Ticket ist eine neue Antwort eingegangen.`,
      '',
      `  Ticket-Nummer: ${kurz}`,
      `  Absender:      ${absender}`,
      `  Betreff:       ${ticket.betreff}`,
      '',
      `Zum Ticket im System öffnen.`,
      '',
      `${config.firmaName} — Reklamations-Ticketsystem`,
    ].join('\n'),
  });
}

module.exports = { notifyAssignment, notifyIncomingMail };
