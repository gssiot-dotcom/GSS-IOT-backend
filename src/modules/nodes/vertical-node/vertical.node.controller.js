const VerticalNodeService = require('./vertical.node.service')
const { logger, logError } = require('../../../lib/logger')

// controller 객체 생성
let verticalNodeController = module.exports

verticalNodeController.createVerticalNodes = async (req, res) => {
	try {
		logger('request: createVerticalNodes')
		const verticalNodes = req.body

		// 🔍 요청 데이터가 배열인지 검증
		if (!Array.isArray(verticalNodes)) {
			return res.status(400).json({
				state: 'fail',
				message: 'Invalid data format. Expected an array.',
			})
		}

		const verticalNodeService = new VerticalNodeService()

		// Vertical-Node 생성 (중복 doorNum 체크)
		const createdNodes = await verticalNodeService.createVerticalNodesData(
			verticalNodes
		)

		res.json({
			state: 'success',
			message: `${createdNodes.length} vertical nodes created successfully!`,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.getVerticalNodesByGatewayId = async (req, res) => {
	try {
		logger('request: getVerticalNodesByGatewayId')
		const { gatewayId } = req.params

		const verticalNodeService = new VerticalNodeService()

		// Gateway ID로 Vertical Nodes 조회
		const verticalNodes = await verticalNodeService.getVerticalNodesByGatewayId(
			gatewayId
		)

		res.json({
			state: 'success',
			data: verticalNodes,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.getVerticalNodes = async (req, res) => {
	try {
		logger('request: getVerticalNodes')

		const verticalNodeService = new VerticalNodeService()

		// 모든 Vertical Nodes 조회
		const verticalNodes = await verticalNodeService.getVerticalNodes()

		res.json({
			state: 'success',
			data: verticalNodes,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.deleteVerticalNodeById = async (req, res) => {
	try {
		logger('request: deleteVerticalNodeById')
		const { verticalNodeId } = req.params

		const verticalNodeService = new VerticalNodeService()

		// Vertical Node 삭제
		await verticalNodeService.deleteVerticalNodeById(verticalNodeId)

		res.json({
			state: 'success',
			message: `Vertical node ${verticalNodeId} deleted successfully!`,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.updateVerticalNodeStatus = async (req, res) => {
	try {
		logger('request: updateVerticalNodeStatus')
		const { verticalNodeId } = req.params

		const verticalNodeService = new VerticalNodeService()

		// Vertical Node 상태 업데이트
		const updatedNode = await verticalNodeService.updateVerticalNodeStatus(
			verticalNodeId
		)

		res.json({
			state: 'success',
			data: updatedNode,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}
