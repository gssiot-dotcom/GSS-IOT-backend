// realtime/calibrationCache.js
const {
	AngleNodeCalibration,
} = require('../modules/nodes/angle-node/angleNode.model')
const { TTLCache } = require('../utils/TTLCache')

// offset cache: 5 minut ushlab turamiz
const calibCache = new TTLCache({ ttlMs: 5 * 60 * 1000, max: 50000 })

// stampede (bir vaqtning o'zida ko'p refresh bo'lib ketmasin)
const inflight = new Map()

function makeKey(doorNum, buildingId) {
	// ⚠️ agar doorNum global unique bo'lmasa:
	// return `${buildingId || 'na'}:${String(doorNum)}`
	return String(doorNum)
}

function getCalibrationOffsetCache(doorNum, buildingId) {
	return calibCache.get(makeKey(doorNum, buildingId))
}

// persist finalize bo'lganda shu bilan cache'ni yangilaymiz
function setCalibrationOffsetCache(doorNum, offsetX, offsetY, opts = {}) {
	const { buildingId, applied = true, ttlMs } = opts
	calibCache.set(
		makeKey(doorNum, buildingId),
		{ applied, offsetX: Number(offsetX ?? 0), offsetY: Number(offsetY ?? 0) },
		ttlMs,
	)
}

// 🔥 HOT PATH uchun: faqat cache o'qiydi, DB yo'q
function getCalibratedFromCache(doorNum, rawX, rawY, buildingId) {
	const entry = getCalibrationOffsetCache(doorNum, buildingId)

	const ox = entry?.applied ? Number(entry.offsetX ?? 0) : 0
	const oy = entry?.applied ? Number(entry.offsetY ?? 0) : 0

	let calibratedX = Number(rawX ?? 0) - ox
	let calibratedY = Number(rawY ?? 0) - oy

	calibratedX = parseFloat(calibratedX.toFixed(2))
	calibratedY = parseFloat(calibratedY.toFixed(2))

	return {
		calibratedX,
		calibratedY,
		cacheHit: !!entry,
		offsetX: ox,
		offsetY: oy,
	}
}

// Background (persistQueue ichida ishlatish uchun):
// cache miss bo'lsa DB'dan applied offset'ni olib cache'ga qo'yadi.
// Hot path'da buni chaqirmaymiz.
async function refreshCalibrationOffsetFromDb(doorNum, buildingId) {
	const key = makeKey(doorNum, buildingId)
	const cached = calibCache.get(key)
	if (cached) return cached

	if (inflight.has(key)) return inflight.get(key)

	const p = (async () => {
		const doc = await AngleNodeCalibration.findOne({ doorNum })
			.select('applied offsetX offsetY collecting sampleCount sampleTarget')
			.lean()

		if (!doc) {
			// negative cache: 30s (DB'ga qayta-qayta urilmasin)
			setCalibrationOffsetCache(doorNum, 0, 0, {
				buildingId,
				applied: false,
				ttlMs: 30_000,
			})
			return { applied: false, offsetX: 0, offsetY: 0 }
		}

		if (doc.applied) {
			setCalibrationOffsetCache(doorNum, doc.offsetX ?? 0, doc.offsetY ?? 0, {
				buildingId,
				applied: true,
			})
			return {
				applied: true,
				offsetX: doc.offsetX ?? 0,
				offsetY: doc.offsetY ?? 0,
			}
		}

		// collecting/na holat: offset yo'q — lekin baribir qisqa TTL bilan saqlaymiz
		setCalibrationOffsetCache(doorNum, 0, 0, {
			buildingId,
			applied: false,
			ttlMs: 30_000,
		})
		return { applied: false, offsetX: 0, offsetY: 0 }
	})().finally(() => inflight.delete(key))

	inflight.set(key, p)
	return p
}

module.exports = {
	getCalibratedFromCache,
	getCalibrationOffsetCache,
	setCalibrationOffsetCache,
	refreshCalibrationOffsetFromDb,
}
