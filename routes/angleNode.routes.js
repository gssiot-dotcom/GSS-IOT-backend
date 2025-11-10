// routes/angleNode.routes.js
const express = require('express')
const router = express.Router()

// ⚠️ 경로는 프로젝트 구조에 맞춰 조정하세요.
// 예: '../schema/Angle.node.model' 또는 '../models/Angle.node.model'
const AngleNode = require('../schema/Angle.node.model')

// ✅ 공통: 정수 도어번호 파싱
function toDoorNum(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

/**
 * GET /api/angle-nodes/alive
 * 전체/필터 기준 node_alive 목록 조회
 *   - 쿼리:
 *       gateway_id: 특정 게이트웨이 ObjectId 필터 (옵션)
 *       alive: true|false (옵션, 생존 여부 필터)
 *       doorNums: "1,2,3" (옵션, 특정 도어번호들만)
 *   - 응답: [{ doorNum, node_alive, lastSeen, updatedAt, save_status, save_status_lastSeen }]
 */
router.get('/alive', async (req, res) => {
  try {
    const { gateway_id, alive, doorNums } = req.query
    const q = {}

    if (gateway_id) q.gateway_id = gateway_id
    if (alive === 'true') q.node_alive = true
    if (alive === 'false') q.node_alive = false

    if (doorNums) {
      const list = String(doorNums)
        .split(',')
        .map(s => toDoorNum(s.trim()))
        .filter(n => n !== null)
      if (list.length > 0) q.doorNum = { $in: list }
    }

    const rows = await AngleNode.find(q)
      .select('doorNum node_alive lastSeen updatedAt save_status save_status_lastSeen')
      .sort({ doorNum: 1 })
      .lean()

    // save_status가 없는 문서는 기본 true로 보이도록 정규화
    const normalized = rows.map(r => ({
      ...r,
      save_status: (r.save_status === undefined ? true : r.save_status),
    }))

    res.json(normalized)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch node_alive list' })
  }
})

/**
 * GET /api/angle-nodes/:doorNum/alive
 * 단일 도어번호의 node_alive 상태 조회
 *   - 응답: { doorNum, node_alive, lastSeen, updatedAt, save_status, save_status_lastSeen }
 */
router.get('/:doorNum/alive', async (req, res) => {
  try {
    const doorNum = toDoorNum(req.params.doorNum)
    if (doorNum === null) {
      return res.status(400).json({ message: 'Invalid doorNum' })
    }

    const doc = await AngleNode.findOne({ doorNum })
      .select('doorNum node_alive lastSeen updatedAt save_status save_status_lastSeen')
      .lean()

    if (!doc) {
      return res.status(404).json({ message: 'Angle node not found' })
    }

    // save_status가 없는 문서는 기본 true로 보이도록 정규화
    const normalized = {
      ...doc,
      save_status: (doc.save_status === undefined ? true : doc.save_status),
    }

    res.json(normalized)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch node_alive' })
  }
})

module.exports = router
