const mongoose = require('mongoose')
const { COMPANY_MEMBER_TYPES } = require('../../lib/config')

const companySchema = new mongoose.Schema(
	{
		company_name: {
			type: String,
			required: true,
			trim: true,
		},
		company_code: {
			type: String,
			default: '',
			trim: true,
		},
		biz_number: {
			type: String,
			default: '',
			trim: true,
		},
		company_addr: {
			type: String,
			default: '',
			trim: true,
		},
		company_tel: {
			type: String,
			default: '',
		},
		company_email: {
			type: String,
			default: '',
			trim: true,
			lowercase: true,
		},
		company_logo: {
			type: String,
			default: '',
		},
		status: {
			type: Boolean,
			default: true,
		},
		created_by: {
			type: mongoose.Schema.ObjectId,
			ref: 'User',
			default: null,
		},
	},
	{ timestamps: true },
)

const companyMemberSchema = new mongoose.Schema(
	{
		company_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Company',
			required: true,
		},

		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},

		member_role: {
			type: String,
			enum: {
				values: Object.values(COMPANY_MEMBER_TYPES),
				message: '{VALUE} is not permitted for member_role',
			},
			required: true,
		},

		status: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true },
)

companyMemberSchema.index({ company_id: 1, user_id: 1 }, { unique: true })

companySchema.index({ company_name: 1 })
companySchema.index({ status: 1 })

companyMemberSchema.index({ user_id: 1, company_id: 1 }, { unique: true })
companyMemberSchema.index({ user_id: 1, status: 1 })
companyMemberSchema.index({ company_id: 1, status: 1 })

const CompanySchema = mongoose.model('Company', companySchema)
const CompanyMemberSchema = mongoose.model(
	'Company-member',
	companyMemberSchema,
)
module.exports = { CompanySchema, CompanyMemberSchema }
