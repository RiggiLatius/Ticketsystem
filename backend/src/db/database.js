const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(config.paths.data, { recursive: true });
fs.mkdirSync(config.paths.uploads, { recursive: true });

const db = new Database(config.paths.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
