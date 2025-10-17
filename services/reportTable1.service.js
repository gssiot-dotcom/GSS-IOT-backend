// services/reportTable1.service.js
const path = require('path');
const AdmZip = require('adm-zip');
const mongoose = require('mongoose');

// ⬇ 프로젝트 경로 확인
const AngleNodeHistory = require('../schema/Angle.node.history.model');
const Weather = require('../schema/Weather.model');

const R = (v, n = 2) => (v || v === 0) ? Number(v.toFixed(n)) : '-';

function escapeXml(s) {
  return String(s ?? '-')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function angleGroupStage() {
  return {
    $group: {
      _id: null,
      x_min: { $min: '$angle_x' }, x_max: { $max: '$angle_x' }, x_avg: { $avg: '$angle_x' },
      y_min: { $min: '$angle_y' }, y_max: { $max: '$angle_y' }, y_avg: { $avg: '$angle_y' },
    }
  };
}

// Angle 통계(빌딩 → lookup → doorNums → 기간만 폴백)
async function getAngleStats({ t0, t1, buildingId, doorNums }) {
  const base = { createdAt: { $gte: t0, $lte: t1 } };

  if (buildingId && mongoose.isValidObjectId(buildingId)) {
    const match1 = { ...base, building: new mongoose.Types.ObjectId(buildingId) };
    const [a1] = await AngleNodeHistory.aggregate([{ $match: match1 }, angleGroupStage()]);
    if (a1 && (a1.x_min !== undefined || a1.y_min !== undefined)) return a1;

    try {
      const [a2] = await AngleNodeHistory.aggregate([
        { $match: base },
        { $lookup: { from: 'nodes', localField: 'nodeId', foreignField: '_id', as: 'node' } },
        { $unwind: '$node' },
        { $match: { 'node.building': new mongoose.Types.ObjectId(buildingId) } },
        angleGroupStage(),
      ]);
      if (a2 && (a2.x_min !== undefined || a2.y_min !== undefined)) return a2;
    } catch {}
  }

  if (doorNums && doorNums.length) {
    const match3 = { ...base, doorNum: { $in: doorNums } };
    const [a3] = await AngleNodeHistory.aggregate([{ $match: match3 }, angleGroupStage()]);
    if (a3 && (a3.x_min !== undefined || a3.y_min !== undefined)) return a3;
  }

  const [a4] = await AngleNodeHistory.aggregate([{ $match: base }, angleGroupStage()]);
  return a4 ?? {};
}

// 표1 맵(Weather + Angle)
async function buildTable1Map({ t0, t1, buildingId, doorNums }) {
  const a = await getAngleStats({ t0, t1, buildingId, doorNums });
  const angles = {
    VERT_MIN: R(a?.x_min), VERT_MAX: R(a?.x_max), VERT_AVG: R(a?.x_avg),
    HORZ_MIN: R(a?.y_min), HORZ_MAX: R(a?.y_max), HORZ_AVG: R(a?.y_avg),
  };

  const weatherMatch = { timestamp: { $gte: t0, $lte: t1 } };
  if (buildingId && mongoose.isValidObjectId(buildingId)) {
    weatherMatch.building = new mongoose.Types.ObjectId(buildingId);
  }

  const [aggW] = await Weather.aggregate([
    { $match: weatherMatch },
    {
      $facet: {
        stats: [{
          $group: {
            _id: null,
            t_min: { $min: '$temperature' }, t_max: { $max: '$temperature' }, t_avg: { $avg: '$temperature' },
            h_min: { $min: '$humidity' },    h_max: { $max: '$humidity' },    h_avg: { $avg: '$humidity' },
            w_min: { $min: '$wind_speed' },  w_max: { $max: '$wind_speed' },  w_avg: { $avg: '$wind_speed' },
          }
        }],
        wind_mode: [
          { $group: { _id: '$wind_direction', c: { $sum: 1 } } },
          { $sort: { c: -1 } }, { $limit: 1 }
        ]
      }
    }
  ]);

  const s = aggW?.stats?.[0] || {};
  const weather = {
    TEMP_MIN: R(s.t_min), TEMP_MAX: R(s.t_max), TEMP_AVG: R(s.t_avg),
    HUMID_MIN: R(s.h_min), HUMID_MAX: R(s.h_max), HUMID_AVG: R(s.h_avg),
    WINDSPD_MIN: R(s.w_min), WINDSPD_MAX: R(s.w_max), WINDSPD_AVG: R(s.w_avg),
    WINDDIR_MODE: aggW?.wind_mode?.[0]?._id ?? '-',
  };

  return { ...weather, ...angles };
}

/**
 * HWPX(zip) 치환(메모리 버퍼 반환)
 * - _xmlsignatures/* 제거, [Content_Types].xml / *.rels 정리
 * - 모든 .xml에서 {{KEY}} → escapeXml(value)
 * - 반환: Buffer (파일로 저장하지 않음)
 */
function fillHwpxZipStrictBuffer(templatePath, map) {
  const absTpl = path.resolve(templatePath);

  const src = new AdmZip(absTpl);
  const dst = new AdmZip();
  const REL_SIG_RE = /<Relationship\b[^>]*Type="[^"]*digital-signature[^"]*"[^>]*\/>/g;

  // 1) 복사(_xmlsignatures 제거)
  for (const e of src.getEntries()) {
    const name = e.entryName;
    if (name.startsWith('_xmlsignatures/')) continue;
    dst.addFile(name, e.getData());
  }

  // 2) [Content_Types].xml 정리
  const ctEntry = dst.getEntry('[Content_Types].xml');
  if (ctEntry) {
    let ct = ctEntry.getData().toString('utf8');
    ct = ct.replace(/<Override\b[^>]*PartName="\/_xmlsignatures\/[^"]+"[^>]*\/>/g, '');
    ct = ct.replace(/<Default\b[^>]*Extension="sigs"[^>]*\/>/g, '');
    dst.updateFile('[Content_Types].xml', Buffer.from(ct, 'utf8'));
  }

  // 3) 모든 .rels의 digital-signature 관계 제거
  for (const e of dst.getEntries()) {
    const name = e.entryName;
    if (name.startsWith('_rels/') && name.endsWith('.rels')) {
      const xml = e.getData().toString('utf8');
      const cleaned = xml.replace(REL_SIG_RE, '');
      if (cleaned !== xml) dst.updateFile(name, Buffer.from(cleaned, 'utf8'));
    }
  }

  // 4) 모든 XML에서 {{KEY}} 치환
  for (const e of dst.getEntries()) {
    if (!e.entryName.toLowerCase().endsWith('.xml')) continue;
    let xml = e.getData().toString('utf8');
    for (const [k, v] of Object.entries(map || {})) {
      xml = xml.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), escapeXml(v));
    }
    dst.updateFile(e.entryName, Buffer.from(xml, 'utf8'));
  }

  // 5) Buffer로 반환 (파일 저장 X)
  return dst.toBuffer();
}

module.exports = { buildTable1Map, fillHwpxZipStrictBuffer };
