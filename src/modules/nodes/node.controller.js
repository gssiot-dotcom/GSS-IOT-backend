const { logger, logError } = require('../../lib/logger')
const NodeService = require('./node.service')
const GatewaySchema = require('../gateways/gateway.model')

const { AngleNodeHistory } = require('./angle-node/angleNode.model')
const { VerticalNodeHistory } = require('./vertical-node/Vertical.node.model')
const { NODE_TYPE, NODE_UPDATE_ALLOWED_FIELDS } = require('../../lib/config')
const NodeSchema = require('./node.model')

// controller object
let nodeController = module.exports

const pickAllowedUpdates = (body = {}, allowedFields = []) => {
	const updates = {}

	for (const key of allowedFields) {
		if (key in body) {
			updates[key] = body[key]
		}
	}

	return updates
}

/**
 * POST /api/nodes
 * body: { node_type, node_numbers: [1,2,3] }
 */
nodeController.createNodes = async (req, res) => {
	try {
		logger('request: createNodes')

		const { node_type, node_numbers } = req.body

		if (!Array.isArray(node_numbers) || node_numbers.length === 0) {
			return res.status(400).json({
				state: 'fail',
				message: 'node_numbers must be a non-empty array',
			})
		}

		if (!node_type) {
			return res.status(400).json({
				state: 'fail',
				message: 'node_type is required',
			})
		}

		const createdNodes = await NodeService.createNodesData(
			node_type,
			node_numbers,
		)

		return res.status(201).json({
			state: 'success',
			message: `${createdNodes.length} nodes created successfully`,
			count: createdNodes.length,
		})
	} catch (error) {
		logError(error.message)
		return res.status(400).json({
			state: 'fail',
			message: error.message,
		})
	}
}

/**
 * GET /api/nodes
 */
nodeController.getNodes = async (req, res) => {
	try {
		logger('request: getNodes')
		const nodes = await NodeSchema.find().sort({ createdAt: -1 }).lean()
		return res.status(200).json({
			state: 'success',
			nodes,
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({
			state: 'fail',
			message: error.message,
		})
	}
}

/**
 * GET /api/nodes/active
 */
nodeController.getActiveNodes = async (req, res) => {
	try {
		logger('request: getActiveNodes')
		const activeNodes = await NodeService.getActiveNodesData()
		if (!activeNodes || activeNodes.length === 0) {
			return res.status(404).json({
				state: 'fail',
				message: '동작 가능한 노드가 없습니다.',
			})
		}

		const groupedNodes = activeNodes.reduce(
			(acc, node) => {
				if (node.node_type === NODE_TYPE.DOOR) acc.door_nodes.push(node)
				if (node.node_type === NODE_TYPE.ANGLE) acc.angle_nodes.push(node)
				if (node.node_type === NODE_TYPE.GANGFORM) acc.gangform_nodes.push(node)
				return acc
			},
			{
				door_nodes: [],
				angle_nodes: [],
				gangform_nodes: [],
			},
		)

		return res.status(200).json({
			state: 'success',
			nodes: groupedNodes,
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({
			state: 'fail',
			message: 'Internal server error',
			detail: error.message,
		})
	}
}

/**
 * GET /api/nodes/graphic-data?node_number=10&node_type=ANGLE&from=2025-01-01&to=2025-01-02
 */
nodeController.nodeGraphicData = async (req, res) => {
	try {
		logger('request: nodeGraphicData')

		const { node_number, node_type, from, to } = req.query

		if (!node_number || !node_type || !from || !to) {
			return res.status(400).json({
				state: 'fail',
				message: 'node_number, node_type, from, to are required',
			})
		}

		let data

		switch (node_type) {
			case NODE_TYPE.ANGLE:
				data = await AngleNodeHistory.find({
					doorNum: Number(node_number),
					createdAt: {
						$gte: new Date(from),
						$lte: new Date(to),
					},
				}).sort({ createdAt: 1 })
				break

			case NODE_TYPE.GANGFORM:
				data = await VerticalNodeHistory.find({
					node_number: Number(node_number),
					createdAt: {
						$gte: new Date(from),
						$lte: new Date(to),
					},
				}).sort({ createdAt: 1 })
				break

			default:
				return res.status(400).json({
					state: 'fail',
					message: 'Invalid node_type',
				})
		}

		return res.status(200).json({
			state: 'success',
			data,
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({
			state: 'fail',
			message: 'Server error',
		})
	}
}

/**
 * PATCH /api/nodes/:id
 * body:
 * {
 *   "position": "B-2구간-7층",
 *   "node_status": true,
 *   "save_status": false,
 *   "node_position_img": "..."
 * }
 */
nodeController.updateNode = async (req, res) => {
	try {
		logger('request: updateNode')

		const nodeId = req.params.id
		const updates = pickAllowedUpdates(req.body, NODE_UPDATE_ALLOWED_FIELDS)

		if (!nodeId) {
			return res.status(400).json({
				state: 'fail',
				message: 'Node id is required',
			})
		}

		if (Object.keys(updates).length === 0) {
			return res.status(400).json({
				state: 'fail',
				message: 'No valid fields provided for update',
			})
		}

		if ('save_status' in updates) {
			updates.save_status_lastChange = new Date()
		}

		const updatedNode = await NodeSchema.findByIdAndUpdate(
			nodeId,
			{ $set: updates },
			{
				new: true,
				runValidators: true,
			},
		).lean()

		if (!updatedNode) {
			return res.status(404).json({
				state: 'fail',
				message: 'Node not found',
			})
		}

		return res.status(200).json({
			state: 'success',
			node: updatedNode,
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({
			state: 'fail',
			message: error.message,
		})
	}
}

/**
 * PATCH /api/nodes/bulk
 *
 * 1) same update for many nodes:
 * body:
 * {
 *   "ids": ["id1", "id2"],
 *   "updates": { "save_status": false }
 * }
 *
 * 2) different update per node:
 * body:
 * [
 *   { "id": "id1", "position": "A-1" },
 *   { "id": "id2", "position": "A-2", "save_status": true }
 * ]
 */
nodeController.bulkUpdateNodes = async (req, res) => {
	try {
		logger('request: bulkUpdateNodes')

		// format 1: array
		if (Array.isArray(req.body)) {
			if (req.body.length === 0) {
				return res.status(400).json({
					state: 'fail',
					message: 'Request array is empty',
				})
			}

			const operations = req.body
				.map(item => {
					const { id } = item
					const updates = pickAllowedUpdates(item, NODE_UPDATE_ALLOWED_FIELDS)

					if (!id || Object.keys(updates).length === 0) return null

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
				return res.status(400).json({
					state: 'fail',
					message: 'No valid bulk update operations found',
				})
			}

			const result = await NodeSchema.bulkWrite(operations)

			return res.status(200).json({
				state: 'success',
				message: 'Bulk update completed',
				data: {
					matchedCount: result.matchedCount ?? 0,
					modifiedCount: result.modifiedCount ?? 0,
				},
			})
		}

		// format 2: ids + updates
		const { ids, updates: rawUpdates } = req.body
		const updates = pickAllowedUpdates(rawUpdates, NODE_UPDATE_ALLOWED_FIELDS)

		if (!Array.isArray(ids) || ids.length === 0) {
			return res.status(400).json({
				state: 'fail',
				message: 'ids must be a non-empty array',
			})
		}

		if (Object.keys(updates).length === 0) {
			return res.status(400).json({
				state: 'fail',
				message: 'No valid fields provided for bulk update',
			})
		}

		if ('save_status' in updates) {
			updates.save_status_lastChange = new Date()
		}

		const result = await NodeSchema.updateMany(
			{ _id: { $in: ids } },
			{ $set: updates },
		)

		return res.status(200).json({
			state: 'success',
			message: 'Bulk update completed',
			data: {
				matchedCount: result.matchedCount,
				modifiedCount: result.modifiedCount,
			},
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({
			state: 'fail',
			message: error.message,
		})
	}
}

/**
 * PATCH /api/nodes/:id/gateway
 * body: { "gateway_id": "ObjectId or null" }
 */
nodeController.updateNodeGateway = async (req, res) => {
	try {
		logger('request: updateNodeGateway')

		const nodeId = req.params.id
		const { gateway_id } = req.body

		if (!nodeId) {
			return res.status(400).json({
				state: 'fail',
				message: 'Invalid node id',
			})
		}

		if (gateway_id === undefined) {
			return res.status(400).json({
				state: 'fail',
				message: 'gateway_id is required (can be null)',
			})
		}

		if (gateway_id !== null) {
			const gateway = await GatewaySchema.findById(gateway_id).lean()

			if (!gateway) {
				return res.status(404).json({
					state: 'fail',
					message: 'Gateway not found',
				})
			}
		}

		const updatedNode = await NodeSchema.findByIdAndUpdate(
			nodeId,
			{ $set: { gateway_id } },
			{ new: true, runValidators: true },
		)
			.select(
				'node_number gateway_id node_status node_alive lastSeen updatedAt',
			)
			.lean()

		if (!updatedNode) {
			return res.status(404).json({
				state: 'fail',
				message: 'Node not found',
			})
		}

		return res.status(200).json({
			state: 'success',
			node: updatedNode,
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({
			state: 'fail',
			message: error.message,
		})
	}
}

/**
 * DELETE /api/nodes/:id
 */
nodeController.deleteNode = async (req, res) => {
	try {
		logger('request: deleteNode')

		const nodeId = req.params.id
		const result = await NodeService.deleteNodeData(nodeId)

		return res.status(200).json({
			state: 'success',
			deleted: result,
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({
			state: 'fail',
			message: error.message,
		})
	}
}
