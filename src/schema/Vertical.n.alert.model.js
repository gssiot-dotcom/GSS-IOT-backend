const mongoose = require('mongoose')
const { Schema } = mongoose

const VerticalNodeAlertLogSchema = new Schema({
	buildingId: { type: Schema.Types.ObjectId, ref: 'Building', required: true },
	gatewayId: { type: Schema.Types.ObjectId, ref: 'Gateway', required: true },
	node_number: { type: Number, required: true },
	level: { type: String, required: true },
	metric: { type: String, required: true },
	value: { type: Number, required: true },
})

module.exports = mongoose.model(
	'VerticalNodeAlertLog',
	VerticalNodeAlertLogSchema
)
