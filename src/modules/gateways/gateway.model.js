const mongoose = require('mongoose')
const { gateway_type_enums, GATEWAY_TYPES } = require('../../lib/config')

const gatewaySchema = new mongoose.Schema(
	{
		serial_number: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		gateway_status: {
			type: Boolean,
			default: true,
		},
		gateway_type: {
			type: String,
			required: true,
			enum: GATEWAY_TYPES,
		},
		building_id: {
			type: mongoose.Schema.ObjectId,
			ref: 'Building',
			required: true,
		},
		zone_name: {
			type: String,
			default: '',
			trim: true,
		},
		gateway_alive: {
			type: Boolean,
			default: true,
		},
		lastSeen: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true },
)

gatewaySchema.index({ building_id: 1, gateway_status: 1 })

const Gateway = mongoose.model('Gateway', gatewaySchema)
module.exports = Gateway
