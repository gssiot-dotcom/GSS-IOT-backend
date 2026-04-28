const { default: mongoose } = require('mongoose')

const buildingSchema = new mongoose.Schema(
	{
		building_name: {
			type: String,
			required: true,
			trim: true,
		},
		building_num: {
			type: Number,
			default: null,
		},
		building_addr: {
			type: String,
			required: true,
			trim: true,
		},
		building_plan_img: {
			type: String,
			default: '',
		},
		building_status: {
			type: Boolean,
			default: true,
		},
		permit_date: {
			type: Date,
			default: null,
		},
		expiry_date: {
			type: Date,
			default: null,
		},
		company_id: {
			type: mongoose.Schema.ObjectId,
			ref: 'Company',
			required: false,
			default: null,
		},
		angle_alarm_level: {
			blue: { type: Number, default: 0 },
			green: { type: Number, default: 0 },
			yellow: { type: Number, default: 0 },
			red: { type: Number, default: 0 },
		},
		gangform_alarm_level: {
			blue: { type: Number, default: 0 },
			green: { type: Number, default: 0 },
			yellow: { type: Number, default: 0 },
			red: { type: Number, default: 0 },
		},
	},
	{ timestamps: true },
)

const buildingMemberSchema = new mongoose.Schema(
	{
		company_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Company',
			required: true,
		},

		building_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Building',
			required: true,
		},

		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},

		status: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true },
)

buildingMemberSchema.index(
	{ company_id: 1, building_id: 1, user_id: 1 },
	{ unique: true },
)

buildingSchema.index({ company_id: 1, building_status: 1 })
buildingSchema.index({ company_id: 1, building_name: 1 })

const BuildingSchema = mongoose.model('Building', buildingSchema)
const BuildingWorkerSchema = mongoose.model(
	'Building-worker',
	buildingMemberSchema,
)

module.exports = { BuildingSchema, BuildingWorkerSchema }
