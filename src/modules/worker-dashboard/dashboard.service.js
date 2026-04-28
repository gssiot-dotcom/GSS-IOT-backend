const mongoose = require('mongoose')
const { NODE_TYPE } = require('../../lib/config')

const {
	BuildingSchema,
	BuildingWorkerSchema,
} = require('../building/building.model')
const Gateway = require('../gateways/gateway.model')
const NodeSchema = require('../nodes/node.model')

class WorkerDashboardService {
	constructor() {
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.gatewaySchema = Gateway
		this.nodeSchema = NodeSchema
		this.nodeTypes = Object.values(NODE_TYPE)
	}

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	normalizeNodeType(nodeType) {
		const value = String(nodeType || '')
			.trim()
			.toUpperCase()

		const matchedType = this.nodeTypes.find(
			type => String(type).toUpperCase() === value,
		)

		if (!matchedType) {
			throw this.createError(
				`Invalid nodeType. Allowed values: ${this.nodeTypes.join(', ')}`,
				400,
			)
		}

		return matchedType
	}

	buildEmptyNodeCounts() {
		const counts = {}

		for (const type of this.nodeTypes) {
			counts[type] = 0
		}

		counts.total = 0

		return counts
	}

	buildNodeCards(nodeCounts) {
		return this.nodeTypes.map(type => ({
			node_type: type,
			count: nodeCounts[type] || 0,
		}))
	}

	async validateWorkerBuildingAccess(userId, buildingId) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw this.createError('Invalid user id', 400)
		}

		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw this.createError('Invalid building id', 400)
		}

		const assignment = await this.buildingWorkerSchema.findOne({
			user_id: userId,
			building_id: buildingId,
			status: true,
		})

		if (!assignment) {
			throw this.createError('You are not assigned to this building', 403)
		}

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError('Building not found', 404)
		}

		return building
	}

	async getAssignedBuildings(userId) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw this.createError('Invalid user id', 400)
		}

		const assignments = await this.buildingWorkerSchema
			.find({
				user_id: userId,
				status: true,
			})
			.select('building_id')
			.lean()

		if (!assignments.length) {
			return []
		}

		const buildingIds = assignments.map(item => item.building_id)

		const buildings = await this.buildingSchema
			.find({
				_id: { $in: buildingIds },
			})
			.sort({ createdAt: -1 })
			.lean()

		if (!buildings.length) {
			return []
		}

		const countRows = await this.nodeSchema.aggregate([
			{
				$lookup: {
					from: 'gateways',
					localField: 'gateway_id',
					foreignField: '_id',
					as: 'gateway',
				},
			},
			{
				$unwind: '$gateway',
			},
			{
				$match: {
					'gateway.building_id': { $in: buildingIds },
				},
			},
			{
				$group: {
					_id: {
						building_id: '$gateway.building_id',
						node_type: '$node_type',
					},
					count: { $sum: 1 },
				},
			},
		])

		const nodeCountMap = new Map()

		for (const building of buildings) {
			nodeCountMap.set(String(building._id), this.buildEmptyNodeCounts())
		}

		for (const row of countRows) {
			const buildingId = String(row._id.building_id)
			const nodeType = row._id.node_type
			const count = row.count

			const current =
				nodeCountMap.get(buildingId) || this.buildEmptyNodeCounts()

			current[nodeType] = count
			current.total += count

			nodeCountMap.set(buildingId, current)
		}

		return buildings.map(building => {
			const node_counts =
				nodeCountMap.get(String(building._id)) || this.buildEmptyNodeCounts()

			return {
				building_id: building._id,
				building_name: building.building_name,
				building_num: building.building_num,
				building_addr: building.building_addr,
				building_plan_img: building.building_plan_img,
				building_status: building.building_status,
				permit_date: building.permit_date,
				expiry_date: building.expiry_date,
				node_counts,
				node_cards: this.buildNodeCards(node_counts),
			}
		})
	}

	async getBuildingNodesByType(userId, buildingId, nodeType) {
		const building = await this.validateWorkerBuildingAccess(userId, buildingId)
		const normalizedNodeType = this.normalizeNodeType(nodeType)

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
					gateways: gateways.map(g => g.serial_number),
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
				node_type: normalizedNodeType,
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
				gateways: gateways.map(g => g.serial_number),
			},
			node_type: normalizedNodeType,
			total_count: formattedNodes.length,
			nodes: formattedNodes,
		}
	}
}

module.exports = WorkerDashboardService
