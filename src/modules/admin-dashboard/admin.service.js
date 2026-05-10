const {
	CompanySchema,
	CompanyMemberSchema,
} = require('../company/company.model')
const {
	BuildingSchema,
	BuildingWorkerSchema,
	BuildingAlarmLevelSchema,
} = require('../building/building.model')
const GatewaySchema = require('../gateways/gateway.model')
const NodeSchema = require('../nodes/node.model')
const {
	COMPANY_STATUS,
	COMPANY_MEMBER_TYPES,
	MEMBER_STATUS,
	BUILDING_STATUS,
} = require('../../lib/config')
const { buildPaginationMeta } = require('../../utils/pagination')
const { default: mongoose } = require('mongoose')
const { UserSchema } = require('../users/user.model')
const bcrypt = require('bcryptjs')

class AdminDashboardService {
	constructor() {
		this.userSchema = UserSchema
		this.companySchema = CompanySchema
		this.companyMemberSchema = CompanyMemberSchema
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.gatewaySchema = GatewaySchema
		this.nodeSchema = NodeSchema
		this.alarmLevelSchema = BuildingAlarmLevelSchema
	}

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	createPaginationMeta({ total, page, limit }) {
		return {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
			hasNextPage: page < Math.ceil(total / limit),
			hasPrevPage: page > 1,
		}
	}

	async getAdminDashboard({ page = 1, limit = 20, skip = 0, search = '' }) {
		const companyFilter = {
			companyStatus: COMPANY_STATUS.ACTIVE,
		}

		if (search) {
			companyFilter.$or = [
				{ companyName: { $regex: search, $options: 'i' } },
				{ companyEmail: { $regex: search, $options: 'i' } },
				{ companyPhone: { $regex: search, $options: 'i' } },
			]
		}

		const [companies, totalItems] = await Promise.all([
			this.companySchema
				.find(companyFilter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),

			this.companySchema.countDocuments(companyFilter),
		])

		const companyIds = companies.map(company => company._id)

		if (!companyIds.length) {
			return {
				companies: [],
				pagination: buildPaginationMeta({
					page,
					limit,
					totalItems,
				}),
			}
		}

		const managerRole = COMPANY_MEMBER_TYPES.manager
		const workerRole = COMPANY_MEMBER_TYPES.worker

		const [buildingsList, companyMembersList, gatewaysList, nodesCountAgg] =
			await Promise.all([
				this.buildingSchema
					.find({
						companyId: { $in: companyIds },
					})
					.sort({ createdAt: -1 })
					.lean(),

				this.companyMemberSchema
					.find({
						companyId: { $in: companyIds },
					})
					.populate({
						path: 'memberId',
						select: '_id name email phone userType',
					})
					.sort({ createdAt: -1 })
					.lean(),

				this.gatewaySchema
					.find({
						companyId: { $in: companyIds },
						isAssigned: true,
					})
					.sort({ createdAt: -1 })
					.lean(),

				this.nodeSchema.aggregate([
					{
						$match: {
							companyId: { $in: companyIds },
							isAssigned: true,
						},
					},
					{
						$group: {
							_id: '$companyId',
							count: { $sum: 1 },
						},
					},
				]),
			])

		const groupByCompanyId = items => {
			return items.reduce((acc, item) => {
				const key = item.companyId?.toString()

				if (!key) {
					return acc
				}

				if (!acc[key]) {
					acc[key] = []
				}

				acc[key].push(item)

				return acc
			}, {})
		}

		const buildingsByCompany = groupByCompanyId(buildingsList)
		const membersByCompany = groupByCompanyId(companyMembersList)
		const gatewaysByCompany = groupByCompanyId(gatewaysList)

		const nodesCountByCompany = nodesCountAgg.reduce((acc, item) => {
			acc[item._id.toString()] = item.count
			return acc
		}, {})

		const companiesDashboardList = companies.map(company => {
			const companyId = company._id.toString()

			const currentBuildingsList = buildingsByCompany[companyId] || []
			const currentMembersList = membersByCompany[companyId] || []
			const currentGatewaysList = gatewaysByCompany[companyId] || []

			const activeMembers = currentMembersList.filter(
				member => member.status === MEMBER_STATUS.ACTIVE,
			)

			const managersCount = activeMembers.filter(
				member => member.memberRole === managerRole,
			).length

			const workersCount = activeMembers.filter(
				member => member.memberRole === workerRole,
			).length

			return {
				company,

				companyStatistics: {
					buildingsCount: currentBuildingsList.length,
					managersCount,
					workersCount,
					gatewaysCount: currentGatewaysList.length,
					nodesCount: nodesCountByCompany[companyId] || 0,
				},

				buildingsList: currentBuildingsList,
				companyMembersList: currentMembersList,
				gatewaysList: currentGatewaysList,
			}
		})

		return {
			companies: companiesDashboardList,

			pagination: buildPaginationMeta({
				page,
				limit,
				totalItems,
			}),
		}
	}

	validateObjectId(id, message = 'Invalid id') {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError(message, 400)
		}
	}

	async checkActiveCompany(companyId) {
		this.validateObjectId(companyId, 'Invalid company id')

		const company = await this.companySchema
			.findOne({
				_id: companyId,
				companyStatus: COMPANY_STATUS.ACTIVE,
			})
			.lean()

		if (!company) {
			throw this.createError('Company not found or inactive', 404)
		}

		return company
	}

	normalizeMemberRole(memberRole) {
		if (!memberRole) {
			return null
		}

		const role = memberRole.toString().toLowerCase()

		if (role === 'manager') {
			return COMPANY_MEMBER_TYPES.manager
		}

		if (role === 'worker') {
			return COMPANY_MEMBER_TYPES.worker
		}

		throw this.createError('Invalid member role', 400)
	}

	getUserTypeFromPayload(type) {
		if (!type) {
			throw this.createError('User type is required', 400)
		}

		const value = type.toString()

		if (value.toLowerCase() === 'manager') {
			return 'manager'
		}

		if (value.toLowerCase() === 'worker') {
			return 'worker'
		}

		throw this.createError('Invalid user type', 400)
	}

	getMemberRoleByUserType(userType) {
		if (userType.toLowerCase() === 'manager') {
			return COMPANY_MEMBER_TYPES.manager
		}

		if (userType.toLowerCase() === 'worker') {
			return COMPANY_MEMBER_TYPES.worker
		}

		throw this.createError('Invalid user type', 400)
	}

	async getCompanyMembers({ companyId }) {
		await this.checkActiveCompany(companyId)

		const members = await this.companyMemberSchema
			.find({ companyId })
			.populate({
				path: 'memberId',
				select: '_id name email phone userType isAssigned',
			})
			.sort({ createdAt: -1 })
			.lean()

		return members.map(member => {
			const user = member.memberId

			return {
				id: user?._id,
				_id: user?._id,
				companyMemberId: member._id,

				name: user?.name || '',
				email: user?.email || '',
				phone: user?.phone || '',
				type: user?.userType || '',

				memberRole: member.memberRole,
				status: member.status,

				checked: member.status === MEMBER_STATUS.ACTIVE,
				assigned: member.status === MEMBER_STATUS.ACTIVE,
			}
		})
	}

	async createCompanyMemberUser({ companyId, payload }) {
		await this.checkActiveCompany(companyId)

		const {
			name,
			email,
			phone = '',
			userType,
			password,
			passwordConfirm,
		} = payload

		const finalUserType = this.getUserTypeFromPayload(userType)
		const memberRole = this.getMemberRoleByUserType(finalUserType)

		if (!name || !email || !password || !passwordConfirm) {
			throw this.createError('Please fill all required fields', 400)
		}

		if (password !== passwordConfirm) {
			throw this.createError('Password confirmation does not match', 400)
		}

		const normalizedEmail = email.trim().toLowerCase()

		const session = await mongoose.startSession()

		try {
			let result = null

			await session.withTransaction(async () => {
				const existingUser = await this.userSchema
					.findOne({ email: normalizedEmail })
					.session(session)

				if (existingUser) {
					throw this.createError('Email already exists', 409)
				}

				const hashedPassword = await bcrypt.hash(password, 10)

				const [createdUser] = await this.userSchema.create(
					[
						{
							name: name,
							email: normalizedEmail,
							phone,
							password: hashedPassword,
							userType: finalUserType,
							isAssigned: true,
						},
					],
					{ session },
				)

				const [createdCompanyMember] = await this.companyMemberSchema.create(
					[
						{
							companyId,
							memberId: createdUser._id,
							memberRole,
							status: MEMBER_STATUS.ACTIVE,
						},
					],
					{ session },
				)

				const userObject = createdUser.toObject()
				delete userObject.password

				result = {
					id: createdUser._id,
					_id: createdUser._id,
					companyMemberId: createdCompanyMember._id,

					name: userObject.name,
					email: userObject.email,
					phone: userObject.phone,
					type: userObject.userType,

					memberRole: createdCompanyMember.memberRole,
					status: createdCompanyMember.status,

					checked: true,
					assigned: true,
				}
			})

			return result
		} finally {
			session.endSession()
		}
	}

	async updateCompanyMemberStatuses({ companyId, activeMemberIds = [] }) {
		await this.checkActiveCompany(companyId)

		if (!Array.isArray(activeMemberIds)) {
			throw this.createError('activeMemberIds must be an array', 400)
		}

		const uniqueActiveMemberIds = [
			...new Set(activeMemberIds.map(id => id.toString())),
		]

		for (const memberId of uniqueActiveMemberIds) {
			this.validateObjectId(memberId, 'Invalid member id')
		}

		const existingActiveMembersCount =
			await this.companyMemberSchema.countDocuments({
				companyId,
				memberId: { $in: uniqueActiveMemberIds },
			})

		if (existingActiveMembersCount !== uniqueActiveMemberIds.length) {
			throw this.createError('Some members do not belong to this company', 400)
		}

		await this.companyMemberSchema.updateMany(
			{
				companyId,
				memberId: { $in: uniqueActiveMemberIds },
			},
			{
				$set: {
					status: MEMBER_STATUS.ACTIVE,
				},
			},
		)

		await this.companyMemberSchema.updateMany(
			{
				companyId,
				memberId: { $nin: uniqueActiveMemberIds },
			},
			{
				$set: {
					status: MEMBER_STATUS.INACTIVE,
				},
			},
		)

		const updatedMembers = await this.getCompanyMembers({
			companyId,
		})

		return {
			members: updatedMembers,
			activeCount: updatedMembers.filter(member => member.checked).length,
			inactiveCount: updatedMembers.filter(member => !member.checked).length,
			totalCount: updatedMembers.length,
		}
	}

	async getCompanyBuildings({ companyId }) {
		await this.checkActiveCompany(companyId)

		const buildings = await this.buildingSchema
			.find({ companyId })
			.sort({ createdAt: -1 })
			.lean()

		return buildings.map(building => {
			return {
				_id: building._id,

				title: building.title || '',
				address: building.address || '',
				buildingType: building.buildingType || '',

				companyId: building.companyId,

				buildingPlanImage: building.buildingPlanImage || [],
				buildingRealImage: building.buildingRealImage || [],

				buildingStatus: building.buildingStatus,
				startDate: building.startDate,

				createdAt: building.createdAt,
				updatedAt: building.updatedAt,

				checked: building.buildingStatus === BUILDING_STATUS.ACTIVE,
				assigned: building.buildingStatus === BUILDING_STATUS.ACTIVE,
				isAssigned: building.buildingStatus === BUILDING_STATUS.ACTIVE,
			}
		})
	}

	async updateCompanyBuildingStatuses({ companyId, activeBuildingIds = [] }) {
		await this.checkActiveCompany(companyId)

		await this.buildingSchema.updateMany(
			{
				companyId,
				_id: { $in: activeBuildingIds },
			},
			{
				$set: {
					buildingStatus: BUILDING_STATUS.ACTIVE,
				},
			},
		)

		await this.buildingSchema.updateMany(
			{
				companyId,
				_id: { $nin: activeBuildingIds },
			},
			{
				$set: {
					buildingStatus: BUILDING_STATUS.INACTIVE,
				},
			},
		)

		return this.getCompanyBuildings({ companyId })
	}

	async getAdminResources({ page, limit, skip }) {
		const [
			companiesList,
			companiesTotal,

			buildingsList,
			buildingsTotal,

			gatewaysList,
			gatewaysTotal,
		] = await Promise.all([
			this.companySchema
				.find({})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),

			this.companySchema.countDocuments({}),

			this.buildingSchema
				.find({})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean()
				.populate('companyId', 'companyName'),

			this.buildingSchema.countDocuments({}),

			this.gatewaySchema
				.find({})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean()
				.populate('companyId', 'companyName'),

			this.gatewaySchema.countDocuments({}),
		])

		return {
			companiesList: {
				items: companiesList,
				pagination: this.createPaginationMeta({
					total: companiesTotal,
					page,
					limit,
				}),
			},

			buildingsList: {
				items: buildingsList,
				pagination: this.createPaginationMeta({
					total: buildingsTotal,
					page,
					limit,
				}),
			},

			gatewaysList: {
				items: gatewaysList,
				pagination: this.createPaginationMeta({
					total: gatewaysTotal,
					page,
					limit,
				}),
			},
		}
	}

	async getAssigningResources({ page, limit, skip }) {
		const unassignedFilter = {
			isAssigned: false,
			$or: [{ companyId: { $exists: false } }, { companyId: null }],
		}

		const [buildingsList, buildingsTotal, gatewaysList, gatewaysTotal] =
			await Promise.all([
				this.buildingSchema
					.find(unassignedFilter)
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit)
					.lean(),

				this.buildingSchema.countDocuments(unassignedFilter),

				this.gatewaySchema
					.find(unassignedFilter)
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit)
					.lean(),

				this.gatewaySchema.countDocuments(unassignedFilter),
			])

		return {
			buildingsList: {
				items: buildingsList,
				pagination: this.createPaginationMeta({
					total: buildingsTotal,
					page,
					limit,
				}),
			},

			gatewaysList: {
				items: gatewaysList,
				pagination: this.createPaginationMeta({
					total: gatewaysTotal,
					page,
					limit,
				}),
			},
		}
	}
}

module.exports = AdminDashboardService
