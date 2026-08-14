const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { computeAnalytics } = require('../services/analytics');

const router = express.Router();
router.use(requireLogin);

router.get('/', (req, res, next) => {
  try {
    res.json(computeAnalytics(req.user, req.query));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
