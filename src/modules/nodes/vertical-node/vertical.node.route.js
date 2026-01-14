const verticalNodeRouter = require('express').Router()
const verticalNodeController = require('./vertical.node.controller')

// -------------------------------- Vertical Node endpoints -------------------------------//
verticalNodeRouter.post('/', verticalNodeController.createVerticalNodes)
verticalNodeRouter.get(
	'/gateway/:gatewayId',
	verticalNodeController.getVerticalNodesByGatewayId
)
verticalNodeRouter.get('/', verticalNodeController.getVerticalNodes)
verticalNodeRouter.delete(
	'/:verticalNodeId',
	verticalNodeController.deleteVerticalNodeById
)
verticalNodeRouter.patch(
	'/:verticalNodeId/status',
	verticalNodeController.updateVerticalNodeStatus
)

module.exports = verticalNodeRouter
