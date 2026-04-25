const mongoose = require('mongoose')
const { logger } = require('../../lib/logger')
const NodeSchema = require('./node.model')
const GatewaySchema = require('../gateways/gateway.model')
const { AngleNodeHistory } = require('./angle-node/angleNode.model')
const { VerticalNodeHistory } = require('./vertical-node/Vertical.node.model')
const { NODE_TYPE, NODE_UPDATE_ALLOWED_FIELDS } = require('../../lib/config')

class NodeService {
	constructor() {
		this.nodeSchema = NodeSchema
		this.gatewaySchema = GatewaySchema
		this.angleNodeHistory = AngleNodeHistory
		this.verticalNodeHistory = VerticalNodeHistory
		this.NODE_TYPE = NODE_TYPE
		this.NODE_UPDATE_ALLOWED_FIELDS = NODE_UPDATE_ALLOWED_FIELDS
	}

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	isValidObjectId(id) {
		return mongoose.Types.ObjectId.isValid(id)
	}

	pickAllowedUpdates(body = {}, allowedFields = []) {
		const updates = {}

		for (const key of allowedFields) {
			if (key in body) {
				updates[key] = body[key]
			}
		}

		return updates
	}

	async createNodes(body) {
		logger('request: createNodes')

		const { node_type, node_numbers } = body

		if (!Array.isArray(node_numbers) || node_numbers.length === 0) {
			throw this.createError('node_numbers must be a non-empty array', 400)
		}

		if (!node_type) {
			throw this.createError('node_type is required', 400)
		}

		const existNodes = await this.nodeSchema.find({
			node_number: { $in: node_numbers },
			node_type,
		})

		if (existNodes.length > 0) {
			const existNodeNums = existNodes.map(node => node.node_number)
			throw this.createError(
				`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`,
				400,
			)
		}

		const arrayObject = node_numbers.map(number => ({
			node_number: number,
			node_type,
		}))

		const createdNodes = await this.nodeSchema.insertMany(arrayObject)

		return {
			count: createdNodes.length,
			nodes: createdNodes,
		}
	}

	async getNodes() {
		logger('request: getNodes')

		const nodes = await this.nodeSchema.find().sort({ createdAt: -1 }).lean()

		const groupedNodes = nodes.reduce(
			(acc, node) => {
				if (node.node_type === this.NODE_TYPE.DOOR) {
					acc.door_nodes.push(node)
				}

				if (node.node_type === this.NODE_TYPE.ANGLE) {
					acc.angle_nodes.push(node)
				}

				if (node.node_type === this.NODE_TYPE.GANGFORM) {
					acc.gangform_nodes.push(node)
				}

				return acc
			},
			{
				door_nodes: [],
				angle_nodes: [],
				gangform_nodes: [],
			},
		)

		return groupedNodes

		return nodes
	}

	async getActiveNodes() {
		logger('request: getActiveNodes')

		const activeNodes = await this.nodeSchema
			.find({
				node_status: true,
				gateway_id: null,
			})
			.select('node_number node_type node_status gateway_id')

		if (!activeNodes || activeNodes.length === 0) {
			throw this.createError('동작 가능한 노드가 없습니다.', 404)
		}

		const groupedNodes = activeNodes.reduce(
			(acc, node) => {
				if (node.node_type === this.NODE_TYPE.DOOR) {
					acc.door_nodes.push(node)
				}

				if (node.node_type === this.NODE_TYPE.ANGLE) {
					acc.angle_nodes.push(node)
				}

				if (node.node_type === this.NODE_TYPE.GANGFORM) {
					acc.gangform_nodes.push(node)
				}

				return acc
			},
			{
				door_nodes: [],
				angle_nodes: [],
				gangform_nodes: [],
			},
		)

		return groupedNodes
	}

	async nodeGraphicData(query) {
		logger('request: nodeGraphicData')

		const { node_number, node_type, from, to } = query

		if (!node_number || !node_type || !from || !to) {
			throw this.createError(
				'node_number, node_type, from, to are required',
				400,
			)
		}

		let data = []

		switch (node_type) {
			case this.NODE_TYPE.ANGLE:
				data = await this.angleNodeHistory
					.find({
						doorNum: Number(node_number),
						createdAt: {
							$gte: new Date(from),
							$lte: new Date(to),
						},
					})
					.sort({ createdAt: 1 })
				break

			case this.NODE_TYPE.GANGFORM:
				data = await this.verticalNodeHistory
					.find({
						node_number: Number(node_number),
						createdAt: {
							$gte: new Date(from),
							$lte: new Date(to),
						},
					})
					.sort({ createdAt: 1 })
				break

			default:
				throw this.createError('Invalid node_type', 400)
		}

		return data
	}

	async updateNode(nodeId, body) {
		logger('request: updateNode')

		if (!nodeId || !this.isValidObjectId(nodeId)) {
			throw this.createError('Node id is required', 400)
		}

		const updates = this.pickAllowedUpdates(
			body,
			this.NODE_UPDATE_ALLOWED_FIELDS,
		)

		if (Object.keys(updates).length === 0) {
			throw this.createError('No valid fields provided for update', 400)
		}

		if ('save_status' in updates) {
			updates.save_status_lastChange = new Date()
		}

		const updatedNode = await this.nodeSchema
			.findByIdAndUpdate(
				nodeId,
				{ $set: updates },
				{
					new: true,
					runValidators: true,
				},
			)
			.lean()

		if (!updatedNode) {
			throw this.createError('Node not found', 404)
		}

		return updatedNode
	}

	async bulkUpdateNodes(body) {
		logger('request: bulkUpdateNodes')

		if (Array.isArray(body)) {
			if (body.length === 0) {
				throw this.createError('Request array is empty', 400)
			}

			const operations = body
				.map(item => {
					const { id } = item
					const updates = this.pickAllowedUpdates(
						item,
						this.NODE_UPDATE_ALLOWED_FIELDS,
					)

					if (!id || Object.keys(updates).length === 0) {
						return null
					}

					if ('save_status' in updates) {
						updates.save_status_lastChange = new Date()
					}

					return {
						updateOne: {
							filter: { _id: id },
							update: { $set: updates },
						},
					}
				})
				.filter(Boolean)

			if (operations.length === 0) {
				throw this.createError('No valid bulk update operations found', 400)
			}

			const result = await this.nodeSchema.bulkWrite(operations)

			return {
				matchedCount: result.matchedCount ?? result.nMatched ?? 0,
				modifiedCount: result.modifiedCount ?? result.nModified ?? 0,
			}
		}

		const { ids, updates: rawUpdates } = body
		const updates = this.pickAllowedUpdates(
			rawUpdates,
			this.NODE_UPDATE_ALLOWED_FIELDS,
		)

		if (!Array.isArray(ids) || ids.length === 0) {
			throw this.createError('ids must be a non-empty array', 400)
		}

		if (Object.keys(updates).length === 0) {
			throw this.createError('No valid fields provided for bulk update', 400)
		}

		if ('save_status' in updates) {
			updates.save_status_lastChange = new Date()
		}

		const result = await this.nodeSchema.updateMany(
			{ _id: { $in: ids } },
			{ $set: updates },
		)

		return {
			matchedCount: result.matchedCount ?? 0,
			modifiedCount: result.modifiedCount ?? 0,
		}
	}

	async updateNodeGateway(nodeId, body) {
		logger('request: updateNodeGateway')

		const { gateway_id } = body

		if (!nodeId || !this.isValidObjectId(nodeId)) {
			throw this.createError('Invalid node id', 400)
		}

		if (gateway_id === undefined) {
			throw this.createError('gateway_id is required (can be null)', 400)
		}

		if (gateway_id !== null) {
			if (!this.isValidObjectId(gateway_id)) {
				throw this.createError('Invalid gateway id', 400)
			}

			const gateway = await this.gatewaySchema.findById(gateway_id).lean()

			if (!gateway) {
				throw this.createError('Gateway not found', 404)
			}
		}

		const updatedNode = await this.nodeSchema
			.findByIdAndUpdate(
				nodeId,
				{ $set: { gateway_id } },
				{ new: true, runValidators: true },
			)
			.select(
				'node_number gateway_id node_status node_alive lastSeen updatedAt',
			)
			.lean()

		if (!updatedNode) {
			throw this.createError('Node not found', 404)
		}

		return updatedNode
	}

	async deleteNode(nodeId) {
		logger('request: deleteNode')

		if (!nodeId || !this.isValidObjectId(nodeId)) {
			throw this.createError('Invalid node id', 400)
		}

		const deletedNode = await this.nodeSchema.findOneAndDelete({
			_id: nodeId,
		})

		if (!deletedNode) {
			throw this.createError('Node not found', 404)
		}

		return deletedNode
	}
}

module.exports = NodeService
