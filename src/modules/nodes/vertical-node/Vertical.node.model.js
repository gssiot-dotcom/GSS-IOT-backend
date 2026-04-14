const mongoose = require('mongoose')
const { Schema } = mongoose

const VerticalSchema = new Schema(
	{
		node_number: { type: Number, required: true, unique: true },
		angle_x: { type: Number, default: 0 },
		angle_y: { type: Number, default: 0 },
		gateway_id: {
			type: Schema.Types.ObjectId,
			ref: 'Gateway',
			default: null,
			// index: true, // yoki pastda alohida index
		},
		node_status: { type: Boolean, default: true },
		position: { type: String, default: '' },
		floor: { type: String, default: '' },
	},
	{ timestamps: true },
)

// agar yuqorida index: true yozmasang
VerticalSchema.index({ gateway_id: 1 })

const VerticalNode = mongoose.model('Vertical-Node', VerticalSchema)

// =========== VerticalNode-History Model =========== //
const VerticalNodeHistorySchema = new Schema(
	{
		node_number: { type: Number, required: true },
		angle_x: { type: Number, required: true },
		angle_y: { type: Number, required: true },
		gw_number: { type: Number, required: true },
	},
	{ timestamps: true },
)

const VerticalNodeAlertLogSchema = new Schema({
	buildingId: { type: Schema.Types.ObjectId, ref: 'Building', required: true },
	gatewayId: { type: Schema.Types.ObjectId, ref: 'Gateway', required: true },
	node_number: { type: Number, required: true },
	level: { type: String, required: true },
	metric: { type: String, required: true },
	value: { type: Number, required: true },
})

const VerticalNodeAlertLog = mongoose.model(
	'VerticalNodeAlertLog',
	VerticalNodeAlertLogSchema,
)

const VerticalNodeHistory = mongoose.model(
	'VerticalNodeHistory',
	VerticalNodeHistorySchema,
)

module.exports = { VerticalNode, VerticalNodeHistory, VerticalNodeAlertLog }
