// services/reportTableZones.service.js
const AngleNode = require('../schema/Angle.node.model');                // Angle-Node
const AngleNodeHistory = require('../schema/Angle.node.history.model'); // AngleNodeHistory

// 템플릿 기본 구역(표 순서)
const DEFAULT_ZONES = [
  'B-1','B-2','B-3a','B-3b/A-1a','A-4a','A-4b','A-2a','A-2b','A-1b'
];

// 특수문자 이스케이프
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// “B-3b/A-1a” 같이 합친 라벨은 OR 정규식으로 처리
function zoneToRegex(zoneLabel) {
  if (zoneLabel.includes('/')) {
    const parts = zoneLabel.split('/').map(s => s.trim()).filter(Boolean).map(esc);
    return new RegExp(`(${parts.join('|')})`, 'i');
  }
  return new RegExp(esc(zoneLabel), 'i');
}

async function aggByHistoryPosition(regex, timeRange) {
  const match = { position: { $regex: regex } };
  if (timeRange?.t0 && timeRange?.t1) match.createdAt = { $gte: timeRange.t0, $lte: timeRange.t1 };

  const [r] = await AngleNodeHistory.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        x_min: { $min: '$angle_x' }, x_max: { $max: '$angle_x' }, x_avg: { $avg: '$angle_x' },
        y_min: { $min: '$angle_y' }, y_max: { $max: '$angle_y' }, y_avg: { $avg: '$angle_y' },
      }
    }
  ]);
  return r;
}

async function aggByDoorNums(doorNums, timeRange) {
  if (!doorNums?.length) return null;
  const match = { doorNum: { $in: doorNums } };
  if (timeRange?.t0 && timeRange?.t1) match.createdAt = { $gte: timeRange.t0, $lte: timeRange.t1 };

  const [r] = await AngleNodeHistory.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        x_min: { $min: '$angle_x' }, x_max: { $max: '$angle_x' }, x_avg: { $avg: '$angle_x' },
        y_min: { $min: '$angle_y' }, y_max: { $max: '$angle_y' }, y_avg: { $avg: '$angle_y' },
      }
    }
  ]);
  return r;
}

/** 구역 라벨 → 템플릿 키 세트 */
function toKeys(zoneLabel, stats) {
  const zKey = zoneLabel.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const fmt = (v) => (v || v === 0) ? Number(Number(v).toFixed(3)) : '-';
  return {
    [`Z_${zKey}_X_MIN`]: fmt(stats?.x_min),
    [`Z_${zKey}_X_MAX`]: fmt(stats?.x_max),
    [`Z_${zKey}_X_AVG`]: fmt(stats?.x_avg),
    [`Z_${zKey}_Y_MIN`]: fmt(stats?.y_min),
    [`Z_${zKey}_Y_MAX`]: fmt(stats?.y_max),
    [`Z_${zKey}_Y_AVG`]: fmt(stats?.y_avg),
    [`Z_${zKey}_N`]: stats?.count ?? 0,
  };
}

/**
 * 구역 표 맵 생성
 * @param {Object} p
 * @param {Date}   p.t0, p.t1
 * @param {String} [p.buildingId]
 * @param {Array}  [p.zones]  // 미지정 시 DEFAULT_ZONES
 * @returns {Object} { Z_B_1_X_MIN: ..., Z_B_1_Y_MAX: ..., ... }
 */
async function buildZonesMap({ t0, t1, buildingId, zones = DEFAULT_ZONES }) {
  const timeRange = (t0 && t1) ? { t0, t1 } : null;
  const out = {};

  for (const zone of zones) {
    const regex = zoneToRegex(zone);

    // 1) History.position 부분일치
    let stats = await aggByHistoryPosition(regex, timeRange);

    // 2) 없으면 Angle-Node.position에서 doorNum으로 fallback
    if (!stats || !stats.count) {
      const nodes = await AngleNode.find({ position: { $regex: regex } }, { doorNum: 1, _id: 0 }).lean();
      const doorNums = nodes.map(n => n.doorNum);
      stats = await aggByDoorNums(doorNums, timeRange);
    }

    Object.assign(out, toKeys(zone, stats || null));
  }

  return out;
}

module.exports = { buildZonesMap, DEFAULT_ZONES };
