const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const int = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
const bool = (v, def) => (v == null ? def : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 3000),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-bitte-aendern',
  firmaName: process.env.FIRMA_NAME || 'Reisser AG',
  mailFrom: process.env.MAIL_FROM || 'reklamation@firma.de',
  mailNotifyInbox: process.env.MAIL_NOTIFY_INBOX || 'reklamation@firma.de',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  imap: {
    host: process.env.IMAP_HOST || '',
    port: int(process.env.IMAP_PORT, 993),
    secure: bool(process.env.IMAP_SECURE, true),
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASS || '',
    pollIntervalMin: int(process.env.IMAP_POLL_INTERVAL_MIN, 5),
  },
  uploadMaxBytes: int(process.env.UPLOAD_MAX_MB, 5) * 1024 * 1024,
  paths: {
    root: rootDir,
    data: dataDir,
    uploads: path.join(dataDir, 'uploads'),
    dbFile: path.join(dataDir, 'app.db'),
    sessionsFile: path.join(dataDir, 'sessions.db'),
    frontend: path.join(rootDir, '..', 'frontend'),
  },
};
