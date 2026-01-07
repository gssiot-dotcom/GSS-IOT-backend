const AngleNodeHistory = require('../../schema/Angle.node.history.model')
const AngleNodeSchema = require('../../schema/Angle.node.model')
const GatewaySchema = require('../../schema/Gateway.model')
const AngleCalibration = require('../../schema/Angle.Calibration.model')
const { eventBus } = require('../../shared/eventBus')
const { logger, logError } = require('../../lib/logger')

const { checkAndLogAngle } = require('../../services/Alert.service') // sizdagi pathga moslang

async function findGatewayByLast4(last4) {
	if (!last4) return null
	return GatewaySchema.findOne({
		serial_number: { $regex: `${last4}$` },
	}).lean()
}

async function getAngleNodePositionByDoorNum(doorNum) {
	try {
		const node = await AngleNodeSchema.findOne({ doorNum: Number(doorNum) })
			.select('position save_status')
			.lean()
		return node
	} catch (e) {
		logError('getAngleNodePositionByDoorNum error:', e?.message || e)
		return null
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
	await AngleNodeSchema.updateOne(
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
	let calibDoc = await AngleCalibration.findOne({ doorNum }).lean()

	if (calibDoc?.collecting) {
		const newCount = (calibDoc.sampleCount ?? 0) + 1
		const newSumX = (calibDoc.sumX ?? 0) + Number(angle_x ?? 0)
		const newSumY = (calibDoc.sumY ?? 0) + Number(angle_y ?? 0)
		const target = calibDoc.sampleTarget ?? 5

		if (newCount >= target) {
			const avgX = newSumX / newCount
			const avgY = newSumY / newCount

			await AngleCalibration.updateOne(
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
			await AngleCalibration.updateOne(
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
	const updatedAngleNode = await AngleNodeSchema.findOneAndUpdate(
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

module.exports = { handleAngleNodeMqttMessage }
