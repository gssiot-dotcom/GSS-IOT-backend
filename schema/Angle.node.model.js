const mongoose = require('mongoose')

const angleNodeSchema = new mongoose.Schema(
  {
    doorNum: {
      type: Number,
      required: true,
      index: { unique: true, sparse: true }, // 유니크 인덱스
    },
    // ✅ 센서 원본(raw) 값
    angle_x: { type: Number, default: 0 },
    angle_y: { type: Number, default: 0 },

    // ✅ 보정(calibrated) 값
    calibrated_x: { type: Number, default: 0 },
    calibrated_y: { type: Number, default: 0 },

    angle_node_img: { type: String, default: '' },
    save_status: { type: Boolean, default: true }, // 값을 저장할지 말지 판별해주는 컬럼 추가
    save_status_lastSeen: { type: Date, default: null }, // save_status가 마지막으로 변경된 시각
    node_status: { type: Boolean, default: true }, // 게이트웨이에 할당할 수 있는지 보여주는 컬럼
    position: { type: String, default: '' },
    

    gateway_id: {
      type: mongoose.Schema.ObjectId,
      default: null,
      ref: 'Gateway',
    },

    node_alive: { type: Boolean, default: true },
    lastSeen: { type: Date, default: null },
  },
  { timestamps: true }
)

const AngleNodeSchema = mongoose.model('Angle-Node', angleNodeSchema)
module.exports = AngleNodeSchema
