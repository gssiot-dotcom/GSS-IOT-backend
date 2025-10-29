// routes/report.nodes.csv.routes.js
const express = require('express');
const router = express.Router();
const {
  nodesCsvHandler,
  nodesHistoriesCsvHandler,
} = require('../services/reportNodesCsv.service');

// 두 URL 모두 동일 포맷(요청 포맷)으로 응답
router.get('/buildings/:buildingId/nodes.csv', nodesCsvHandler);

module.exports = router;
