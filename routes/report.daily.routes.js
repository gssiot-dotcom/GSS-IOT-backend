// routes/report.daily.routes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { buildDailyHwpxBuffer } = require('../services/reportDailyCombined.service');

// (프로젝트 스키마 경로/필드에 맞게 조정하세요)
let Building = null;
let Company  = null;
try { Building = require('../schema/Building.model'); } catch {}
try { Company  = require('../schema/Company.model'); } catch {}

const router = express.Router();

/** ===== 날짜 유틸 ===== */
const parseDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const fmtYMD     = (d, sep='-') => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return [yyyy, mm, dd].join(sep);
};
const fmtDotDate = (d) => fmtYMD(d, '.'); // YYYY.MM.DD
const safe = (s) => (s || '').toString().replace(/[\\/:*?"<>|]/g, '_').trim();

/**
 * GET /api/reports/daily-hwpx
 * 파라미터:
 * - date=YYYY-MM-DD                : 단일일
 * - start=YYYY-MM-DD&end=YYYY-MM-DD: 기간(하루도 가능)
 * - (레거시) ?2025-10-13           : 키 없는 날짜 → start로 간주
 * - zones=B-1,B-2,...
 * - buildingId=<id>
 * - doorNums=1,2,3
 * - template=/abs/or/rel/path.hwpx
 */
router.get('/daily-hwpx', async (req, res) => {
  try {
    const { zones: zonesParam, buildingId, doorNums, template } = req.query;

    /** ===== 날짜 파싱 (현행 + 구버전 모두 지원) ===== */
    let { date, start, end } = req.query;

    // 레거시: ?2025-10-13 형태(다른 파라미터와 함께 있어도 감지)
    const legacyKeys = Object.keys(req.query).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
    if (legacyKeys.length > 0 && !date && !start) {
      start = legacyKeys[0];
    }

    // 최종 집계 범위 t0~t1 확정
    let t0, t1;
    if (date) {
      const d = parseDate(date) || new Date();
      t0 = startOfDay(d);
      t1 = endOfDay(d);
    } else if (start || end) {
      // 하나만 있으면 없는 쪽을 있는 쪽으로 보정
      const s = parseDate(start) || parseDate(end) || new Date();
      const e = parseDate(end)   || parseDate(start) || s;
      // 순서 뒤집힘 방지
      const s0 = startOfDay(s), e0 = endOfDay(e);
      if (s0 <= e0) { t0 = s0; t1 = e0; }
      else { t0 = startOfDay(e); t1 = endOfDay(s); }
    } else {
      const today = new Date();
      t0 = startOfDay(today);
      t1 = endOfDay(today);
    }

    /** ===== 회사/빌딩 이름 조회 ===== */
    let buildingName = '';
    let companyName  = '';
    if (buildingId && Building) {
      const b = await Building.findById(buildingId).lean().catch(() => null);
      if (b) {
        buildingName = b.building_name || b.name || '';
        const cid = b.company_id || b.company || b.companyId;
        if (Company && cid) {
          const c = await Company.findById(cid).lean().catch(() => null);
          if (c) companyName = c.company_name || c.name || '';
        }
        if (!companyName && (b.company_name || b.companyName)) {
          companyName = b.company_name || b.companyName;
        }
      }
    }

    /** ===== 구역 파라미터 ===== */
    const zones = (zonesParam || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    /** ===== 템플릿 경로 확인 ===== */
    const templatePath = template
      ? path.resolve(template)
      : path.join(process.cwd(), 'REPORT_TEMPLATES', 'daily_report.hwpx');

    if (!fs.existsSync(templatePath)) {
      return res.status(400).json({
        message: '템플릿 파일을 찾을 수 없습니다.',
        hint: `파일을 여기에 두세요: ${templatePath}`,
      });
    }

    /** ===== 헤더 치환맵 (회사/빌딩/날짜 등) =====
     * 템플릿 키:
     *  {{COMPANY_NAME}}
     *  {{BUILDING_NAME}}
     *  {{REPORT_DATE}}       // 단일일: YYYY.MM.DD
     *  {{REPORT_DATE_RANGE}} // 기간:   YYYY.MM.DD ~ YYYY.MM.DD
     */
    const isSingleDay = fmtYMD(t0) === fmtYMD(t1);
    const headerMap = {
      COMPANY_NAME: companyName || '-',
      BUILDING_NAME: buildingName || '-',
      REPORT_DATE: fmtDotDate(t0),
      REPORT_DATE_RANGE: isSingleDay
        ? fmtDotDate(t0)
        : `${fmtDotDate(t0)} ~ ${fmtDotDate(t1)}`,
    };

    /** ===== HWPX 버퍼 생성 (extraMap 병합) ===== */
    const buf = await buildDailyHwpxBuffer({
      t0,
      t1,
      buildingId: buildingId || undefined,
      doorNums: doorNums
        ? doorNums.split(',').map((n) => Number(n)).filter(Number.isFinite)
        : undefined,
      zones: zones.length ? zones : undefined,
      templatePath,
      extraMap: headerMap,
    });

    /** ===== 파일명(범위 표시 지원) ===== */
    const namePart = safe(buildingName) || safe(companyName) || '보고서';
    const ymdStart = fmtYMD(t0);
    const ymdEnd   = fmtYMD(t1);
    const filename = (ymdStart === ymdEnd)
      ? `보고서_${namePart}_${ymdStart}.hwpx`
      : `보고서_${namePart}_${ymdStart}~${ymdEnd}.hwpx`;

    res.setHeader('Content-Type', 'application/zip'); // HWPX는 zip 포맷
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURI(filename)}"`);
    return res.send(buf);
  } catch (e) {
    console.error('[GET /api/reports/daily-hwpx] error:', e);
    return res.status(500).json({
      message: '보고서 생성 실패',
      error: String(e),
    });
  }
});

module.exports = router;
