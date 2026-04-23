const mongoose = require('mongoose')
const { NODE_TYPE } = require('../../lib/config')

// ======== Schemas of Model ========== //
const nodeSchema = new mongoose.Schema(
	{
		node_number: {
			type: Number,
			required: true,
		},
		node_type: {
			type: String,
			required: true,
			enum: Object.values(NODE_TYPE),
		},
		door_state: { type: Number, default: 0 },
		battery_state: { type: Number, default: 0 },
		node_status: { type: Boolean, default: true },
		position: { type: String, default: '' },
		angle_x: { type: Number, default: 0 },
		angle_y: { type: Number, default: 0 },
		calibrated_x: { type: Number, default: 0 },
		calibrated_y: { type: Number, default: 0 },
		node_position_img: { type: String, default: '' },
		save_status: { type: Boolean, default: true },
		save_status_lastChange: { type: Date, default: Date.now },
		gateway_id: {
			type: mongoose.Schema.ObjectId,
			ref: 'Gateway',
			default: null,
		},
		node_alive: { type: Boolean, default: true },
		lastSeen: { type: Date, default: null },
	},
	{ timestamps: true },
)

nodeSchema.index({ node_number: 1 }, { unique: true })
nodeSchema.index({ gateway_id: 1, node_type: 1 })

// ============ Exports of schemas ============ //

const NodeSchema = mongoose.model('Node', nodeSchema)
module.exports = NodeSchema
