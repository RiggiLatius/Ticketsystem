const { randomUUID } = require('crypto');

function uuid() {
  return randomUUID();
}

function shortId(id) {
  return String(id).replace(/-/g, '').slice(0, 8);
}

module.exports = { uuid, shortId };
