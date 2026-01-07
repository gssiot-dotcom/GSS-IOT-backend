const { eventBus } = require('../../shared/eventBus')
const GatewaySchema = require('../../schema/Gateway.model')

let io

async function getGatewayById(gateway_id) {
	if (!gateway_id) return null
	return GatewaySchema.findById(gateway_id).lean()
}

function initSocket(serverIo) {
	io = serverIo

	// Node update -> building topic
	eventBus.on('node.updated', async updatedNode => {
		const gateway = await getGatewayById(updatedNode.gateway_id)
		if (!gateway) return

		const buildingId = gateway.building_id
		const topic = `mqtt/building/${buildingId}`
		io.emit(topic, updatedNode)
	})

	// Angle update -> buildingId bo‘lsa direct
	eventBus.on('angle.updated', async anglePayload => {
		// Biz angle payloadga buildingId qo‘shib yubordik:
		const buildingId = anglePayload.buildingId
		if (!buildingId) return

		const topic = `${buildingId}_angle-nodes`
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
