const GatewayService = require('./gateway.service')
const { logger, logError } = require('../../lib/logger')

// controller 객체 생성
let gatewayController = module.exports

/**
 * POST /api/gateways
 * 일반 게이트웨이(Gateway)를 생성하는 컨트롤러입니다.
 * - req.body 전체를 GatewayService.createGatewayData 에 넘겨 처리합니다.
 * - 내부에서 MQTT publish 까지 수행됩니다.
 */
gatewayController.createGateway = async (req, res) => {
	try {
		logger('request: createGateway:')
		const data = req.body
		if (!data.serial_number || !data.gateway_type) {
			return res.status(400).json({
				state: 'fail',
				message: 'Gateway number and gateway-type is required',
			})
		}

		// 게이트웨이 생성 (중복 serial_number 체크, MQTT 설정 포함)
		await GatewayService.createGatewayData(data)

		return res.json({
			state: 'succcess',
			message: '게이트웨이가 생성돼었읍니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * GET /api/gateways/wakeup?gw_number=0102&alarmActive=true&alertLevel=2
 * 사무실 게이트웨이에 '깨우기 / 알람 설정' 명령을 MQTT 로 전송하는 컨트롤러입니다.
 * - gw_number, alarmActive, alertLevel 을 쿼리로 받아서
 * - ProductService.makeWakeUpOfficeGateway 를 호출합니다.
 */
gatewayController.makeWakeUpOfficeGateway = async (req, res) => {
	try {
		logger('request: makeWakeUpOfficeGateway:')
		const gwNumber = req.query.gw_number
		// 쿼리 문자열 "true"/"false" 를 boolean 으로 변환
		const alarmActive = req.query.alarmActive === 'true'
		const alertLevel = Number(req.query.alertLevel)

		// MQTT 로 wake-up 명령 전송
		const result = await GatewayService.makeWakeUpOfficeGateway(
			gwNumber,
			alarmActive,
			alertLevel
		)

		res.json({ state: 'succcess', message: `request sent to ${result}` })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/gateways/office
 * 사무실용(Office) 게이트웨이를 생성하는 컨트롤러입니다.
 * - serial_number 필수 체크 후 ProductService.createOfficeGatewayData 호출
 */
// gatewayController.createOfficeGateway = async (req, res) => {
// 	try {
// 		logger('request: createOfficeGateway:')
// 		const data = req.body

// 		// serial_number 필수 값 검증
// 		if (!data.serial_number) {
// 			return res
// 				.status(404)
// 				.json({ state: 'fail', message: 'Please serial number is required' })
// 		}

// 		// 게이트웨이 생성 (중복 체크 포함)
// 		await GatewayService.createOfficeGatewayData(data)

// 		res.json({ state: 'succcess', message: '게이트웨이가 생성돼었읍니다' })
// 	} catch (error) {
// 		logError(error.message)
// 		res.json({ state: 'fail', message: error.message })
// 	}
// }

/**
 * GET /api/gateways
 * 전체 게이트웨이 목록을 조회하는 컨트롤러입니다.
 */
gatewayController.getGateways = async (req, res) => {
	try {
		logger('request: getGateways')

		// 전체 게이트웨이 조회
		const gateways = await GatewayService.getGatewaysData()

		res.json({ state: 'succcess', gateways: gateways })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

gatewayController.gatewaysByType = async (req, res) => {
	try {
		logger('request: gatewaysByType')

		// 전체 게이트웨이 조회
		const gateways = await GatewayService.getGatewaysByType()

		res.json({ state: 'succcess', gateways })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

/**
 * GET /api/gateways/active
 * gateway_status = true 인 활성(사용중) 게이트웨이만 조회하는 컨트롤러입니다.
 */
gatewayController.getActiveGateways = async (req, res) => {
	try {
		logger('request: getActiveGatewaysData')

		// 활성 게이트웨이 조회
		const gateways = await GatewayService.getActiveGatewaysData()

		res.json({ state: 'succcess', gateways: gateways })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * GET /api/gateways/:number
 * 특정 일련번호(serial_number)를 가진 게이트웨이 단건 조회 컨트롤러입니다.
 * - URL 파라미터 :number 를 사용합니다.
 */
gatewayController.getSingleGateway = async (req, res) => {
	try {
		logger('request: getSingleGateway')
		const { number } = req.params

		const gateway = await GatewayService.getSingleGatewayData(number)

		if (!gateway) {
			return res.status(404).json({
				state: 'Fail',
				message: '게이트웨이가 없읍니다,다른거 확인해보세요!',
			})
		}

		res.status(200).json({
			state: 'success',
			gateway,
		})
	} catch (error) {
		console.error('Xatolik:', error.message)
		res.status(500).json({
			state: 'fail',
			message: 'Internal Server error',
			detail: error.message,
		})
	}
}

gatewayController.setGatewayZoneName = async (req, res) => {
	try {
		// req.body 에서 zone_name, gateway_id 추출
		const { zone_name, gateway_id } = req.body

		// zone_name 필수 값 체크
		if (!zone_name) {
			return res.status(400).json({ message: 'zone_name is needed' })
		}

		// 게이트웨이의 zone_name 필드 업데이트
		const result = await GatewayService.setGatewayZoneNameData(
			gateway_id,
			zone_name
		)

		return res.status(200).json({
			state: 'success',
			message: 'Gateway-zone added successfully!',
			gateway: result,
		})
	} catch (error) {
		logError(error)
		return res.status(500).json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/products/combine-nodes
 * 기존 게이트웨이에 일반 Node 들을 연결하는 컨트롤러입니다.
 * - body: { gateway_id, nodes:[ObjectId,...] }
 * - 내부에서 MQTT publish 까지 수행됩니다.
 */
gatewayController.combineNodesToGateway = async (req, res) => {
	try {
		logger('request: combineNodesToGateway:')
		const data = req.body

		await GatewayService.combineNodesToGatewayData(data)

		res.json({
			state: 'succcess',
			message: '노드가 게이트웨이에 할당되었습니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

// ------------ 류현 added functions --------------- //

gatewayController.updateZoneNameById = async (req, res) => {
	try {
		const result = await GatewayService.updateZoneNameById(
			req.params.id,
			req.body?.zone_name
		)
		res.json(result)
	} catch (e) {
		const msg = e?.message || 'server error'
		const code = msg.includes('invalid gateway id')
			? 400
			: msg.includes('zone_name is required')
			? 400
			: msg.includes('gateway not found')
			? 404
			: 500
		res.status(code).json({ ok: false, message: msg })
	}
}

gatewayController.updateZoneNameBySerial = async (req, res) => {
	try {
		const result = await GatewayService.updateZoneNameBySerial(
			req.params.serial,
			req.body?.zone_name
		)
		res.json(result)
	} catch (e) {
		const msg = e?.message || 'server error'
		const code = msg.includes('zone_name is required')
			? 400
			: msg.includes('gateway not found')
			? 404
			: 500
		res.status(code).json({ ok: false, message: msg })
	}
}
