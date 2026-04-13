const { getMqttClient } = require('../../infrastructure/mqtt')
const { eventBus } = require('../../shared/eventBus')
const { logger, logError } = require('../../lib/logger')
const { Node } = require('../nodes/door-node/node.model')
const { AngleNode } = require('../nodes/angle-node/angleNode.model')
const Gateway = require('./gateway.model')
const { default: mongoose } = require('mongoose')
const { VerticalNode } = require('../nodes/vertical-node/Vertical.node.model')

// ------------------------- Additional functions ------------------------------- //
async function publishAsync(client, topic, payload) {
	console.log('Publishing to MQTT:', { topic, payload })
	return new Promise((resolve, reject) => {
		client.publish(topic, JSON.stringify(payload), err => {
			if (err) reject(err)
			else resolve(true)
		})
	})
}

function waitForGatewayResponse({ gw_number, timeoutMs = 10000 }) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup()
			reject(new Error('MQTT response timeout'))
		}, timeoutMs)

		const handler = payload => {
			// payload: { gatewayNumberLast4, data }
			console.log('Received MQTT response:', payload)
			if (String(payload?.gw_number) !== String(gw_number)) return

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

// ----------------------- Route-Controller base functions --------------------------- //
async function createGatewayData(data) {
	try {
		// 기존 게이트웨이 존재 여부 체크
		const existGateway = await Gateway.findOne({
			serial_number: data.serial_number,
			gateway_type: data.gateway_type,
		})
		if (existGateway) {
			throw new Error(
				`일련 번호가 ${existGateway.serial_number}인 기존 게이트웨이가 있습니다. `,
			)
		}

		// ⭐ 노드/AngleNode/MQTT 아무 것도 안 건드리고, 게이트웨이만 생성
		const gateway = await Gateway.create(data)
		return gateway
	} catch (error) {
		throw new Error(`Error on creating-gateway: ${error.message}`)
	}
}

async function combineAngleNodeToGatewayData(data) {
	try {
		const { gateway_id, angle_nodes: nodesId } = data
		// 0 input validation
		if (!gateway_id) throw new Error('gateway_id is required')
		if (!Array.isArray(nodesId) || nodesId.length === 0) {
			throw new Error('Angle-nodes array (nodeIds) is required')
		}

		// Is Exist gateway
		const existGateway = await Gateway.findOne({
			_id: gateway_id,
		})
		if (!existGateway) {
			throw new Error(
				`게이트웨이가 없습니다. gateway_id=${gateway_id} 먼저 게이트웨이를 생성하세요`,
			)
		}
		// 2) kelgan nodeId lar hammasi bormi?
		const foundNewAngleNodes = await AngleNode.find(
			{ _id: { $in: nodesId } },
			{ _id: 1 },
		).lean()

		if (foundNewAngleNodes.length !== nodesId.length) {
			const foundSet = new Set(foundNewAngleNodes.map(n => String(n._id)))
			const missing = nodesId.filter(id => !foundSet.has(String(id)))
			throw new Error(`Some nodes not found: ${missing.join(', ')}`)
		}

		// 3) old node ids + new node ids => unique ids
		const oldIds = (existGateway.angle_nodes || []).map(id => String(id))
		const newIds = nodesId.map(id => String(id))
		const allUniqueIds = Array.from(new Set([...oldIds, ...newIds])).map(
			id => new mongoose.Types.ObjectId(id),
		)

		// 4) doorNum larni olish (old + new)
		const nodes = await AngleNode.find(
			{ _id: { $in: allUniqueIds } },
			{ doorNum: 1, _id: 1 },
		)
		if (!nodes.length) {
			throw new Error('연결할 노드가 없습니다. nodes 배열을 확인하세요.')
		}

		// 5) MQTT publish
		const gw_number = existGateway.serial_number
		const topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

		logger('COMBINE: Registering nodes:', nodes)

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
		// 2) response kutish promise'ini oldindan tayyorlab olamiz
		const waitPromise = waitForGatewayResponse({ gw_number, timeoutMs: 10000 })

		// 1) publish
		await publishAsync(mqttClient, topic, publishData)

		// 2) endi kutamiz
		await waitPromise

		// 3) success bo‘lsa DB update
		const angle_nodes = await AngleNode.updateMany(
			{ _id: { $in: nodesId } },
			{ $set: { node_status: false, gateway_id: existGateway._id } },
		)

		await Gateway.updateOne(
			{ _id: existGateway._id },
			{ $addToSet: { angle_nodes: { $each: nodesId } } },
		)

		return angle_nodes
	} catch (error) {
		throw new Error(`Error on Combining nodes to gateway: ${error.message}`)
	}
}

async function combineNodesToGatewayData(data) {
	try {
		const { gateway_id, nodes: nodesId } = data

		// 0) input validation
		if (!gateway_id) throw new Error('gateway_id is required')
		if (!Array.isArray(nodesId) || nodesId.length === 0) {
			throw new Error('nodes array (nodeIds) is required')
		}

		// 1) gateway mavjudmi
		const gateway = await Gateway.findById(gateway_id)
		if (!gateway) {
			throw new Error('Gateway not found, 먼저 게이트웨이를 생성하세요.')
		}

		// 2) kelgan nodeId lar hammasi bormi?
		// NOTE: find() -> [] qaytaradi, shuning uchun length tekshiramiz
		const foundNewNodes = await Node.find(
			{ _id: { $in: nodesId } },
			{ _id: 1 },
		).lean()

		if (foundNewNodes.length !== nodesId.length) {
			const foundSet = new Set(foundNewNodes.map(n => String(n._id)))
			const missing = nodesId.filter(id => !foundSet.has(String(id)))
			throw new Error(`Some nodes not found: ${missing.join(', ')}`)
		}

		// 3) old node ids + new node ids => unique ids
		const oldIds = (gateway.nodes || []).map(id => String(id))
		const newIds = nodesId.map(id => String(id))

		const allUniqueIds = Array.from(new Set([...oldIds, ...newIds])).map(
			id => new mongoose.Types.ObjectId(id),
		)

		// 4) doorNum larni olish (old + new)
		const nodes = await Node.find(
			{ _id: { $in: allUniqueIds } },
			{ doorNum: 1, _id: 0 },
		).lean()

		if (!nodes.length) {
			throw new Error('연결할 노드가 없습니다. nodes 배열을 확인하세요.')
		}

		// 5) MQTT publish
		const gw_number = gateway.serial_number
		const topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

		const publishData = {
			cmd: 2,
			nodeType: 0,
			numNodes: nodes.length,
			nodes: nodes.map(n => n.doorNum),
		}

		const mqttClient = getMqttClient()
		if (!mqttClient || !mqttClient.connected) {
			throw new Error('MQTT client is not connected (initMqtt called?)')
		}

		// 2) response kutish promise'ini oldindan tayyorlab olamiz
		const waitPromise = waitForGatewayResponse({ gw_number, timeoutMs: 10000 })

		// 1) publish
		await publishAsync(mqttClient, topic, publishData)

		// 2) endi kutamiz
		await waitPromise

		// 6) success bo‘lsa: faqat NEW node larni update qilish
		await Node.updateMany(
			{ _id: { $in: nodesId } },
			{ $set: { node_status: false, gateway_id: gateway._id } },
		)

		// 7) gateway.nodes ga faqat yangi nodeId larni dublikat qilmasdan qo‘shish
		// overwrite emas, addToSet ishlatamiz
		await Gateway.updateOne(
			{ _id: gateway._id },
			{ $addToSet: { nodes: { $each: nodesId } } },
		)

		// updated gateway qaytaramiz
		const updatedGateway = await Gateway.findById(gateway._id)
		return updatedGateway
	} catch (error) {
		throw new Error(`Error on combining-nodes-to-gateway: ${error.message}`)
	}
}

async function combineVerticalNodesToGateway(data) {
	try {
		const { gateway_id, vertical_nodes: nodesId } = data

		// 0) input validation
		if (!gateway_id) throw new Error('gateway_id is required')
		if (!Array.isArray(nodesId) || nodesId.length === 0) {
			throw new Error('nodes array (nodeIds) is required')
		}

		// 1) gateway mavjudmi
		const gateway = await Gateway.findById(gateway_id)
		if (!gateway) {
			throw new Error('Gateway not found, 먼저 게이트웨이를 생성하세요.')
		}

		// 2) kelgan nodeId lar hammasi bormi?
		// NOTE: find() -> [] qaytaradi, shuning uchun length tekshiramiz
		const foundNewNodes = await VerticalNode.find(
			{ _id: { $in: nodesId } },
			{ _id: 1 },
		).lean()

		console.log('Found vertical nodes for combining:', foundNewNodes)

		if (foundNewNodes.length !== nodesId.length) {
			const foundSet = new Set(foundNewNodes.map(n => String(n._id)))
			const missing = nodesId.filter(id => !foundSet.has(String(id)))
			throw new Error(`Some nodes not found: ${missing.join(', ')}`)
		}

		// 3) old node ids + new node ids => unique ids
		const oldIds = (gateway.nodes || []).map(id => String(id))
		const newIds = nodesId.map(id => String(id))

		const allUniqueIds = Array.from(new Set([...oldIds, ...newIds])).map(
			id => new mongoose.Types.ObjectId(id),
		)

		// 4) doorNum larni olish (old + new)
		const nodes = await VerticalNode.find(
			{ _id: { $in: allUniqueIds } },
			{ node_number: 1, _id: 0 },
		).lean()

		if (!nodes.length) {
			throw new Error('연결할 노드가 없습니다. nodes 배열을 확인하세요.')
		}

		// 5) MQTT publish
		const gw_number = gateway.serial_number
		const topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

		const publishData = {
			cmd: 2,
			nodeType: 2,
			numNodes: nodes.length,
			nodes: nodes.map(n => n.node_number),
		}

		const mqttClient = getMqttClient()
		if (!mqttClient || !mqttClient.connected) {
			throw new Error('MQTT client is not connected (initMqtt called?)')
		}

		// 2) response kutish promise'ini oldindan tayyorlab olamiz
		const waitPromise = waitForGatewayResponse({ gw_number, timeoutMs: 10000 })

		// 1) publish
		await publishAsync(mqttClient, topic, publishData)

		// 2) endi kutamiz
		await waitPromise

		// 6) success bo‘lsa: faqat NEW node larni update qilish
		await VerticalNode.updateMany(
			{ _id: { $in: nodesId } },
			{ $set: { node_status: false, gateway_id: gateway._id } },
		)

		// 7) gateway.nodes ga faqat yangi nodeId larni dublikat qilmasdan qo‘shish
		// overwrite emas, addToSet ishlatamiz
		await Gateway.updateOne(
			{ _id: gateway._id },
			{ $addToSet: { nodes: { $each: nodesId } } },
		)

		// updated gateway qaytaramiz
		const updatedGateway = await Gateway.findById(gateway._id)
		return updatedGateway
	} catch (error) {
		throw new Error(`Error on combining-nodes-to-gateway: ${error.message}`)
	}
}

async function makeWakeUpOfficeGateway(gw_number, alarmActive, alertLevel) {
	try {
		// 게이트웨이 토픽
		let topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

		const publishData = {
			cmd: 3, // 3: wake-up / 알람 설정 명령
			alarmActive,
			alertLevel: alertLevel,
		}
		logger('Publish-data:', publishData)

		// 4) MQTT 서버로 publish + 응답 대기 (NEW 방식)
		const mqttClient = getMqttClient()
		if (!mqttClient || !mqttClient.connected) {
			throw new Error('MQTT client is not connected (initMqtt called?)')
		}

		await publishAsync(mqttClient, topic, publishData)

		// 호출 측에서 토픽을 확인할 수 있도록 반환
		return topic
	} catch (error) {
		throw new Error(`Error on creating-gateway: ${error.message}`)
	}
}

async function getGatewaysData() {
	try {
		const gateways = await Gateway.find()
		if (!gateways || gateways.length == 0) {
			throw new Error('There is no any gateways in database :(')
		}
		return gateways
	} catch (error) {
		throw error
	}
}

async function getGatewaysByType() {
	try {
		const gateways = await Gateway.find()
		if (!gateways || gateways.length == 0) {
			throw new Error('There is no any gateways in database :(')
		}

		const result = {
			GATEWAY: [],
			VERTICAL_NODE_GATEWAY: [],
		}

		for (const g of gateways) {
			if (g.gateway_type === 'GATEWAY' || 'NODE_GATEWAY') result.GATEWAY.push(g)
			if (g.gateway_type === 'VERTICAL_NODE_GATEWAY')
				result.VERTICAL_NODE_GATEWAY.push(g)
		}

		return result
	} catch (error) {
		throw error
	}
}

async function getActiveGatewaysData() {
	try {
		const gateways = await Gateway.find({ gateway_status: true })
		if (!gateways || gateways.length == 0) {
			return []
		}
		return gateways
	} catch (error) {
		throw error
	}
}

async function getSingleGatewayData(gatewayNumber) {
	try {
		const gateway = await Gateway.findOne({
			serial_number: gatewayNumber,
		})

		return gateway || null
	} catch (error) {
		throw new Error(`Gateway olishda xatolik: ${error.message}`)
	}
}

async function updateGatewayStatusData(gatewayId) {
	try {
		const updatingGateway = await Gateway.findOneAndUpdate(
			{ _id: gatewayId },
			[{ $set: { gateway_status: { $not: '$gateway_status' } } }],
			{ new: true },
		)

		if (!updatingGateway) {
			throw new Error('Node not found')
		}

		return updatingGateway
	} catch (error) {
		throw error
	}
}

async function deleteGatewayData(gatewayId) {
	try {
		// Gateway 존재 여부 확인
		const gateway = await Gateway.findById(gatewayId)
		if (!gateway) {
			throw new Error('Gateway not found')
		}

		// Gateway 에 연결된 노드 목록
		const nodeIds = gateway.nodes

		// 노드가 존재한다면 node_status=true 로 복구
		if (nodeIds.length > 0) {
			await Node.updateMany(
				{ _id: { $in: nodeIds } },
				{ $set: { node_status: true } },
			)
		}

		// gateway 삭제
		const deletingGateway = await Gateway.findOneAndDelete({
			_id: gatewayId,
		})
		if (!deletingGateway) {
			throw new Error('Gateway not found or already deleted')
		}

		// 남아있는 전체 게이트웨이 목록 리턴
		const updatedGateways = await Gateway.find()
		return updatedGateways
	} catch (error) {
		logError('Error deleting gateway:', error)
		throw error
	}
}

async function setGatewayZoneNameData(gatewayId, zoneName) {
	try {
		const existing = await Gateway.findById(gatewayId)
		if (!existing) throw new Error('There is no any gateway with this _id')

		existing.zone_name = zoneName
		const updatedGateway = await existing.save()
		return updatedGateway
	} catch (error) {
		logError(`Error on uploading building image: ${error}`)
		throw error
	}
}

// ------------ 류현 added service ---------------- //

async function updateZoneNameById(id, zoneName) {
	if (!mongoose.isValidObjectId(id)) {
		throw new Error('invalid gateway id')
	}
	const zone = normalizeZoneName(zoneName)
	if (!zone) throw new Error('zone_name is required')

	const doc = await Gateway.findByIdAndUpdate(
		id,
		{ $set: { zone_name: zone } },
		{ new: true },
	).lean()

	if (!doc) throw new Error('gateway not found')
	return {
		ok: true,
		gateway_id: doc._id,
		serial_number: doc.serial_number,
		zone_name: doc.zone_name,
		building_id: doc.building_id,
		gateway_alive: doc.gateway_alive,
		lastSeen: doc.lastSeen,
	}
}

async function updateZoneNameBySerial(serial, zoneName) {
	const zone = normalizeZoneName(zoneName)
	if (!zone) throw new Error('zone_name is required')

	const doc = await Gateway.findOneAndUpdate(
		{ serial_number: String(serial) },
		{ $set: { zone_name: zone } },
		{ new: true },
	).lean()

	if (!doc) throw new Error('gateway not found')
	return {
		ok: true,
		gateway_id: doc._id,
		serial_number: doc.serial_number,
		zone_name: doc.zone_name,
		building_id: doc.building_id,
		gateway_alive: doc.gateway_alive,
		lastSeen: doc.lastSeen,
	}
}

function normalizeZoneName(v) {
	if (typeof v !== 'string') return null
	const s = v.trim()
	return s.length ? s : null
}

module.exports = {
	createGatewayData,
	getGatewaysData,
	getGatewaysByType,
	getActiveGatewaysData,
	getSingleGatewayData,
	updateGatewayStatusData,
	deleteGatewayData,
	makeWakeUpOfficeGateway,
	setGatewayZoneNameData,
	combineNodesToGatewayData,
	combineAngleNodeToGatewayData,
	combineVerticalNodesToGateway,
	updateZoneNameById,
	updateZoneNameBySerial,
}
