const { Schema, model, models } = require('mongoose')
const { USER_TYPES } = require('../../lib/config')

const userSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},
		phone: {
			type: String,
			default: '',
		},
		password: {
			type: String,
			required: true,
		},
		user_type: {
			type: String,
			enum: {
				values: USER_TYPES,
				message: '{VALUE} is not among permitted user type',
			},
			required: true,
		},
		status: {
			type: Boolean,
			default: true,
		},
		last_selected_company_id: {
			type: Schema.ObjectId,
			ref: 'Company',
			default: null,
		},
	},
	{ timestamps: true },
)

userSchema.index({ user_type: 1, status: 1 })

const otpSchema = new Schema({
	user_email: {
		type: String,
		required: true,
	},
	otp: {
		type: Number,
		required: true,
	},
	expiresAt: {
		type: Date,
		required: true,
	},
})

const OtpSchema = model('Otp', otpSchema)
const UserSchema = model('User', userSchema)

module.exports = { UserSchema, OtpSchema }
