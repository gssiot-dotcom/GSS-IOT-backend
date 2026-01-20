const verticalNodeRouter = require('express').Router()
const verticalNodeController = require('./vertical.node.controller')

// -------------------------------- Vertical Node endpoints -------------------------------//
verticalNodeRouter.get('/', verticalNodeController.getVerticalNodes)
verticalNodeRouter.get(
	'/gateway/:gatewayId',
	verticalNodeController.getVerticalNodesByGatewayId,
)
verticalNodeRouter.get(
	'/graphic-data',
	verticalNodeController.verticalNodeGraphicData,
)

verticalNodeRouter.post('/create', verticalNodeController.createVerticalNodes)
// ---- Need to be completed
verticalNodeRouter.post(
	'/combine/to-gateway',
	verticalNodeController.verticalNodeGraphicData,
)

verticalNodeRouter.delete(
	'/:verticalNodeId',
	verticalNodeController.deleteVerticalNodeById,
)
verticalNodeRouter.patch(
	'/:verticalNodeId/status',
	verticalNodeController.updateVerticalNodeStatus,
)

module.exports = verticalNodeRouter
