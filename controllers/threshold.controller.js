const { Threshold, Building } = require('../schema/Threshold.model')

// 기준치 등록 (단건/배열 모두 허용)
exports.createThreshold = async (req, res, next) => {
  try {
    const payload = req.body
    const docs = Array.isArray(payload) ? payload : [payload]
    if (!docs.length) return res.status(400).json({ message: '빈 payload 입니다.' })
    if (!docs[0].building) return res.status(400).json({ message: 'building 필드가 필요합니다.' })

    const building = await Building.findById(docs[0].building).lean()
    if (!building) return res.status(404).json({ message: '존재하지 않는 빌딩입니다.' })

    const created = await Threshold.insertMany(docs)
    res.status(201).json({ count: created.length, data: created })
  } catch (err) {
    // pre('save') 순서 검증 실패 등 에러 핸들링
    next(err)
  }
}

// 목록 조회: 빌딩/시간/페이징
exports.getThresholdList = async (req, res, next) => {
  try {
    const {
      buildingId,
      from,
      to,
      page = 1,
      limit = 20,
      sort = '-timestamp',
    } = req.query

    const q = {}
    if (buildingId) q.building = buildingId
    if (from || to) {
      q.timestamp = {}
      if (from) q.timestamp.$gte = new Date(from)
      if (to) q.timestamp.$lte = new Date(to)
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [items, total] = await Promise.all([
      Threshold.find(q).sort(sort).skip(skip).limit(Number(limit)).lean(),
      Threshold.countDocuments(q),
    ])

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      data: items,
    })
  } catch (err) {
    next(err)
  }
}

// 최신 기준치 1건(빌딩별)
exports.getLatestThreshold = async (req, res, next) => {
  try {
    const { buildingId } = req.query
    if (!buildingId) return res.status(400).json({ message: 'buildingId가 필요합니다.' })

    const doc = await Threshold.findOne({ building: buildingId })
      .sort('-timestamp')
      .lean()

    if (!doc) return res.status(404).json({ message: '해당 빌딩의 기준치가 없습니다.' })
    res.json(doc)
  } catch (err) {
    next(err)
  }
}
