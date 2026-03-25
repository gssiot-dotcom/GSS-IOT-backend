const { createMqttClient } = require('./client')
const { topics } = require('./topics')
const { logError, logger } = require('../../lib/logger')

const {
	handleNodeMqttMessage,
} = require('../../modules/nodes/door-node/node.mqtt.service')
const {
	handleAngleNodeMqttMessage,
} = require('../../modules/nodes/angle-node/angleNode.mqtt.service')
const { ConcurrencyQueue } = require('../../utils/ConcurrencyQueue')

// export qilish kerak bo‘lsa:
let mqttClient

function safeJsonParse(buf) {
	try {
		return JSON.parse(buf.toString())
	} catch {
		return null
	}
}

function getGatewayLast4FromTopic(topic) {
	const last = topic.split('/').pop()
	return last ? last.slice(-4) : null
}

function initMqtt() {
	mqttClient = createMqttClient()

	// MQTT message processing concurrency limit (eng muhim fix)
	const mqttQueue = new ConcurrencyQueue({
		concurrency: 30, // server kuchiga qarab 10~100 oralig‘ida
		maxQueue: 10000, // peak paytda RAM to‘lib ketmasin
		onDrop: meta => logError('MQTT queue overflow -> DROP', meta),
	})

	mqttClient.on('connect', () => {
		topics.all.forEach(t => {
			mqttClient.subscribe(t, err => {
				if (!err) logger('Subscribed to:', t)
				else logError('Error subscribing:', err)
			})
		})
	})

	mqttClient.on('message', (topic, buf) => {
		const data = safeJsonParse(buf)
		if (!data) {
			logError('MQTT JSON parse error')
			return
		}

		const gatewayNumberLast4 = getGatewayLast4FromTopic(topic)
		if (!gatewayNumberLast4) return

		// ❗️endi barcha og‘ir ishlar queue ichida
		mqttQueue.add(
			async () => {
				try {
					if (topic.startsWith(topics.nodePrefix)) {
						await handleNodeMqttMessage({ topic, data, gatewayNumberLast4 })
						return
					}
					if (topic.startsWith(topics.anglePrefix)) {
						await handleAngleNodeMqttMessage({
							topic,
							data,
							gatewayNumberLast4,
						})
						return
					}
					if (topic.startsWith(topics.gwResPrefix)) {
						const { eventBus } = require('../../shared/eventBus')
						eventBus.emit('gateway.response', {
							gw_number: gatewayNumberLast4,
							data,
						})
						return
					}
				} catch (err) {
					logError('MQTT dispatch error:', err?.message || err)
				}
			},
			{ topic, gw: gatewayNumberLast4 },
		)
	})

	return mqttClient
}

module.exports = { initMqtt, getMqttClient: () => mqttClient }
