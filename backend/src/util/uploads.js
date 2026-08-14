const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { uuid } = require('./uuid');

fs.mkdirSync(config.paths.uploads, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.paths.uploads),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
    cb(null, `${uuid()}${ext.replace(/[^.a-z0-9]/g, '')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploadMaxBytes, files: 1 },
});

module.exports = { upload };
