const db = require('../db/database');

const REF_REGEX = /\[Ticket #([a-f0-9]{6,12})\]/i;

function findTicketBySubject(subject) {
  if (!subject) return null;
  const m = REF_REGEX.exec(subject);
  if (!m) return null;
  const kurz = m[1].toLowerCase();
  const row = db
    .prepare(`SELECT id FROM tickets WHERE lower(replace(id,'-','')) LIKE ? LIMIT 1`)
    .get(kurz + '%');
  return row ? row.id : null;
}

module.exports = { findTicketBySubject, REF_REGEX };
