const bcrypt = require('bcrypt');
const db = require('./database');
const { uuid } = require('../util/uuid');

const DEFAULT_BEREICHE = ['Einkauf', 'Logistik', 'Buchhaltung'];
const DEFAULT_ADMIN = {
  name: 'Administrator',
  email: 'admin@firma.de',
  password: 'Admin1234!',
};

function seedBereiche() {
  const insert = db.prepare('INSERT OR IGNORE INTO bereiche (id, name) VALUES (?, ?)');
  for (const name of DEFAULT_BEREICHE) insert.run(uuid(), name);
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEFAULT_ADMIN.email);
  if (existing) return { created: false };
  const hash = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, ist_admin) VALUES (?, ?, ?, ?, 1)'
  ).run(uuid(), DEFAULT_ADMIN.name, DEFAULT_ADMIN.email, hash);
  return { created: true, email: DEFAULT_ADMIN.email, password: DEFAULT_ADMIN.password };
}

function run() {
  seedBereiche();
  return seedAdmin();
}

module.exports = { run, DEFAULT_ADMIN };
