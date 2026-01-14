const { createMqttClient } = require('./client')
const { topics } = require('./topics')
const { logError, logger } = require('../../lib/logger')

const {
	handleNodeMqttMessage,
} = require('../../modules/nodes/door-node/node.mqtt.service')
const {
	handleAngleMqttMessage,
} = require('../../modules/nodes/angle-node/angleNode.mqtt.service')

// export qilish kerak bo‘lsa:
let mqttClient

function initMqtt() {
	mqttClient = createMqttClient()

	mqttClient.on('connect', () => {
		topics.all.forEach(t => {
			mqttClient.subscribe(t, err => {
				if (!err) logger('Subscribed to:', t)
				else logError('Error subscribing:', err)
			})
		})
	})

	mqttClient.on('message', async (topic, buf) => {
		try {
			const data = JSON.parse(buf.toString())
			const gatewayNumberLast4 = topic.split('/').pop().slice(-4)

			// routing:
			if (topic.startsWith(topics.nodePrefix)) {
				await handleNodeMqttMessage({ topic, data, gatewayNumberLast4 })
				return
			}

			if (topic.startsWith(topics.anglePrefix)) {
				await handleAngleMqttMessage({ topic, data, gatewayNumberLast4 })
				return
			}

			if (topic.startsWith(topics.gwResPrefix)) {
				// xohlasangiz keyin alohida module qilasiz
				// hozircha eventBusga emit qilsa ham bo‘ladi
				const { eventBus } = require('../../shared/eventBus')
				eventBus.emit('gateway.response', { gatewayNumberLast4, data })
				return
			}
		} catch (err) {
			logError('MQTT message parse/dispatch error:', err?.message || err)
		}
	})

	return mqttClient
}

module.exports = { initMqtt, getMqttClient: () => mqttClient }
