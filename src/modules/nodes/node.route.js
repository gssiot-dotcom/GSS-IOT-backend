const nodeRouter = require('express').Router()
const nodeController = require('./node.controller')
const { authMiddleware, isAuth } = require('../../middlewares/auth.middleware')
const { isAdmin } = require('../../middlewares/admin.middleware')

// ---------------------------------- Node endpoints ----------------------------- //
nodeRouter.use(isAuth)

nodeRouter.post('/', isAdmin, nodeController.createNodes)
nodeRouter.get('/', isAdmin, nodeController.getNodes)
nodeRouter.get('/active', nodeController.getActiveNodes)
nodeRouter.get('/graphic-data', nodeController.nodeGraphicData)

nodeRouter.patch('/bulk', nodeController.bulkUpdateNodes)
nodeRouter.patch('/:id', nodeController.updateNode)
nodeRouter.patch('/:id/gateway', nodeController.updateNodeGateway) // need to complete with mqtt

nodeRouter.delete('/:id', nodeController.deleteNode)

module.exports = nodeRouter
