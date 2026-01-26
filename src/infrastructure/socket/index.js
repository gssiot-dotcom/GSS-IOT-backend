const { eventBus } = require('../../shared/eventBus')
const GatewaySchema = require('../../modules/gateways/gateway.model')

let io

async function getGatewayById(gateway_id) {
	if (!gateway_id) return null
	return GatewaySchema.findById(gateway_id).lean()
}

function initSocket(serverIo) {
	io = serverIo

	// Node update -> building topic
	eventBus.on('node.updated', async updatedNode => {
		// console.log('eventBus data income:', updatedNode)
		const gateway = await getGatewayById(updatedNode.gateway_id)
		if (!gateway) return

		const buildingId = gateway.building_id
		const topic = `socket/building/${buildingId}/node`
		io.emit(topic, updatedNode)
	})

	// Angle update -> buildingId bo‘lsa direct
	eventBus.on('angleNode.updated', async anglePayload => {
		// Biz angle payloadga buildingId qo‘shib yubordik:
		// console.log('eventBus data income:', anglePayload)

		const buildingId = anglePayload.buildingId
		if (!buildingId) return

		const topic = `socket/building/${buildingId}/angle-nodes`
		io.emit(topic, anglePayload)
	})

	eventBus.on('verticalNode.updated', async anglePayload => {
		// Biz angle payloadga buildingId qo‘shib yubordik:
		// console.log('verticalNode.updated', anglePayload)

		const buildingId = anglePayload.buildingId
		if (!buildingId) return

		const topic = `socket/building/${buildingId}/vertical-nodes`
		io.emit(topic, anglePayload)
	})

	io.on('connection', socket => {
		console.log(`New SOCKET user connected: ${socket.id}`)
		socket.on('disconnect', () => {
			console.log(`SOCKET user disconnected: ${socket.id}`)
		})
	})
}

module.exports = { initSocket }
