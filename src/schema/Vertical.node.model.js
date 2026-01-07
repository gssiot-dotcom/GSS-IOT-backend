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
	},
	{ timestamps: true }
)

// agar yuqorida index: true yozmasang
VerticalSchema.index({ gateway_id: 1 })

const VerticalNode = mongoose.model('VerticalNode', VerticalSchema)

module.exports = VerticalNode
