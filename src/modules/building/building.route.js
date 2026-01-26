const router = require('express').Router()
const buildingRouter = router
const buildingController = require('./building.controller')

// ========== Building related endpoints ======= //
buildingRouter.post('/create', buildingController.createBuilding)
buildingRouter.get('/active-buildings', buildingController.getActiveBuildings)
buildingRouter.get('/get-buildings', buildingController.getBuildings)
buildingRouter.get('/:id', buildingController.getBuildingNodes)
buildingRouter.get('/:id/angle-nodes', buildingController.getBuildingAngleNodes)
buildingRouter.get(
	'/:id/vertical-nodes',
	buildingController.getBuildingVerticalNodes,
)

// buildingRouter.get(
// 	'/buildings/:id/angle-nodes/summary',
// 	buildingController.getAngleNodeSummary
// )
buildingRouter.delete('/delete/:buildingId', buildingController.deleteBuilding)
// 🔹 여기 추가
buildingRouter.put(
	'/building/change-gateway-building',
	buildingController.changeGatewayBuilding,
)

buildingRouter.put('/set-alarm-level', buildingController.setAlarmLevel)

module.exports = buildingRouter
