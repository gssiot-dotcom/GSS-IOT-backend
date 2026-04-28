const mongoose = require('mongoose')
const createError = require('http-errors')

const { CompanyMemberSchema } = require('../company/company.model')
const {
	BuildingSchema,
	BuildingWorkerSchema,
} = require('../building/building.model')

const GatewaySchema = require('../gateways/gateway.model')
const NodeSchema = require('../nodes/node.model')
const { COMPANY_MEMBER_TYPES, NODE_TYPE } = require('../../lib/config')

class ManagerDashboardService {
	constructor() {
		this.companyMemberSchema = CompanyMemberSchema
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.gatewaySchema = GatewaySchema
		this.nodeSchema = NodeSchema
	}

	async getDashboard(userId) {
		const company = await this.getManagerCompany(userId)

		if (!company) {
			return {
				company: null,
				buildings: [],
			}
		}

		const buildings = await this.getBuildingsByCompany(company._id)

		return {
			company,
			buildings,
		}
	}

	async getManagerCompany(userId) {
		const membership = await this.companyMemberSchema
			.findOne({
				user_id: userId,
				member_role: COMPANY_MEMBER_TYPES.MANAGER,
				status: true,
			})
			.populate({
				path: 'company_id',
				select:
					'_id company_name company_code company_logo company_addr company_tel company_email status',
				match: {
					status: true,
				},
			})
			.lean()

		if (!membership || !membership.company_id) {
			return null
		}

		return {
			_id: membership.company_id._id,
			company_name: membership.company_id.company_name,
			company_code: membership.company_id.company_code,
			company_logo: membership.company_id.company_logo,
			company_addr: membership.company_id.company_addr,
			company_tel: membership.company_id.company_tel,
			company_email: membership.company_id.company_email,
		}
	}

	async validateManagerBuildingAccess(userId, buildingId) {
		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw createError(400, 'Invalid building id')
		}

		const company = await this.getManagerCompany(userId)

		if (!company) {
			throw createError(403, 'You do not have company access')
		}

		const building = await this.buildingSchema
			.findOne({
				_id: buildingId,
				company_id: company._id,
				building_status: true,
			})
			.select(
				'_id building_name building_num building_addr building_status company_id',
			)
			.lean()

		if (!building) {
			throw createError(403, 'You do not have access to this building')
		}

		return building
	}

	async getBuildingsByCompany(companyId) {
		const buildings = await this.buildingSchema
			.find({
				company_id: companyId,
				building_status: true,
			})
			.select(
				'_id building_name building_num building_addr building_plan_img building_status permit_date expiry_date',
			)
			.lean()

		if (!buildings.length) {
			return []
		}

		const buildingIds = buildings.map(building => building._id)

		const [gateways, buildingWorkers] = await Promise.all([
			this.gatewaySchema
				.find({
					building_id: { $in: buildingIds },
				})
				.select('_id building_id serial_number')
				.lean(),

			this.buildingWorkerSchema
				.find({
					building_id: { $in: buildingIds },
					status: true,
				})
				.populate({
					path: 'user_id',
					select: 'name',
				})
				.lean(),
		])

		const gatewayIds = gateways.map(gateway => gateway._id)

		const nodes = gatewayIds.length
			? await this.nodeSchema
					.find({
						gateway_id: { $in: gatewayIds },
					})
					.select('_id gateway_id node_type')
					.lean()
			: []

		const gatewaysByBuildingId = new Map()
		const gatewayBuildingMap = new Map()
		const workersByBuildingId = new Map()
		const nodeCountsByBuildingId = new Map()

		for (const building of buildings) {
			nodeCountsByBuildingId.set(String(building._id), {
				door_node: 0,
				angle_node: 0,
				gangform_node: 0,
				total: 0,
			})
		}

		for (const gateway of gateways) {
			const buildingId = String(gateway.building_id)

			if (!gatewaysByBuildingId.has(buildingId)) {
				gatewaysByBuildingId.set(buildingId, [])
			}

			gatewaysByBuildingId.get(buildingId).push(gateway.serial_number)
			gatewayBuildingMap.set(String(gateway._id), buildingId)
		}

		for (const buildingWorker of buildingWorkers) {
			const buildingId = String(buildingWorker.building_id)

			if (!workersByBuildingId.has(buildingId)) {
				workersByBuildingId.set(buildingId, [])
			}

			if (buildingWorker.user_id?.name) {
				workersByBuildingId.get(buildingId).push(buildingWorker.user_id.name)
			}
		}

		for (const node of nodes) {
			const buildingId = gatewayBuildingMap.get(String(node.gateway_id))

			if (!buildingId) continue

			const counts = nodeCountsByBuildingId.get(buildingId)

			if (!counts) continue

			if (node.node_type === NODE_TYPE.DOOR) {
				counts.door_node += 1
			}

			if (node.node_type === NODE_TYPE.ANGLE) {
				counts.angle_node += 1
			}

			if (node.node_type === NODE_TYPE.GANGFORM) {
				counts.gangform_node += 1
			}

			counts.total += 1
		}

		return buildings.map(building => {
			const buildingId = String(building._id)

			return {
				building_id: building._id,
				building_name: building.building_name,
				building_num: building.building_num,
				building_addr: building.building_addr,
				building_plan_img: building.building_plan_img,
				building_status: building.building_status,
				permit_date: building.permit_date,
				expiry_date: building.expiry_date,
				gateways: gatewaysByBuildingId.get(buildingId) || [],
				workers: workersByBuildingId.get(buildingId) || [],
				node_counts: nodeCountsByBuildingId.get(buildingId) || {
					door_node: 0,
					angle_node: 0,
					gangform_node: 0,
					total: 0,
				},
			}
		})
	}

	async getBuildingNodesByType(userId, buildingId, nodeType) {
		const building = await this.validateManagerBuildingAccess(
			userId,
			buildingId,
		)

		const gateways = await this.gatewaySchema
			.find({
				building_id: buildingId,
			})
			.select('_id serial_number zone_name gateway_status gateway_alive')
			.lean()

		if (!gateways.length) {
			return {
				building: {
					_id: building._id,
					building_name: building.building_name,
					building_num: building.building_num,
					building_addr: building.building_addr,
					building_status: building.building_status,
					gateways: [],
				},
				node_type: normalizedNodeType,
				total_count: 0,
				nodes: [],
			}
		}

		const gatewayIds = gateways.map(gateway => gateway._id)

		const gatewayMap = new Map(
			gateways.map(gateway => [String(gateway._id), gateway]),
		)

		const nodes = await this.nodeSchema
			.find({
				gateway_id: { $in: gatewayIds },
				node_type: nodeType,
			})
			.sort({ node_number: 1 })
			.lean()

		const formattedNodes = nodes.map(node => ({
			_id: node._id,
			node_number: node.node_number,
			node_type: node.node_type,
			door_state: node.door_state,
			battery_state: node.battery_state,
			node_status: node.node_status,
			position: node.position,
			angle_x: node.angle_x,
			angle_y: node.angle_y,
			calibrated_x: node.calibrated_x,
			calibrated_y: node.calibrated_y,
			node_position_img: node.node_position_img,
			save_status: node.save_status,
			save_status_lastChange: node.save_status_lastChange,
			node_alive: node.node_alive,
			lastSeen: node.lastSeen,
			gateway_id: node.gateway_id,
			gateway: gatewayMap.get(String(node.gateway_id)) || null,
			createdAt: node.createdAt,
			updatedAt: node.updatedAt,
		}))

		return {
			building: {
				_id: building._id,
				building_name: building.building_name,
				building_num: building.building_num,
				building_addr: building.building_addr,
				building_status: building.building_status,
				gateways: gateways.map(gateway => gateway.serial_number),
			},
			node_type: nodeType,
			total_count: formattedNodes.length,
			nodes: formattedNodes,
		}
	}
}

module.exports = ManagerDashboardService
