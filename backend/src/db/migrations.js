const db = require('./database');

function hasColumn(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === column);
}

function run() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      ist_admin INTEGER NOT NULL DEFAULT 0,
      aktiv INTEGER NOT NULL DEFAULT 1,
      benachrichtigungen INTEGER NOT NULL DEFAULT 1,
      erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bereiche (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      aktiv INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_bereiche (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bereich_id TEXT NOT NULL REFERENCES bereiche(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, bereich_id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      betreff TEXT NOT NULL,
      beschreibung TEXT NOT NULL,
      kategorie TEXT NOT NULL,
      bereich_id TEXT REFERENCES bereiche(id) ON DELETE SET NULL,
      prioritaet TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'offen',
      einreicher_name TEXT,
      einreicher_email TEXT,
      zugewiesen_an TEXT REFERENCES users(id) ON DELETE SET NULL,
      anhang_pfad TEXT,
      erstellt_am TEXT NOT NULL DEFAULT (datetime('now')),
      aktualisiert_am TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_bereich ON tickets(bereich_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_zugewiesen ON tickets(zugewiesen_an);

    CREATE TABLE IF NOT EXISTS ticket_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      typ TEXT NOT NULL,
      inhalt TEXT,
      erstellt_von TEXT REFERENCES users(id) ON DELETE SET NULL,
      erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id, erstellt_am);

    CREATE TABLE IF NOT EXISTS inbox_mails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      absender TEXT,
      betreff TEXT,
      body TEXT,
      erhalten_am TEXT NOT NULL DEFAULT (datetime('now')),
      verarbeitet INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Additive Migrationen fuer bestehende DBs
  if (!hasColumn('tickets', 'niederlassung')) {
    db.exec(`ALTER TABLE tickets ADD COLUMN niederlassung TEXT`);
  }
}

module.exports = { run };
