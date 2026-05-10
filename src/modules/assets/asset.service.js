const path = require('path')
const crypto = require('crypto')
const {
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const { s3Client, s3Bucket } = require('../../config/s3.config')
const { CompanySchema } = require('../../modules/company/company.model')
const { BuildingSchema } = require('../../modules/building/building.model')

const ALLOWED_CONTENT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/svg+xml',
]

function createAppError(message, statusCode = 400) {
	const error = new Error(message)
	error.statusCode = statusCode
	return error
}

function validateImageContentType(contentType) {
	if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
		throw createAppError('Only jpeg, png, webp, svg images are allowed', 400)
	}
}

function getFileExtension(fileName, contentType) {
	const extFromName = path
		.extname(fileName || '')
		.replace('.', '')
		.toLowerCase()

	if (extFromName) return extFromName

	if (contentType === 'image/jpeg') return 'jpg'
	if (contentType === 'image/png') return 'png'
	if (contentType === 'image/webp') return 'webp'
	if (contentType === 'image/svg+xml') return 'svg'

	throw createAppError('Unsupported file extension', 400)
}

function buildS3Key({ kind, companyId, buildingId, fileName, contentType }) {
	const ext = getFileExtension(fileName, contentType)
	const uuid = crypto.randomUUID()

	if (kind === 'companyLogo') {
		return `companies/${companyId}/logo/${uuid}.${ext}`
	}

	if (!buildingId) {
		throw createAppError('buildingId is required for building images', 400)
	}

	if (kind === 'buildingPlanImage') {
		return `companies/${companyId}/buildings/${buildingId}/plan-images/${uuid}.${ext}`
	}

	if (kind === 'buildingRealImage') {
		return `companies/${companyId}/buildings/${buildingId}/real-images/${uuid}.${ext}`
	}

	throw createAppError('Invalid asset kind', 400)
}

function validateKeyPrefix({ kind, companyId, buildingId, key }) {
	if (!key || key.includes('..')) {
		throw createAppError('Invalid S3 key', 400)
	}

	if (kind === 'companyLogo') {
		const prefix = `companies/${companyId}/logo/`

		if (!key.startsWith(prefix)) {
			throw createAppError('Invalid company logo key', 403)
		}

		return
	}

	if (!buildingId) {
		throw createAppError('buildingId is required', 400)
	}

	if (kind === 'buildingPlanImage') {
		const prefix = `companies/${companyId}/buildings/${buildingId}/plan-images/`

		if (!key.startsWith(prefix)) {
			throw createAppError('Invalid building plan image key', 403)
		}

		return
	}

	if (kind === 'buildingRealImage') {
		const prefix = `companies/${companyId}/buildings/${buildingId}/real-images/`

		if (!key.startsWith(prefix)) {
			throw createAppError('Invalid building real image key', 403)
		}

		return
	}

	throw createAppError('Invalid asset kind', 400)
}

async function createPresignedPutUrl(payload) {
	const { contentType } = payload

	validateImageContentType(contentType)

	const key = buildS3Key(payload)

	const command = new PutObjectCommand({
		Bucket: s3Bucket,
		Key: key,
		ContentType: contentType,
	})

	const uploadUrl = await getSignedUrl(s3Client, command, {
		expiresIn: Number(process.env.S3_PUT_EXPIRES_SECONDS || 300),
	})

	return {
		bucket: s3Bucket,
		key,
		uploadUrl,
		method: 'PUT',
		headers: {
			'Content-Type': contentType,
		},
	}
}

async function createPresignedGetUrl(key) {
	if (!key || key.includes('..')) {
		throw createAppError('Invalid S3 key', 400)
	}

	const command = new GetObjectCommand({
		Bucket: s3Bucket,
		Key: key,
	})

	const url = await getSignedUrl(s3Client, command, {
		expiresIn: Number(process.env.S3_GET_EXPIRES_SECONDS || 900),
	})

	return { url }
}

async function saveAssetToDb({ kind, companyId, buildingId, key }) {
	validateKeyPrefix({ kind, companyId, buildingId, key })

	if (kind === 'companyLogo') {
		const company = await CompanySchema.findByIdAndUpdate(
			companyId,
			{ $set: { companyLogo: key } },
			{ new: true },
		)

		if (!company) {
			throw createAppError('Company not found', 404)
		}

		return company
	}

	const building = await BuildingSchema.findOne({
		_id: buildingId,
		companyId,
	})

	if (!building) {
		throw createAppError('Building not found', 404)
	}

	if (kind === 'buildingPlanImage') {
		if (building.buildingPlanImage.length >= 4) {
			throw createAppError('Maximum 4 plan images are allowed', 400)
		}

		if (!building.buildingPlanImage.includes(key)) {
			building.buildingPlanImage.push(key)
		}
	}

	if (kind === 'buildingRealImage') {
		if (building.buildingRealImage.length >= 4) {
			throw createAppError('Maximum 4 real images are allowed', 400)
		}

		if (!building.buildingRealImage.includes(key)) {
			building.buildingRealImage.push(key)
		}
	}

	await building.save()

	return building
}

async function removeAssetFromDb({ kind, companyId, buildingId, key }) {
	validateKeyPrefix({ kind, companyId, buildingId, key })

	if (kind === 'companyLogo') {
		const company = await CompanySchema.findByIdAndUpdate(
			companyId,
			{ $set: { companyLogo: null } },
			{ new: true },
		)

		if (!company) {
			throw createAppError('Company not found', 404)
		}

		return company
	}

	const building = await BuildingSchema.findOne({
		_id: buildingId,
		companyId,
	})

	if (!building) {
		throw createAppError('Building not found', 404)
	}

	if (kind === 'buildingPlanImage') {
		building.buildingPlanImage = building.buildingPlanImage.filter(
			item => item !== key,
		)
	}

	if (kind === 'buildingRealImage') {
		building.buildingRealImage = building.buildingRealImage.filter(
			item => item !== key,
		)
	}

	await building.save()

	return building
}

async function deleteObjectFromS3(key) {
	if (!key || key.includes('..')) {
		throw createAppError('Invalid S3 key', 400)
	}

	const command = new DeleteObjectCommand({
		Bucket: s3Bucket,
		Key: key,
	})

	await s3Client.send(command)

	return { deleted: true }
}

module.exports = {
	createPresignedPutUrl,
	createPresignedGetUrl,
	saveAssetToDb,
	removeAssetFromDb,
	deleteObjectFromS3,
}
