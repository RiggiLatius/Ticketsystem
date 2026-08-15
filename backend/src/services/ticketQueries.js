const db = require('../db/database');

const STATUS = ['offen', 'in_bearbeitung', 'warte_rueckmeldung', 'geloest', 'geschlossen'];
const PRIO = ['normal', 'hoch', 'dringend'];

function userBereichIds(userId) {
  return db
    .prepare('SELECT bereich_id FROM user_bereiche WHERE user_id = ?')
    .all(userId)
    .map((r) => r.bereich_id);
}

function accessibleTicketFilter(user) {
  if (user.ist_admin) return { where: '1=1', params: [] };
  const bereichIds = userBereichIds(user.id);
  const parts = [];
  const params = [];
  if (bereichIds.length) {
    parts.push(`t.bereich_id IN (${bereichIds.map(() => '?').join(',')})`);
    params.push(...bereichIds);
  }
  parts.push('t.zugewiesen_an = ?');
  params.push(user.id);
  return { where: '(' + parts.join(' OR ') + ')', params };
}

function canAccessTicket(user, ticket) {
  if (!ticket) return false;
  if (user.ist_admin) return true;
  if (ticket.zugewiesen_an === user.id) return true;
  if (!ticket.bereich_id) return false;
  const ids = userBereichIds(user.id);
  return ids.includes(ticket.bereich_id);
}

const SORT_COLUMNS = {
  aktualisiert: 't.aktualisiert_am',
  erstellt: 't.erstellt_am',
  prioritaet: `CASE t.prioritaet WHEN 'dringend' THEN 0 WHEN 'hoch' THEN 1 ELSE 2 END`,
  status: `CASE t.status WHEN 'offen' THEN 0 WHEN 'in_bearbeitung' THEN 1 WHEN 'warte_rueckmeldung' THEN 2 WHEN 'geloest' THEN 3 ELSE 4 END`,
};

function listTickets(user, opts = {}) {
  const acc = accessibleTicketFilter(user);
  const parts = [acc.where];
  const params = [...acc.params];

  if (opts.status && STATUS.includes(opts.status)) {
    parts.push('t.status = ?');
    params.push(opts.status);
  }
  if (opts.prioritaet && PRIO.includes(opts.prioritaet)) {
    parts.push('t.prioritaet = ?');
    params.push(opts.prioritaet);
  }
  if (opts.mine === true || opts.mine === 'true' || opts.mine === '1') {
    parts.push('t.zugewiesen_an = ?');
    params.push(user.id);
  }
  if (opts.bereich_id) {
    parts.push('t.bereich_id = ?');
    params.push(opts.bereich_id);
  }
  if (opts.q) {
    const q = `%${String(opts.q).trim()}%`;
    parts.push('(t.betreff LIKE ? OR t.beschreibung LIKE ? OR t.einreicher_name LIKE ? OR t.einreicher_email LIKE ?)');
    params.push(q, q, q, q);
  }

  const sortKey = SORT_COLUMNS[opts.sort] ? opts.sort : 'aktualisiert';
  const order = String(opts.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const orderClause = `${SORT_COLUMNS[sortKey]} ${order}`;

  const sql = `
    SELECT t.id, t.betreff, t.kategorie, t.prioritaet, t.status,
           t.einreicher_name, t.einreicher_email, t.niederlassung,
           t.erstellt_am, t.aktualisiert_am,
           b.name AS bereich_name, t.bereich_id,
           u.name AS zugewiesen_name, t.zugewiesen_an
      FROM tickets t
      LEFT JOIN bereiche b ON b.id = t.bereich_id
      LEFT JOIN users u ON u.id = t.zugewiesen_an
     WHERE ${parts.join(' AND ')}
     ORDER BY ${orderClause}
     LIMIT 500
  `;
  return db.prepare(sql).all(...params);
}

function statistik(user) {
  const acc = accessibleTicketFilter(user);
  const bereiche = db.prepare('SELECT id, name FROM bereiche WHERE aktiv = 1 ORDER BY name').all();

  const rows = db
    .prepare(
      `SELECT t.bereich_id, t.status, COUNT(*) AS n
         FROM tickets t
        WHERE ${acc.where}
        GROUP BY t.bereich_id, t.status`
    )
    .all(...acc.params);

  const perBereich = {};
  const kein = { offen: 0, in_bearbeitung: 0, andere: 0, gesamt: 0 };
  for (const b of bereiche) perBereich[b.id] = { id: b.id, name: b.name, offen: 0, in_bearbeitung: 0, andere: 0, gesamt: 0 };
  for (const r of rows) {
    const target = r.bereich_id ? perBereich[r.bereich_id] : kein;
    if (!target) continue;
    if (r.status === 'offen') target.offen += r.n;
    else if (r.status === 'in_bearbeitung') target.in_bearbeitung += r.n;
    else target.andere += r.n;
    target.gesamt += r.n;
  }
  return {
    bereiche: Object.values(perBereich),
    ohne_bereich: kein,
  };
}

module.exports = {
  STATUS,
  PRIO,
  accessibleTicketFilter,
  canAccessTicket,
  listTickets,
  statistik,
  userBereichIds,
};
