const mongoose = require('mongoose')

// ======== Schemas of Model ========== //

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

const AngleNodeHistorySchema = new mongoose.Schema({
	gw_number: {
		type: String,
		required: true,
	},
	doorNum: {
		type: Number,
		required: true,
	},
	angle_x: {
		type: Number,
		required: true,
	},
	angle_y: {
		type: Number,
		required: false,
		default: 0,
	},
	gw_position: {
		type: String,
		required: false,
		default: '',
	},
	node_position: {
		type: String,
		required: false,
		default: '',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
})

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
		collecting: { type: Boolean, default: false }, // 수집 중 여부
		sampleTarget: { type: Number, default: 5 }, // 목표 개수(기본 5)
		sampleCount: { type: Number, default: 0 }, // 현재 수집 개수
		sumX: { type: Number, default: 0 }, // 합계(평균 계산용)
		sumY: { type: Number, default: 0 },
		startedAt: { type: Date, default: null },
	},
	{ timestamps: true }
)

// ============ Exports of schemas ============ //

const AngleNode = mongoose.model('AngleNode', angleNodeSchema)
const AngleNodeHistory = mongoose.model(
	'AngleNodeHistory',
	AngleNodeHistorySchema
)
const AngleNodeCalibration = mongoose.model(
	'AngleCalibration',
	angleCalibrationSchema
)

module.exports = { AngleNode, AngleNodeHistory, AngleNodeCalibration }
