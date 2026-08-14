function notFound(req, res) {
  res.status(404).json({ fehler: 'Nicht gefunden' });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ fehler: err.publicMessage || err.message || 'Serverfehler' });
}

module.exports = { notFound, errorHandler };
