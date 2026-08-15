const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { computeAnalytics } = require('../services/analytics');
const { analyticsWorkbook } = require('../services/exportExcel');

const router = express.Router();
router.use(requireLogin);

router.get('/', (req, res, next) => {
  try {
    res.json(computeAnalytics(req.user, req.query));
  } catch (err) {
    next(err);
  }
});

router.get('/export.xlsx', async (req, res, next) => {
  try {
    const { workbook, filename } = await analyticsWorkbook(req.user, req.query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
