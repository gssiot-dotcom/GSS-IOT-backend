const {
	AngleNode,
	AngleNodeHistory,
	AngleNodeCalibration,
} = require('./angleNode.model')
const GatewaySchema = require('../../gateways/gateway.model')
const { eventBus } = require('../../../shared/eventBus')
const { logger, logError } = require('../../../lib/logger')
const { checkAndLogAngle } = require('../../../services/Alert.service') // sizdagi pathga moslang

async function findGatewayByLast4(last4) {
	if (!last4) return null
	return GatewaySchema.findOne({
		serial_number: { $regex: `${last4}$` },
	}).lean()
}

/**
 * 비계전도(AngleNode) 여러 개를 생성하는 서비스
 * @param {Array} arrayData - [{ doorNum }, ...]
 * 1. doorNum 기준 중복 체크
 * 2. 중복이 없으면 doorNum만 뽑아서 문서 생성(나머지 필드는 기본값)
 */
async function createAngleNodesData(arrayData) {
	try {
		// 이미 존재하는 doorNum 이 있는지 확인
		const existNodes = await AngleNode.find({
			doorNum: { $in: arrayData.map(obj => obj.doorNum) },
		})
		if (existNodes.length > 0) {
			const existNodeNums = existNodes.map(node => node.doorNum)
			throw new Error(
				`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`
			)
		}

		// AngleNode 는 doorNum 만 세팅하여 생성 (position 등은 추후 별도 API로 세팅)
		const arrayObject = arrayData.map(({ doorNum }) => ({
			doorNum,
		}))

		const result = await AngleNode.insertMany(arrayObject)
		return result
	} catch (error) {
		throw new Error(`Error: ${error.message}`)
	}
}

/**
 * node_status = true 인 활성 Angle-Node 들만 조회
 * @returns {Array|null}
 */
async function getActiveAngleNodesData() {
	try {
		const angleNodes = await AngleNode.find({ node_status: true })

		return angleNodes
	} catch (error) {
		throw new Error(`Error on getting Angle-Nodes: ${error.message}`)
	}
}

async function getAngleNodePositionByDoorNum(doorNum) {
	try {
		const node = await AngleNode.findOne({ doorNum: Number(doorNum) })
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
async function updateAngleNodeStatusData(nodeId) {
	try {
		// MongoDB 4.2 부터 지원되는 파이프라인 업데이트 사용
		const updatingNode = await AngleNode.findOneAndUpdate(
			{ _id: nodeId },
			[{ $set: { node_status: { $not: '$node_status' } } }],
			{ new: true } // 변경 후 도큐먼트를 반환
		)

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
async function deleteAngleNodeData(nodeId) {
	try {
		const deletingNode = await this.nodeSchema.findOneAndDelete({
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

async function handleAngleNodeMqttMessage({ data, gatewayNumberLast4 }) {
	const now = new Date()

	const doorNum = data.doorNum
	const angle_x = data.angle_x
	const angle_y = data.angle_y

	logger(`MPU-6500 sensor data from gateway-${gatewayNumberLast4}:`, data)

	// Gateway topib olamiz (buildingId uchun ham kerak)
	const gatewayDoc = await findGatewayByLast4(gatewayNumberLast4)
	const buildingId = gatewayDoc?.building_id || null
	const gateway_id = gatewayDoc?._id || null

	// Node alive/lastSeen
	await AngleNode.updateOne(
		{ doorNum },
		{ $set: { lastSeen: now, node_alive: true } },
		{ upsert: true }
	)

	// Gateway alive/lastSeen (regex bilan update qilish xavfsizroq)
	if (gatewayDoc?._id) {
		await GatewaySchema.updateOne(
			{ _id: gatewayDoc._id },
			{ $set: { lastSeen: now, gateway_alive: true } }
		)
	}

	// save_status guard
	const angleNodeMeta = await getAngleNodePositionByDoorNum(doorNum)
	const saveAllowed = angleNodeMeta?.save_status !== false
	if (!saveAllowed) {
		eventBus.emit('angleNode.updated', {
			doorNum,
			gw_number: gatewayNumberLast4,
			gateway_id,
			buildingId,
			node_alive: true,
			lastSeen: now,
			save_skipped: true,
		})
		logger(`save_status=false → skip (door ${doorNum})`)
		return
	}

	// ===== Calibration =====
	let calibDoc = await AngleNodeCalibration.findOne({ doorNum }).lean()

	if (calibDoc?.collecting) {
		const newCount = (calibDoc.sampleCount ?? 0) + 1
		const newSumX = (calibDoc.sumX ?? 0) + Number(angle_x ?? 0)
		const newSumY = (calibDoc.sumY ?? 0) + Number(angle_y ?? 0)
		const target = calibDoc.sampleTarget ?? 5

		if (newCount >= target) {
			const avgX = newSumX / newCount
			const avgY = newSumY / newCount

			await AngleNodeCalibration.updateOne(
				{ doorNum },
				{
					$set: {
						applied: true,
						collecting: false,
						offsetX: avgX,
						offsetY: avgY,
						appliedAt: new Date(),
						sampleCount: newCount,
						sumX: newSumX,
						sumY: newSumY,
					},
				}
			)

			calibDoc = {
				...calibDoc,
				applied: true,
				collecting: false,
				offsetX: avgX,
				offsetY: avgY,
			}
			logger(
				`Calibration 확정(door ${doorNum}) → offsetX=${avgX}, offsetY=${avgY}`
			)
		} else {
			await AngleNodeCalibration.updateOne(
				{ doorNum },
				{ $set: { sampleCount: newCount, sumX: newSumX, sumY: newSumY } }
			)
			logger(`Calibration 수집 중 (door ${doorNum}) ${newCount}/${target}`)
		}
	}

	const offsetX = calibDoc?.applied ? calibDoc.offsetX ?? 0 : 0
	const offsetY = calibDoc?.applied ? calibDoc.offsetY ?? 0 : 0

	let calibratedX = Number(angle_x ?? 0) - offsetX
	let calibratedY = Number(angle_y ?? 0) - offsetY
	calibratedX = parseFloat(calibratedX.toFixed(2))
	calibratedY = parseFloat(calibratedY.toFixed(2))

	// Latest update
	const updatedAngleNode = await AngleNode.findOneAndUpdate(
		{ doorNum },
		{
			$set: {
				angle_x: Number(angle_x ?? 0),
				angle_y: Number(angle_y ?? 0),
				calibrated_x: calibratedX,
				calibrated_y: calibratedY,
				lastSeen: now,
				node_alive: true,
			},
		},
		{ new: true, upsert: true }
	)

	// position snapshot
	const node_position = angleNodeMeta?.position
		? String(angleNodeMeta.position)
		: ''
	const gw_position = gatewayDoc?.zone_name ? String(gatewayDoc.zone_name) : ''

	await new AngleNodeHistory({
		gw_number: gatewayNumberLast4,
		doorNum,
		angle_x: calibratedX,
		angle_y: calibratedY,
		gw_position,
		node_position,
	})
		.save()
		.catch(err => logError('AngleNodeHistory 저장 오류:', err?.message || err))

	// Alert
	await checkAndLogAngle({
		gateway_serial: String(gatewayNumberLast4),
		doorNum,
		metric: 'angle_x',
		value: Number(calibratedX),
		raw: { angle_x, angle_y, calibratedX, calibratedY },
	})

	await checkAndLogAngle({
		gateway_serial: String(gatewayNumberLast4),
		doorNum,
		metric: 'angle_y',
		value: Number(calibratedY),
		raw: { angle_x, angle_y, calibratedX, calibratedY },
	})

	// 🔥 Socket uchun kerakli idlarni ham qo‘shib emit qilamiz
	eventBus.emit('angleNode.updated', {
		...(updatedAngleNode.toObject?.() ?? updatedAngleNode),
		gw_number: gatewayNumberLast4,
		gateway_id,
		buildingId,
	})
}

/**
 * 단일 AngleNode position 설정 (doorNum 기준)
 * @param {Number|String} doorNum
 * @param {String} position
 */
async function setAngleNodePositionData(doorNum, position) {
	const n = Number(doorNum)
	if (!Number.isFinite(n)) {
		throw new Error('doorNum must be a valid number')
	}
	if (!position || typeof position !== 'string') {
		throw new Error('position must be a non-empty string')
	}

	const node = await AngleNode.findOneAndUpdate(
		{ doorNum: n },
		{ $set: { position } },
		{ new: true }
	)

	if (!node) {
		throw new Error(`AngleNode with doorNum ${n} not found`)
	}

	return node
}

/**
 * 여러 개 AngleNode position 설정 (배열 [{doorNum, position}, ...])
 * @param {Array<{doorNum:number, position:string}>} positions
 */
async function setAngleNodePositionsData(positions) {
	if (!Array.isArray(positions) || positions.length === 0) {
		throw new Error('positions must be a non-empty array')
	}

	const results = []

	for (const item of positions) {
		const n = Number(item.doorNum)
		if (!Number.isFinite(n)) {
			throw new Error(`Invalid doorNum: ${item.doorNum}`)
		}
		if (!item.position || typeof item.position !== 'string') {
			throw new Error(`Invalid position for doorNum: ${item.doorNum}`)
		}

		const node = await AngleNode.findOneAndUpdate(
			{ doorNum: n },
			{ $set: { position: item.position } },
			{ new: true }
		)

		if (!node) {
			throw new Error(`AngleNode with doorNum ${n} not found`)
		}

		results.push(node)
	}

	return results
}

async function uploadAngleNodeImageData(nodeId, nodePosition, imageUrl) {
	const IMAGES_DIR = path.join(process.cwd(), 'static', 'images')
	try {
		// 1) 기존 도큐먼트에서 이전 이미지 파일명 확인
		const existing = await AngleNode.findById(nodeId)
			.select('angle_node_img')
			.lean()

		if (!existing) throw new Error('There is no any building with this _id')

		const oldImage = existing.angle_node_img
		logger(`existing: ${oldImage}`)

		// 이전 이미지가 있고, 이번에 올린 이미지와 다르면 파일 삭제 시도
		if (oldImage && oldImage !== imageUrl) {
			const oldBasename = path.basename(oldImage)
			const oldFilePath = path.join(IMAGES_DIR, oldBasename)

			logger(`cwd: ${process.cwd()}`)
			logger(`IMAGES_DIR: ${IMAGES_DIR}`)
			logger(`oldFilePath: ${oldFilePath}`)
			try {
				await fs.access(oldFilePath)
				await fs.unlink(oldFilePath)
				logger(`Old building plan image is deleted: ${oldFilePath}`)
			} catch (error) {
				// ENOENT(파일 없음)은 무시, 그 외 에러만 로그
				if (error.code !== 'ENOENT') {
					logError(
						`Failed to delete old image ${oldFilePath}: ${error.message}`
					)
				} else {
					logError(
						`Failed to delete old image ${oldFilePath}: ${error.message}`
					)
				}
			}
		}

		// 새 이미지 파일명과 position 으로 AngleNode 업데이트
		const angleNode = await AngleNode.findByIdAndUpdate(
			nodeId,
			{ $set: { angle_node_img: imageUrl, position: nodePosition } },
			{ new: true }
		)
		if (!angleNode) throw new Error('There is no any angleNode with this _id')
		return angleNode
	} catch (error) {
		logError(`Error on uploading building image: ${error}`)
		throw error
	}
}

// ====================== functions 류현 added ======================= //
/**
 * 단일 AngleNode position 설정 (doorNum 기준)
 * @param {Number|String} doorNum
 * @param {String} position
 */
async function setAngleNodePosition(doorNum, position) {
	const n = Number(doorNum)
	if (!Number.isFinite(n)) {
		throw new Error('doorNum must be a valid number')
	}
	if (!position || typeof position !== 'string') {
		throw new Error('position must be a non-empty string')
	}

	const node = await AngleNode.findOneAndUpdate(
		{ doorNum: n },
		{ $set: { position } },
		{ new: true }
	)

	if (!node) {
		throw new Error(`AngleNode with doorNum ${n} not found`)
	}

	return node
}

/**
 * 여러 개 AngleNode position 설정 (배열 [{doorNum, position}, ...])
 * @param {Array<{doorNum:number, position:string}>} positions
 */
async function setAngleNodePositions(positions) {
	if (!Array.isArray(positions) || positions.length === 0) {
		throw new Error('positions must be a non-empty array')
	}

	const results = []

	for (const item of positions) {
		const n = Number(item.doorNum)
		if (!Number.isFinite(n)) {
			throw new Error(`Invalid doorNum: ${item.doorNum}`)
		}
		if (!item.position || typeof item.position !== 'string') {
			throw new Error(`Invalid position for doorNum: ${item.doorNum}`)
		}

		const node = await AngleNode.findOneAndUpdate(
			{ doorNum: n },
			{ $set: { position: item.position } },
			{ new: true }
		)

		if (!node) {
			throw new Error(`AngleNode with doorNum ${n} not found`)
		}

		results.push(node)
	}

	return results
}

module.exports = {
	createAngleNodesData,
	getActiveAngleNodesData,
	updateAngleNodeStatusData,
	deleteAngleNodeData,
	setAngleNodePositionData,
	setAngleNodePositionsData,
	uploadAngleNodeImageData,
	handleAngleNodeMqttMessage,
	// 류현 added
	setAngleNodePosition,
	setAngleNodePositions,
}
