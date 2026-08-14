const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../db/database');
const config = require('../config');
const { findTicketBySubject } = require('./mailMatcher');
const { addEvent } = require('./ticketService');
const { notifyIncomingMail } = require('./notifications');

let running = false;
let timer = null;

function isConfigured() {
  return !!(config.imap.host && config.imap.user);
}

async function pollOnce() {
  if (!isConfigured()) return { skipped: true };
  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.imap.user, pass: config.imap.pass },
    logger: false,
  });
  let processed = 0;
  let matched = 0;
  let inbox = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const messages = client.fetch({ seen: false }, { source: true, envelope: true });
      for await (const msg of messages) {
        processed++;
        const parsed = await simpleParser(msg.source);
        const subject = parsed.subject || '';
        const from = parsed.from?.text || 'unbekannt';
        const bodyText = (parsed.text || '').trim();
        const ticketId = findTicketBySubject(subject);
        if (ticketId) {
          matched++;
          addEvent({
            ticketId,
            typ: 'mail_eingehend',
            inhalt: JSON.stringify({ absender: from, betreff: subject, body: bodyText.slice(0, 10000) }),
          });
          db.prepare(`UPDATE tickets SET aktualisiert_am = datetime('now') WHERE id = ?`).run(ticketId);
          try {
            await notifyIncomingMail(ticketId, from);
          } catch (e) {
            console.error('[imapPoller] notifyIncomingMail:', e.message);
          }
        } else {
          inbox++;
          db.prepare(
            'INSERT INTO inbox_mails (absender, betreff, body) VALUES (?, ?, ?)'
          ).run(from, subject, bodyText.slice(0, 10000));
        }
        await client.messageFlagsAdd(msg.seq, ['\\Seen']);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    console.error('[imapPoller] Fehler:', e.message);
    try {
      await client.logout();
    } catch (_e) {
      /* ignore */
    }
    return { error: e.message };
  }
  if (processed) console.log(`[imapPoller] ${processed} Mails verarbeitet (${matched} zugeordnet, ${inbox} Posteingang)`);
  return { processed, matched, inbox };
}

function start() {
  if (running) return;
  if (!isConfigured()) {
    console.log('[imapPoller] IMAP nicht konfiguriert — Poller deaktiviert.');
    return;
  }
  running = true;
  const intervalMs = Math.max(1, config.imap.pollIntervalMin) * 60 * 1000;
  console.log(`[imapPoller] Startet, Intervall ${config.imap.pollIntervalMin} Minute(n)`);
  pollOnce().catch((e) => console.error('[imapPoller] initialer Poll:', e.message));
  timer = setInterval(() => {
    pollOnce().catch((e) => console.error('[imapPoller] Poll:', e.message));
  }, intervalMs);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  running = false;
}

module.exports = { start, stop, pollOnce, isConfigured };
