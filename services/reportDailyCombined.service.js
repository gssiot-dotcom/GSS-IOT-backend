// services/reportDailyCombined.service.js
const path = require('path');
const { buildTable1Map, fillHwpxZipStrictBuffer } = require('./reportTable1.service'); // 기존 표1(날씨+각도) 유틸
const { buildZonesMap, DEFAULT_ZONES } = require('./reportTableZones.service');

/**
 * 일일 보고서(표1 + 구역 표) 맵 병합 후 .hwpx 버퍼 생성
 * - templatePath: REPORT_TEMPLATES/daily_report.hwpx ({{KEY}} 자리표시자 포함)
 */
async function buildDailyHwpxBuffer({
  t0, t1, buildingId, doorNums,
  zones = DEFAULT_ZONES,
  templatePath = path.join(process.cwd(), 'REPORT_TEMPLATES', 'daily_report.hwpx'),
}) {
  // 표1(날씨+전체 각도)
  const table1Map = await buildTable1Map({ t0, t1, buildingId, doorNums });
  // 구역 표
  const zonesMap = await buildZonesMap({ t0, t1, buildingId, zones });

  const merged = { ...table1Map, ...zonesMap };
  const buf = fillHwpxZipStrictBuffer(templatePath, merged);
  return buf;
}

module.exports = { buildDailyHwpxBuffer };
