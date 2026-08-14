const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const Database = require('better-sqlite3');

const config = require('./config');
const migrations = require('./db/migrations');
const seed = require('./db/seed');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const publicFormRoutes = require('./routes/publicForm');
const ticketRoutes = require('./routes/tickets');

migrations.run();
const seedResult = seed.run();

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
      },
    },
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const sessionDb = new Database(config.paths.sessionsFile);
app.use(
  session({
    store: new SqliteStore({ client: sessionDb, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.env === 'production',
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use(attachUser);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, firma: config.firmaName, zeit: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/reklamation', publicFormRoutes);
app.use('/api/tickets', ticketRoutes);

app.use('/api', notFound);
app.use(express.static(config.paths.frontend));
app.use(errorHandler);

app.listen(config.port, () => {
  const line = '='.repeat(60);
  console.log(line);
  console.log(`  ${config.firmaName} — Reklamations-Ticketsystem`);
  console.log(`  Server läuft auf  http://localhost:${config.port}`);
  console.log(`  Umgebung          ${config.env}`);
  if (seedResult.created) {
    console.log('');
    console.log('  HINWEIS: Default-Admin wurde angelegt.');
    console.log(`    E-Mail:   ${seedResult.email}`);
    console.log(`    Passwort: ${seedResult.password}`);
    console.log('    -> Bitte nach dem ersten Login das Passwort ändern!');
  }
  console.log(line);
});
