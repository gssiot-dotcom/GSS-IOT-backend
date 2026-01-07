const NodeHistorySchema = require('../../schema/History.model')
const NodeSchema = require('../../schema/Node.model')
const { eventBus } = require('../../shared/eventBus')
const { logger, logError, logInfo } = require('../../lib/logger')

async function handleNodeMqttMessage({ data, gatewayNumberLast4 }) {
	const now = new Date()
	const timeString = now.toLocaleString('ko-KR', {
		timeZone: 'Asia/Seoul',
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})

	logger('Door-Node mqtt message:', data, '|', timeString)

	const eventData = {
		gw_number: gatewayNumberLast4,
		doorNum: data.doorNum,
		doorChk: data.doorChk,
		betChk: data.betChk_3,
	}

	const updateData = {
		doorChk: data.doorChk,
		betChk: data.betChk_3,
		...(data.betChk_2 !== undefined && { betChk_2: data.betChk_2 }),
	}

	const updatedNode = await NodeSchema.findOneAndUpdate(
		{ doorNum: data.doorNum },
		{ $set: updateData },
		{ new: true }
	)

	if (!updatedNode) {
		logInfo('Node를 찾을 수 없음:', data.doorNum)
		return
	}

	try {
		await new NodeHistorySchema(eventData).save()
	} catch (err) {
		logError('NodeHistorySchema 저장 오류:', err.message)
		return
	}

	// 🔥 endi mqttEmitter emas, eventBus:
	eventBus.emit('node.updated', updatedNode)
}

module.exports = { handleNodeMqttMessage }
