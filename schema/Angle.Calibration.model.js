// schema/Angle.Calibration.model.js
const mongoose = require('mongoose');

const angleCalibrationSchema = new mongoose.Schema(
  {
    doorNum: { type: Number, required: true, unique: true, index: true },

    // 보정값
    applied: { type: Boolean, default: false },
    offsetX: { type: Number, default: 0 },
    offsetY: { type: Number, default: 0 },
    appliedAt: { type: Date, default: null },
    note: { type: String, default: '' },

    // ✅ 수집 상태 (엔드포인트로 트리거)
    collecting: { type: Boolean, default: false },   // 수집 중 여부
    sampleTarget: { type: Number, default: 5 },      // 목표 개수(기본 5)
    sampleCount: { type: Number, default: 0 },       // 현재 수집 개수
    sumX: { type: Number, default: 0 },              // 합계(평균 계산용)
    sumY: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AngleCalibration', angleCalibrationSchema);
