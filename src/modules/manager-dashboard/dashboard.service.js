// services/ManagerDashboardService.js

const mongoose = require('mongoose')
const {
	COMPANY_MEMBER_TYPES,
	NODE_TYPE,
	COMPANY_STATUS,
	MEMBER_STATUS,
} = require('../../lib/config')
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

class ManagerDashboardService {
	constructor() {
		this.companySchema = CompanySchema
		this.companyMemberSchema = CompanyMemberSchema
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.gatewaySchema = GatewaySchema
		this.nodeSchema = NodeSchema
		this.alarmLevelSchema = BuildingAlarmLevelSchema
	}
	createError(status, message) {
		const error = new Error(message)
		error.status = status
		return error
	}

	checkObjectId(id, fieldName = 'id') {
		if (!id || !mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError(400, `${fieldName} is not valid`)
		}
	}

	async getAuthorizedManagerMembership({ userId, companyId = null }) {
		this.checkObjectId(userId, 'userId')

		const managerRoles = COMPANY_MEMBER_TYPES.manager

		const query = {
			memberId: userId,
			status: MEMBER_STATUS.ACTIVE,
		}

		if (companyId) {
			this.checkObjectId(companyId, 'companyId')
			query.companyId = companyId
		}

		if (managerRoles.length) {
			query.memberRole = { $in: managerRoles }
		}

		const membership = await this.companyMemberSchema.findOne(query).lean()

		if (!membership) {
			throw this.createError(
				403,
				'You do not have manager permission for this company',
			)
		}

		return membership
	}

	async getManagerDashboard({ userId, companyId = null }) {
		const membership = await this.getAuthorizedManagerMembership({
			userId,
			companyId,
		})

		const targetCompanyId = membership.companyId

		const selfCompany = await this.companySchema
			.findOne({
				_id: targetCompanyId,
				companyStatus: COMPANY_STATUS.ACTIVE,
			})
			.lean()

		if (!selfCompany) {
			throw this.createError(404, 'Company not found or inactive')
		}

		const managerRole = COMPANY_MEMBER_TYPES.manager
		const workerRole = COMPANY_MEMBER_TYPES.worker

		const [
			buildingsCount,
			managersCount,
			workersCount,
			gatewaysCount,
			nodesCount,
			buildingsList,
			companyMembersList,
			gatewaysList,
		] = await Promise.all([
			this.buildingSchema.countDocuments({
				companyId: targetCompanyId,
			}),

			this.companyMemberSchema.countDocuments({
				companyId: targetCompanyId,
				status: MEMBER_STATUS.ACTIVE,
				memberRole: managerRole,
			}),

			this.companyMemberSchema.countDocuments({
				companyId: targetCompanyId,
				status: MEMBER_STATUS.ACTIVE,
				memberRole: workerRole,
			}),

			this.gatewaySchema.countDocuments({
				companyId: targetCompanyId,
				isAssigned: true,
			}),

			this.nodeSchema.countDocuments({
				companyId: targetCompanyId,
				isAssigned: true,
			}),

			this.buildingSchema
				.find({
					companyId: targetCompanyId,
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.companyMemberSchema
				.find({
					companyId: targetCompanyId,
				})
				.populate({
					path: 'memberId',
					select: '_id name email phone userType ',
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.gatewaySchema
				.find({
					companyId: targetCompanyId,
					isAssigned: true,
				})
				.sort({ createdAt: -1 })
				.lean(),
		])

		return {
			selfCompany,

			companyStatistics: {
				buildingsCount,
				managersCount,
				workersCount,
				gatewaysCount,
				nodesCount,
			},

			buildingsList,
			companyMembersList,
			gatewaysList,
		}
	}

	async getManagerBuildingsPage({ userId, companyId = null }) {
		const membership = await this.getAuthorizedManagerMembership({
			userId,
			companyId,
		})

		const targetCompanyId = membership.companyId

		const selfCompany = await this.companySchema
			.findOne({
				_id: targetCompanyId,
				companyStatus: COMPANY_STATUS.ACTIVE,
			})
			.lean()

		if (!selfCompany) {
			throw this.createError(404, 'Company not found or inactive')
		}

		const buildings = await this.buildingSchema
			.find({
				companyId: targetCompanyId,
			})
			.sort({ createdAt: -1 })
			.lean()

		const buildingIds = buildings.map(building => building._id)

		if (!buildingIds.length) {
			return {
				buildingsList: [],
			}
		}

		const [buildingGateways, buildingWorkers] = await Promise.all([
			this.gatewaySchema
				.find({
					companyId: targetCompanyId,
					buildingId: { $in: buildingIds },
					isAssigned: true,
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.buildingWorkerSchema
				.find({
					companyId: targetCompanyId,
					buildingId: { $in: buildingIds },
				})
				.populate({
					path: 'userId',
					select: '_id name email phone userType',
				})
				.sort({ createdAt: -1 })
				.lean(),
		])

		const gatewayIds = buildingGateways.map(gateway => gateway._id)

		const buildingNodes = gatewayIds.length
			? await this.nodeSchema
					.find({
						companyId: targetCompanyId,
						gatewayId: { $in: gatewayIds },
						isAssigned: true,
					})
					.lean()
			: []

		const gatewaysByBuildingId = {}
		const workersByBuildingId = {}
		const gatewayIdToBuildingId = {}
		const nodeStatsByBuildingId = {}

		for (const building of buildings) {
			const buildingId = building._id.toString()

			gatewaysByBuildingId[buildingId] = []
			workersByBuildingId[buildingId] = []
			nodeStatsByBuildingId[buildingId] = {
				totalNodesCount: 0,
				angleNodesCount: 0,
				gangformNodesCount: 0,
				doorNodesCount: 0,
				alertsCount: 0,
			}
		}

		for (const gateway of buildingGateways) {
			if (!gateway.buildingId) continue

			const buildingId = gateway.buildingId.toString()

			if (!gatewaysByBuildingId[buildingId]) {
				gatewaysByBuildingId[buildingId] = []
			}

			gatewaysByBuildingId[buildingId].push(gateway)
			gatewayIdToBuildingId[gateway._id.toString()] = buildingId
		}

		for (const worker of buildingWorkers) {
			if (!worker.buildingId) continue

			const buildingId = worker.buildingId.toString()

			if (!workersByBuildingId[buildingId]) {
				workersByBuildingId[buildingId] = []
			}

			workersByBuildingId[buildingId].push(worker)
		}

		for (const node of buildingNodes) {
			if (!node.gatewayId) continue

			const gatewayId = node.gatewayId.toString()
			const buildingId = gatewayIdToBuildingId[gatewayId]

			if (!buildingId || !nodeStatsByBuildingId[buildingId]) continue

			nodeStatsByBuildingId[buildingId].totalNodesCount += 1

			if (node.nodeType === NODE_TYPE.ANGLE) {
				nodeStatsByBuildingId[buildingId].angleNodesCount += 1
			}

			if (node.nodeType === NODE_TYPE.GANGFORM) {
				nodeStatsByBuildingId[buildingId].gangformNodesCount += 1
			}

			if (node.nodeType === NODE_TYPE.DOOR) {
				nodeStatsByBuildingId[buildingId].doorNodesCount += 1
			}

			if (node.status !== 'normal') {
				nodeStatsByBuildingId[buildingId].alertsCount += 1
			}
		}

		const buildingsList = buildings.map(building => {
			const buildingId = building._id.toString()
			const nodeStats = nodeStatsByBuildingId[buildingId]

			return {
				buildingData: building,

				buildingGateways: gatewaysByBuildingId[buildingId] || [],

				buildingWorkers: workersByBuildingId[buildingId] || [],

				nodes: {
					totalNodesCount: nodeStats.totalNodesCount,
					angleNodesCount: nodeStats.angleNodesCount,
					gangformNodesCount: nodeStats.gangformNodesCount,
					doorNodesCount: nodeStats.doorNodesCount,
				},

				alertsCount: nodeStats.alertsCount,
			}
		})

		return {
			buildingsList,
		}
	}

	normalizeNodeType(nodeType) {
		if (!nodeType) {
			throw this.createError(400, 'nodeType is required')
		}

		const value = String(nodeType).toLowerCase()

		const nodeTypeMap = {
			door_node: NODE_TYPE.DOOR,
			angle_node: NODE_TYPE.ANGLE,
			gangform_node: NODE_TYPE.GANGFORM,
		}

		const normalizedNodeType = nodeTypeMap[value]

		if (!normalizedNodeType) {
			throw this.createError(400, 'Invalid nodeType')
		}

		return normalizedNodeType
	}

	getNodeSelectFieldsByType(nodeType) {
		const baseFields = [
			'_id',
			'number',
			'nodeType',
			'companyId',
			'gatewayId',
			'status',
			'installedLocation',
			'installLocationImg',
			'isAssigned',
			'saveStatus',
			'saveStatusLastChange',
			'lastSeen',
			// 'createdAt',
			// 'updatedAt',
		]

		const doorFields = ['doorState', 'batteryLevel']

		const angleFields = ['angleX', 'angleY', 'calibratedX', 'calibratedY']

		const gangformFields = ['angleX', 'angleY']

		if (nodeType === NODE_TYPE.DOOR) {
			return [...baseFields, ...doorFields].join(' ')
		}

		if (nodeType === NODE_TYPE.ANGLE) {
			return [...baseFields, ...angleFields].join(' ')
		}

		if (nodeType === NODE_TYPE.GANGFORM) {
			return [...baseFields, ...gangformFields].join(' ')
		}

		throw this.createError(400, 'Invalid nodeType')
	}

	async getManagerBuildingNodesByType({
		userId,
		companyId = null,
		buildingId,
		nodeType,
	}) {
		const membership = await this.getAuthorizedManagerMembership({
			userId,
			companyId,
		})

		const targetCompanyId = membership.companyId

		this.checkObjectId(buildingId, 'buildingId')

		const normalizedNodeType = this.normalizeNodeType(nodeType)

		const building = await this.buildingSchema
			.findOne({
				_id: buildingId,
				companyId: targetCompanyId,
			})
			.lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const gatewaysList = await this.gatewaySchema
			.find({
				companyId: targetCompanyId,
				buildingId,
				isAssigned: true,
			})
			.sort({ createdAt: -1 })
			.lean()

		const gatewayIds = gatewaysList.map(gateway => gateway._id)

		const selectFields = this.getNodeSelectFieldsByType(normalizedNodeType)

		const nodesList = gatewayIds.length
			? await this.nodeSchema
					.find({
						companyId: targetCompanyId,
						gatewayId: { $in: gatewayIds },
						nodeType: normalizedNodeType,
						isAssigned: true,
					})
					.select(selectFields)
					.sort({ number: 1 })
					.lean()
			: []

		const alarmLevels = await this.alarmLevelSchema
			.find({
				buildingId,
				alarmType: normalizedNodeType,
			})
			.lean()

		return {
			nodeType: normalizedNodeType,
			nodesList,
			gatewaysList,
			alarmLevels,
		}
	}
}

module.exports = ManagerDashboardService
