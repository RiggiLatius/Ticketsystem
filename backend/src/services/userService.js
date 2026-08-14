const db = require('../db/database');

function loadUserById(id) {
  const user = db
    .prepare(
      'SELECT id, name, email, ist_admin, aktiv, benachrichtigungen FROM users WHERE id = ?'
    )
    .get(id);
  if (!user) return null;
  const bereiche = db
    .prepare(
      `SELECT b.id, b.name
         FROM bereiche b
         JOIN user_bereiche ub ON ub.bereich_id = b.id
        WHERE ub.user_id = ?
        ORDER BY b.name`
    )
    .all(id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ist_admin: !!user.ist_admin,
    aktiv: !!user.aktiv,
    benachrichtigungen: !!user.benachrichtigungen,
    bereiche,
  };
}

function findByEmail(email) {
  return db
    .prepare(
      'SELECT id, name, email, password_hash, ist_admin, aktiv FROM users WHERE email = ?'
    )
    .get(email);
}

module.exports = { loadUserById, findByEmail };
