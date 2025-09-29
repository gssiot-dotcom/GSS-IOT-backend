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
    node_status: { type: Boolean, default: true }, // true means available
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
