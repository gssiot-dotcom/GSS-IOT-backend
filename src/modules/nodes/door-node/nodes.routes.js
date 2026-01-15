const nodesRouter = require('express').Router()
const doorNodeController = require('./node.controller')

// ---------------------------------- Door Node endpoints ------------------------------ //
nodesRouter.post('/create-nodes', doorNodeController.createNodes)
nodesRouter.get('/get-nodes', doorNodeController.getNodes)
nodesRouter.get(
	'/get-alltype-active-nodes',
	doorNodeController.getAllTypeActiveNodes
)
// nodesRouter.get('/get-active-nodes', doorNodeController.getActiveNodes)
nodesRouter.post(
	'/combine/to-gateway',
	doorNodeController.combineNodesToGateway
)
nodesRouter.get(
	'/download-nodes-history',
	doorNodeController.downloadNodeHistory
)

module.exports = nodesRouter
