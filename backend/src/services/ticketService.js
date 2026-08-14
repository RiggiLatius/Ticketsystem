const db = require('../db/database');
const { uuid, shortId } = require('../util/uuid');
const { sendMail } = require('./mailer');
const config = require('../config');

const KATEGORIEN = {
  lieferung_versand: { label: 'Lieferung / Versand', bereich: 'Logistik' },
  rechnung_zahlung: { label: 'Rechnungsfehler / Zahlung', bereich: 'Buchhaltung' },
  falsche_ware_lieferant: { label: 'Falsche Ware / Lieferantenthema', bereich: 'Einkauf' },
  sonstiges: { label: 'Sonstiges', bereich: null },
};

const PRIORITAETEN = ['normal', 'hoch', 'dringend'];

function findBereichIdByName(name) {
  if (!name) return null;
  const row = db.prepare('SELECT id FROM bereiche WHERE name = ? AND aktiv = 1').get(name);
  return row ? row.id : null;
}

function addEvent({ ticketId, typ, inhalt, userId }) {
  db.prepare(
    'INSERT INTO ticket_events (ticket_id, typ, inhalt, erstellt_von) VALUES (?, ?, ?, ?)'
  ).run(ticketId, typ, inhalt || null, userId || null);
}

function createTicketFromForm(data, file) {
  const kat = KATEGORIEN[data.kategorie];
  if (!kat) {
    const err = new Error('Ungültige Kategorie');
    err.status = 400;
    throw err;
  }
  const betreff = String(data.betreff || '').trim();
  const beschreibung = String(data.beschreibung || '').trim();
  if (!betreff || !beschreibung) {
    const err = new Error('Betreff und Beschreibung sind erforderlich');
    err.status = 400;
    throw err;
  }
  const prioritaet = PRIORITAETEN.includes(data.prioritaet) ? data.prioritaet : 'normal';
  const bereichId = kat.bereich ? findBereichIdByName(kat.bereich) : null;
  const id = uuid();
  const einreicherEmail = data.einreicher_email
    ? String(data.einreicher_email).trim().toLowerCase()
    : null;
  const einreicherName = data.einreicher_name
    ? String(data.einreicher_name).trim().slice(0, 200)
    : null;
  const anhangPfad = file ? file.filename : null;

  db.prepare(
    `INSERT INTO tickets
       (id, betreff, beschreibung, kategorie, bereich_id, prioritaet, status,
        einreicher_name, einreicher_email, anhang_pfad)
     VALUES (?, ?, ?, ?, ?, ?, 'offen', ?, ?, ?)`
  ).run(
    id,
    betreff.slice(0, 300),
    beschreibung,
    data.kategorie,
    bereichId,
    prioritaet,
    einreicherName,
    einreicherEmail,
    anhangPfad
  );

  addEvent({
    ticketId: id,
    typ: 'system',
    inhalt: JSON.stringify({
      aktion: 'ticket_erstellt',
      kategorie: kat.label,
      bereich: kat.bereich,
      prioritaet,
      anhang: !!anhangPfad,
    }),
    userId: null,
  });

  return { id, kurzId: shortId(id), bereich: kat.bereich };
}

async function sendPublicNotifications(ticket) {
  const kurzId = shortId(ticket.id);
  const ticketRow = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id);
  const bereichName = ticketRow.bereich_id
    ? db.prepare('SELECT name FROM bereiche WHERE id = ?').get(ticketRow.bereich_id)?.name
    : 'noch nicht zugewiesen';

  const kat = KATEGORIEN[ticketRow.kategorie];

  if (ticketRow.einreicher_email) {
    const subject = `[Ticket #${kurzId}] ${ticketRow.betreff}`;
    const text = [
      `Guten Tag${ticketRow.einreicher_name ? ' ' + ticketRow.einreicher_name : ''},`,
      '',
      'vielen Dank für Ihre Reklamation. Wir haben Ihr Anliegen mit folgender Referenz aufgenommen:',
      '',
      `  Ticket-Nummer: ${kurzId}`,
      `  Betreff:       ${ticketRow.betreff}`,
      `  Kategorie:     ${kat?.label || ticketRow.kategorie}`,
      `  Priorität:     ${ticketRow.prioritaet}`,
      `  Zuständig:     ${bereichName}`,
      '',
      'Wir melden uns umgehend zurück. Bitte antworten Sie bei Rückfragen auf diese E-Mail, ohne',
      `die Ticket-Referenz "[Ticket #${kurzId}]" im Betreff zu verändern.`,
      '',
      'Mit freundlichen Grüßen',
      `${config.firmaName} — Reklamations-Ticketsystem`,
    ].join('\n');
    try {
      await sendMail({ to: ticketRow.einreicher_email, subject, text });
      addEvent({
        ticketId: ticket.id,
        typ: 'mail_ausgehend',
        inhalt: JSON.stringify({
          empfaenger: ticketRow.einreicher_email,
          betreff: subject,
          zweck: 'bestaetigung_einreicher',
        }),
      });
    } catch (e) {
      console.error('[ticketService] Bestätigungsmail fehlgeschlagen:', e.message);
    }
  }

  const notifyTo = config.mailNotifyInbox;
  if (notifyTo) {
    const subject = `[Ticket #${kurzId}] Neue Reklamation: ${ticketRow.betreff}`;
    const text = [
      `Es wurde eine neue Reklamation eingereicht.`,
      '',
      `  Ticket-Nummer: ${kurzId}`,
      `  Kategorie:     ${kat?.label || ticketRow.kategorie}`,
      `  Bereich:       ${bereichName}`,
      `  Priorität:     ${ticketRow.prioritaet}`,
      `  Einreicher:    ${ticketRow.einreicher_name || '-'} <${ticketRow.einreicher_email || '-'}>`,
      '',
      `Beschreibung:`,
      ticketRow.beschreibung,
    ].join('\n');
    try {
      await sendMail({ to: notifyTo, subject, text });
    } catch (e) {
      console.error('[ticketService] Interne Benachrichtigung fehlgeschlagen:', e.message);
    }
  }
}

module.exports = {
  KATEGORIEN,
  PRIORITAETEN,
  createTicketFromForm,
  sendPublicNotifications,
  addEvent,
};
