const { getMqttClient } = require('../infrastructure/mqtt')
const { eventBus } = require('../shared/eventBus')

/**
 * 일반 게이트웨이만 생성
 * @param {Object} data - { serial_number, ... }
 */
async function createGatewayData(data) {
	try {
		// 기존 게이트웨이 존재 여부 체크
		const existGateway = await GatewaySchema.findOne({
			serial_number: data.serial_number,
		})
		if (existGateway) {
			throw new Error(
				`일련 번호가 ${existGateway.serial_number}인 기존 게이트웨이가 있습니다. `
			)
		}

		// ⭐ 노드/AngleNode/MQTT 아무 것도 안 건드리고, 게이트웨이만 생성
		const gateway = await this.gatewaySchema.create(data)
		return gateway
	} catch (error) {
		throw new Error(`Error on creating-gateway: ${error.message}`)
	}
}

/**
 * 기존 게이트웨이에 일반 노드(Node)들을 연결 + MQTT로 노드 리스트 publish
 * @param {Object} data - { gateway_id, nodes:[ObjectId,...] }
 */
async function publishAsync(client, topic, payload) {
	return new Promise((resolve, reject) => {
		client.publish(topic, JSON.stringify(payload), err => {
			if (err) reject(err)
			else resolve(true)
		})
	})
}

// --- sizning methodingiz ichida ---
async function combineAngleNodeToGatewayData(data) {
	try {
		const existGateway = await this.gatewaySchema.findOne({
			_id: data.gateway_id,
		})
		if (!existGateway) {
			throw new Error(
				`게이트웨이가 없습니다. gateway_id=${data.gateway_id} 먼저 게이트웨이를 생성하세요`
			)
		}

		const gw_number = data.serial_number // sizda shunday edi
		// const gatewayLast4 = String(gw_number).slice(-4) // ✅ response filter uchun
		const nodesId = data.angle_nodes

		const nodes = await this.angleNodeSchema.find(
			{ _id: { $in: nodesId } },
			{ doorNum: 1, _id: 1 }
		)

		const topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

		const publishData = {
			cmd: 2,
			nodeType: 1,
			numNodes: nodes.length,
			nodes: nodes.map(n => n.doorNum),
		}

		logger('Publish-data:', publishData, topic)

		const mqttClient = getMqttClient()
		if (!mqttClient || !mqttClient.connected) {
			throw new Error('MQTT client is not connected (initMqtt called?)')
		}

		// 1) publish
		await publishAsync(mqttClient, topic, publishData)

		// 2) response kutish (eventBus orqali)
		await waitForGatewayResponse({ gw_number, timeoutMs: 10000 })

		// 3) success bo‘lsa DB update
		const angle_nodes = await this.angleNodeSchema.updateMany(
			{ _id: { $in: nodesId } },
			{ $set: { node_status: false, gateway_id: existGateway._id } }
		)

		await existGateway.updateOne({ $set: { angle_nodes: nodesId } })

		return angle_nodes
	} catch (error) {
		throw new Error(`Error on creating-gateway: ${error.message}`)
	}
}

function waitForGatewayResponse({ gatewayLast4, timeoutMs = 10000 }) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup()
			reject(new Error('MQTT response timeout'))
		}, timeoutMs)

		const handler = payload => {
			// payload: { gatewayNumberLast4, data }
			if (String(payload?.gatewayNumberLast4) !== String(gatewayLast4)) return

			cleanup()

			if (payload?.data?.resp === 'success') resolve(true)
			else reject(new Error('Failed publishing for Angle-node gateway to mqtt'))
		}

		const cleanup = () => {
			clearTimeout(timer)
			eventBus.removeListener('gateway.response', handler)
		}

		eventBus.on('gateway.response', handler)
	})
}

module.exports = {
	createGatewayData,
	combineAngleNodeToGatewayData,
}
