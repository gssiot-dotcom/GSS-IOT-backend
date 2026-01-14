const router = require('express').Router()
const buildingRouter = router
const buildingController = require('./building.controller')

// ========== Building related endpoints ======= //
buildingRouter.post('/create-building', buildingController.createBuilding)
buildingRouter.get(
	'/get-active-buildings',
	buildingController.getActiveBuildings
)
buildingRouter.get('/get-buildings', buildingController.getBuildings)
buildingRouter.get('/buildings/:id', buildingController.getBuildingNodes)
buildingRouter.get(
	'/buildings/:id/angle-nodes',
	buildingController.getBuildingAngleNodes
)
// buildingRouter.get(
// 	'/buildings/:id/angle-nodes/summary',
// 	buildingController.getAngleNodeSummary
// )
buildingRouter.delete(
	'/delete/building/:buildingId',
	buildingController.deleteBuilding
)
// 🔹 여기 추가
buildingRouter.put(
	'/building/change-gateway-building',
	buildingController.changeGatewayBuilding
)

buildingRouter.put(
	'/building/set-alarm-level',
	buildingController.setAlarmLevel
)

module.exports = buildingRouter
