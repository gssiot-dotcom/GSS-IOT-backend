const GatewaySchema = require('../gateways/gateway.model')
const { eventBus } = require('../../shared/eventBus')
const { logger, logError } = require('../../lib/logger')
const NodeSchema = require('./node.model')

async function findGatewayByLast4(last4) {
	if (!last4) return null
	return GatewaySchema.findOne({
		serial_number: { $regex: `${last4}$` },
	}).lean()
}

/**
 * 비계전도(AngleNode) 여러 개를 생성하는 서비스
 * @param {Array} arrayData - [{ node_number }, ...]
 * 1. node_number 기준 중복 체크
 * 2. 중복이 없으면 doorNum만 뽑아서 문서 생성(나머지 필드는 기본값)
 */
async function createNodesData(node_type, node_numbers) {
	try {
		// 이미 존재하는 doorNum 이 있는지 확인
		const existNodes = await NodeSchema.find({
			node_number: { $in: node_numbers.map(num => num) },
			node_type,
		})
		if (existNodes.length > 0) {
			const existNodeNums = existNodes.map(node => node.node_number)
			throw new Error(
				`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`,
			)
		}
		// AngleNode 는 doorNum 만 세팅하여 생성 (position 등은 추후 별도 API로 세팅)
		const arrayObject = node_numbers.map(number => ({
			node_number: number,
			node_type,
		}))

		const result = await NodeSchema.insertMany(arrayObject)
		return result
	} catch (error) {
		throw new Error(`Error: ${error.message}`)
	}
}

/**
 * node_status = true 인 활성 Angle-Node 들만 조회
 * @returns {Array|null}
 */
async function getActiveNodesData() {
	try {
		const nodes = await NodeSchema.find({
			node_status: true,
			gateway_id: null,
		})

		return nodes
	} catch (error) {
		throw new Error(`Error on getting Angle-Nodes: ${error.message}`)
	}
}

async function getPositionByDoorNum(doorNum) {
	try {
		const node = await NodeSchema.findOne({ doorNum: Number(doorNum) })
			.select('position save_status')
			.lean()
		return node
	} catch (e) {
		logError('getAngleNodePositionByDoorNum error:', e?.message || e)
		return null
	}
}

/**
 * 노드 상태 토글 (node_status true ↔ false)
 * @param {String} nodeId
 */
async function updateNodeStatusData(nodeId) {
	try {
		// MongoDB 4.2 부터 지원되는 파이프라인 업데이트 사용
		const updatingNode = await NodeSchema.findOneAndUpdate(
			{ _id: nodeId },
			[{ $set: { node_status: { $not: '$node_status' } } }],
			{ new: true }, // 변경 후 도큐먼트를 반환
		).select('node_number node_status node_type')

		if (!updatingNode) {
			throw new Error('Node not found')
		}

		return updatingNode
	} catch (error) {
		throw error
	}
}

/**
 * 노드 삭제
 * @param {String} nodeId
 */
async function deleteNodeData(nodeId) {
	try {
		const deletingNode = await NodeSchema.findOneAndDelete({
			_id: nodeId,
		})
		if (!deletingNode) {
			throw new Error('Node not found')
		}

		return deletingNode
	} catch (error) {
		console.error('Error deleting node:', error)
		throw error
	}
}

async function handleNodeMqttMessage({ data, gatewayNumberLast4 }) {
	logger('ANG-Node MPU-sensor data:', data, gatewayNumberLast4)
	const now = new Date()

	const ctx = await getGatewayContextByLast4(gatewayNumberLast4)
	if (!ctx) return

	const { gateway_id, buildingId, gateway_type, gw_position } = ctx
	const eventName =
		gateway_type === 'VERTICAL_NODE_GATEWAY' ? 'rt.vertical' : 'rt.angle'

	const doorNum = data.doorNum
	const rawX = Number(data.angle_x ?? 0)
	const rawY = Number(data.angle_y ?? 0)

	// realtime: cache offset bo‘lsa tez hisobla, bo‘lmasa raw bilan ketadi
	const { calibratedX, calibratedY } = getCalibratedFromCache(
		doorNum,
		rawX,
		rawY,
	)

	// ✅ realtime emit (DBsiz)
	eventBus.emit(eventName, {
		doorNum,
		gw_number: gatewayNumberLast4,
		gateway_id,
		buildingId,
		angle_x: calibratedX,
		angle_y: calibratedY,
		gw_position,
		lastSeen: now,
	})

	// ✅ background persist
	persistQueue.add(() =>
		persistAngleStuff({
			now,
			doorNum,
			gw_number: gatewayNumberLast4,
			gateway_id,
			buildingId,
			gw_position,
			rawX,
			rawY,
			calibratedX,
			calibratedY,
		}),
	)
}

// ====================== functions 류현 added ======================= //
/**
 * 단일 AngleNode position 설정 (doorNum 기준)
 * @param {Number|String} doorNum
 * @param {String} position
 */
async function setNodePosition(id, position) {
	if (!position || typeof position !== 'string') {
		throw new Error('position must be a non-empty string')
	}

	const node = await NodeSchema.findOneAndUpdate(
		{ _id: id },
		{ $set: { position } },
		{ new: true },
	)

	if (!node) {
		throw new Error(`AngleNode with node_number ${n} not found`)
	}

	return node
}

/**
 * 여러 개 AngleNode position 설정 (배열 [{node_number, position}, ...])
 * @param {Array<{node_number:number, position:string}>} positions
 */
async function setManyNodesPosition(positions) {
	if (!Array.isArray(positions) || positions.length === 0) {
		throw new Error('positions must be a non-empty array')
	}

	const results = []

	for (const item of positions) {
		const n = Number(item.node_number)
		if (!Number.isFinite(n)) {
			throw new Error(`Invalid doorNum: ${item.node_number}`)
		}
		if (!item.position || typeof item.position !== 'string') {
			throw new Error(`Invalid position for node_number: ${item.node_number}`)
		}

		const node = await NodeSchema.findOneAndUpdate(
			{ node_number: n },
			{ $set: { position: item.position } },
			{ new: true },
		).select('node_number node_type node_status position')

		if (!node) {
			throw new Error(`AngleNode with node_number ${n} not found`)
		}

		results.push(node)
	}

	return results
}

module.exports = {
	createNodesData,
	getActiveNodesData,
	updateNodeStatusData,
	deleteNodeData,
	setNodePosition,
	setManyNodesPosition,
	handleNodeMqttMessage,
	// 류현 added
	setNodePosition,
}
