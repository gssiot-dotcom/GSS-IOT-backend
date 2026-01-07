const mongoose = require('mongoose')
const { Schema } = mongoose

const VerticalNodeHistorySchema = new Schema(
	{
		node_number: { type: Number, required: true },
		angle_x: { type: Number, required: true },
		angle_y: { type: Number, required: true },
		gw_number: { type: Number, required: true },
	},
	{ timestamps: true }
)

const VerticalNodeHistory = mongoose.model(
	'VerticalNodeHistory',
	VerticalNodeHistorySchema
)

module.exports = VerticalNodeHistory
