const express = require('express');
const { upload } = require('../util/uploads');
const ticketService = require('../services/ticketService');
const multer = require('multer');

const router = express.Router();

router.get('/kategorien', (_req, res) => {
  const list = Object.entries(ticketService.KATEGORIEN).map(([key, v]) => ({
    key,
    label: v.label,
    bereich: v.bereich,
  }));
  res.json({
    kategorien: list,
    prioritaeten: ticketService.PRIORITAETEN,
    niederlassungen: ticketService.NIEDERLASSUNGEN,
  });
});

function anhangHandler(req, res, next) {
  upload.single('anhang')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ fehler: 'Anhang zu groß (max. 5 MB)' });
      }
      return res.status(400).json({ fehler: `Upload-Fehler: ${err.message}` });
    }
    if (err) return next(err);
    next();
  });
}

router.post('/', anhangHandler, async (req, res, next) => {
  try {
    const ticket = ticketService.createTicketFromForm(req.body, req.file);
    ticketService.sendPublicNotifications(ticket).catch((e) =>
      console.error('[publicForm] Notifications-Fehler:', e)
    );
    res.status(201).json({
      ok: true,
      ticket_id: ticket.id,
      ticket_kurz_id: ticket.kurzId,
      bereich: ticket.bereich,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
