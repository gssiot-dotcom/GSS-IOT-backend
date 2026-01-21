const router = require('express').Router()
const gateway_router = router
const gatewayController = require('./gateway.controller')

gateway_router.post('/create', gatewayController.createGateway)

gateway_router.get(
	'/wake-up-gateway',
	gatewayController.makeWakeUpOfficeGateway,
)
gateway_router.get('/', gatewayController.getGateways)
gateway_router.get('/gateways-bytype', gatewayController.gatewaysByType)
gateway_router.get('/active-gateways', gatewayController.getActiveGateways)
gateway_router.get(
	'/single-gateway/:number',
	gatewayController.getSingleGateway,
)
gateway_router.put('/gateway/zone-name', gatewayController.setGatewayZoneName)
gateway_router.post('/update-status', gatewayController.updateGatewayStatus)
gateway_router.delete('/delete', gatewayController.deletGateway)

// ------------------------- 류현 added functions --------------------- //

// PATCH /api/gateways/:id/position
gateway_router.patch('/:id/position', gatewayController.updateZoneNameById)

// PATCH /api/gateways/by-serial/:serial/position
gateway_router.patch(
	'/by-serial/:serial/position',
	gatewayController.updateZoneNameBySerial,
)

// ---- Need to check -----
// gateway_router.post(
// 	'/create-office-gateway',
// 	gatewayController.createOfficeGateway
// )

module.exports = gateway_router
