// ProductController
// - 프론트/외부에서 들어오는 HTTP 요청(req)을 받아서
//   실제 비즈니스 로직을 담당하는 ProductService를 호출하고,
//   최종 응답(res)을 내려주는 역할을 합니다.

const ProductService = require('../services/product.service')
const path = require('path')
const AngleNodeHistory = require('../modules/nodes/angle-node/angleNode.model')
const { logger, logError } = require('../lib/logger')

// controller 객체 생성
let productController = module.exports

// =============================== Product creating & getting logics ================================== //

/**
 * POST /api/nodes
 * 해치발판(Node) 여러 개를 한 번에 생성하는 컨트롤러입니다.
 * - req.body 로 들어온 nodes 배열을 검증하고
 * - ProductService.createNodesData() 를 호출하여 DB에 저장합니다.
 */
productController.createNodes = async (req, res) => {
	try {
		logger('request: createNode')
		const nodes = req.body

		// 🔍 요청 데이터가 배열인지 검증
		if (!Array.isArray(nodes)) {
			return res.status(400).json({
				state: 'Failed',
				message: 'Invalid data format. Expected an array.',
			})
		}

		// 실제 비즈니스 로직 담당 서비스 인스턴스 생성
		const productService = new ProductService()

		// 노드 생성 로직 수행 (중복 doorNum 체크 포함)
		const createdNodes = await productService.createNodesData(nodes)

		// 생성된 노드 개수와 함께 응답
		res.json({
			state: 'succcess',
			message: `${createdNodes.length} nodes created successfully!`,
			nodes: createdNodes,
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/gateways
 * 일반 게이트웨이(Gateway)를 생성하는 컨트롤러입니다.
 * - req.body 전체를 ProductService.createGatewayData 에 넘겨 처리합니다.
 * - 내부에서 MQTT publish 까지 수행됩니다.
 */
productController.createGateway = async (req, res) => {
	try {
		logger('request: createGateway:')
		const data = req.body
		const productService = new ProductService()

		// 게이트웨이 생성 (중복 serial_number 체크, MQTT 설정 포함)
		await productService.createGatewayData(data)

		res.json({ state: 'succcess', message: '게이트웨이가 생성돼었읍니다' })
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
productController.makeWakeUpOfficeGateway = async (req, res) => {
	try {
		logger('request: makeWakeUpOfficeGateway:')
		const gwNumber = req.query.gw_number
		// 쿼리 문자열 "true"/"false" 를 boolean 으로 변환
		const alarmActive = req.query.alarmActive === 'true'
		const alertLevel = Number(req.query.alertLevel)
		const productService = new ProductService()

		// MQTT 로 wake-up 명령 전송
		const result = await productService.makeWakeUpOfficeGateway(
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
productController.createOfficeGateway = async (req, res) => {
	try {
		logger('request: createOfficeGateway:')
		const data = req.body
		const productService = new ProductService()

		// serial_number 필수 값 검증
		if (!data.serial_number) {
			return res
				.status(404)
				.json({ state: 'fail', message: 'Please serial number is required' })
		}

		// 게이트웨이 생성 (중복 체크 포함)
		await productService.createOfficeGatewayData(data)

		res.json({ state: 'succcess', message: '게이트웨이가 생성돼었읍니다' })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/angle-nodes
 * 비계전도(Angle-Node)를 여러 개 생성하는 컨트롤러입니다.
 * - req.body 가 배열인지 확인
 * - ProductService.createAngleNodesData 를 호출해 doorNum 기준으로 생성
 */
productController.createAngleNodes = async (req, res) => {
	try {
		logger('request: createAngleNodes')
		const angleNodes = req.body

		// 🔍 요청 데이터가 배열인지 검증
		if (!Array.isArray(angleNodes)) {
			return res.status(400).json({
				state: 'fail',
				message: 'Invalid data format. Expected an array.',
			})
		}

		const productService = new ProductService()

		// Angle-Node 생성 (중복 doorNum 체크)
		const createdNodes = await productService.createAngleNodesData(angleNodes)

		res.json({
			state: 'succcess',
			message: `${createdNodes.length} angle nodes created successfully!`,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

/**
 * GET /api/gateways
 * 전체 게이트웨이 목록을 조회하는 컨트롤러입니다.
 */
productController.getGateways = async (req, res) => {
	try {
		logger('request: getGateways')
		const productService = new ProductService()

		// 전체 게이트웨이 조회
		const gateways = await productService.getGatewaysData()

		res.json({ state: 'succcess', gateways: gateways })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

/**
 * GET /api/gateways/active
 * gateway_status = true 인 활성(사용중) 게이트웨이만 조회하는 컨트롤러입니다.
 */
productController.getActiveGateways = async (req, res) => {
	try {
		logger('request: getActiveGatewaysData')
		const productService = new ProductService()

		// 활성 게이트웨이 조회
		const gateways = await productService.getActiveGatewaysData()

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
productController.getSingleGateway = async (req, res) => {
	try {
		logger('request: getSingleGateway')
		const { number } = req.params

		const productService = new ProductService()
		const gateway = await productService.getSingleGatewayData(number)

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

/**
 * GET /api/nodes
 * 전체 해치발판 노드(Node) 목록을 조회하는 컨트롤러입니다.
 */
productController.getNodes = async (req, res) => {
	try {
		logger('request: getNodes')
		const productService = new ProductService()

		// 전체 노드 조회
		const nodes = await productService.getNodesData()

		res.json({ state: 'succcess', nodes: nodes })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

/**
 * GET /api/nodes/active
 * node_status = true 인 활성 노드만 조회하는 컨트롤러입니다.
 */
productController.getActiveNodes = async (req, res) => {
	try {
		logger('request: getNodes')
		const productService = new ProductService()

		// 활성 노드 조회
		const nodes = await productService.getActiveNodesData()

		res.json({ state: 'succcess', nodes: nodes })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * GET /api/angle-nodes/active
 * node_status = true 인 활성 비계전도 노드만 조회하는 컨트롤러입니다.
 */
productController.getActiveAngleNodes = async (req, res) => {
	try {
		logger('request: getActiveAngleNodes')
		const productService = new ProductService()

		// 활성 Angle-Node 조회
		const angleNodes = await productService.getActiveAngleNodesData()

		if (!angleNodes) {
			return res.status(404).json({
				state: 'fail',
				message: '동작 가능한 비계전도 노드가 없습니다.',
			})
		}

		res.status(200).json({
			state: 'success',
			angle_nodes: angleNodes,
		})
	} catch (error) {
		console.error('Error:', error.message)
		res.status(500).json({
			state: 'fail',
			message: 'Internal Server error',
			detail: error.message,
		})
	}
}

/**
 * GET /api/nodes/history/download?buildingId=...
 * 빌딩 ID 기준으로, 해당 빌딩에 연결된 게이트웨이들의 Door-Node 히스토리를
 * 엑셀 파일(xlsx)로 만들어 다운로드 시켜 주는 컨트롤러입니다.
 * - ProductService.downloadNodeHistoryData 가 buffer 를 생성해 줍니다.
 */
productController.downloadNodeHistory = async (req, res) => {
	try {
		logger('request: downloadNodeHistory')
		const { buildingId } = req.query
		const productService = new ProductService()

		// 엑셀 버퍼 생성 (노드별 문열림 횟수/마지막 시간 등 포함)
		const buffer = await productService.downloadNodeHistoryData(buildingId)

		// 다운로드용 헤더 설정
		res.setHeader(
			'Content-Disposition',
			'attachment; filename="building-nodes-history.xlsx"'
		)
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		)

		res.status(200).send(buffer)
	} catch (error) {
		console.error('Error generating Excel:', error)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/gateways/angle-nodes/combine
 * 비계전도 노드들을 특정 게이트웨이에 할당(묶기)하는 컨트롤러입니다.
 * - body: { gateway_id, serial_number, angle_nodes:[...ObjectId] }
 * - 내부에서 MQTT 로 angle-node 설정도 함께 전송합니다.
 */
productController.combineAngleNodeToGateway = async (req, res) => {
	try {
		logger('request: combineAngleNodeToGateway:')
		const data = req.body
		const productService = new ProductService()

		// 게이트웨이와 Angle-Node 를 연결하는 비즈니스 로직
		await productService.combineAngleNodeToGatewayData(data)

		res.json({
			state: 'succcess',
			message: '비계전도 노드가 게이트웨이에 할당되었습니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

// =============================== Product changing logic ================================== //

/**
 * POST /api/products/status
 * 노드 또는 게이트웨이의 상태(on/off)를 토글하는 컨트롤러입니다.
 * - body: { product_type: 'NODE' | 'GATEWAY', product_id: ObjectId }
 * - NODE: node_status 를 반전
 * - GATEWAY: gateway_status 를 반전
 */
productController.updateProductStatus = async (req, res) => {
	try {
		logger('POST: reActivateNode')
		const { product_type, product_id } = req.body
		const productService = new ProductService()

		if (product_type === 'NODE') {
			// 노드 활성/비활성 상태 토글
			const result = await productService.updateNodeStatusData(product_id)
			return res.json({
				state: 'success',
				updated_node: result,
			})
		} else if (product_type === 'GATEWAY') {
			// 게이트웨이 활성/비활성 상태 토글
			const result = await productService.updateGatewayStatusData(product_id)
			return res.json({
				state: 'success',
				updated_gateway: result,
			})
		}

		// 정의되지 않은 타입에 대한 에러 응답
		return res.json({
			state: 'fail',
			message: 'undefined product type.',
		})
	} catch (error) {
		logger('ERROR: update all nodes', error)
		res.status(500).json({ state: 'Fail', message: error.message })
	}
}

/**
 * POST /api/products/delete
 * 노드 또는 게이트웨이를 삭제하는 컨트롤러입니다.
 * - body: { product_type: 'NODE' | 'GATEWAY', product_id: ObjectId }
 * - NODE: 노드 단건 삭제
 * - GATEWAY: 게이트웨이 삭제 + 포함된 노드 node_status true 로 복구
 */
productController.deleteProduct = async (req, res) => {
	try {
		logger('POST: deleteProduct')
		const { product_type, product_id } = req.body
		const productService = new ProductService()

		if (product_type === 'NODE') {
			// 노드 삭제
			const result = await productService.deleteNodeData(product_id)
			return res.json({
				state: 'success',
				deleted: result,
			})
		} else if (product_type === 'GATEWAY') {
			// 게이트웨이 삭제 (포함 노드 상태 복구 포함)
			const result = await productService.deleteGatewayData(product_id)
			return res.json({
				state: 'Success',
				deleted: result,
			})
		}

		// 타입이 잘못된 경우
		return res.json({
			state: 'fail',
			message: 'undefined product type.',
		})
	} catch (error) {
		logger('ERROR: update all nodes', error)
		res.status(500).json({ state: 'Fail', message: error.message })
	}
}

/**
 * POST /api/nodes/positions
 * 노드들의 위치(position)를 직접 JSON으로 전달 받아 일괄 업데이트하는 컨트롤러입니다.
 * - body: [{ nodeNum, position }, ...]
 * - (엑셀 업로드 없이) API만으로 위치를 업데이트할 때 사용
 */
productController.setNodesPosition = async (req, res) => {
	try {
		logger('POST: setNodesPosition')
		const data = req.body

		// (필요 시) 데이터 유효성 검사를 추가로 할 수 있는 부분

		const nodeService = new ProductService()
		const result = await nodeService.setNodesPositionData(data)

		// 서비스에서 실패 상태(state: 'fail')를 넘겨준 경우 그대로 리턴
		if (result.state === 'fail') {
			return res.json(result)
		}

		// 성공 메시지 응답
		res.json({ state: 'success', message: result.message })
	} catch (error) {
		logger('Error on setNodesPosition', error.message)
		res.status(500).json({ state: 'fail', error: error.message })
	}
}

/**
 * POST /api/nodes/positions/upload
 * 노드 위치 정보가 포함된 엑셀 파일(.xlsx/.xls)을 업로드하고,
 * 파일 내부의 nodeNum/position 데이터로 Node.position 을 업데이트하는 컨트롤러입니다.
 * - body: { buildingId, nodesPosition: '[{nodeNum,position},...]' }
 * - file: req.files.file (업로드된 엑셀 파일)
 * - ProductService.setNodesPositionData 가 파일 저장 및 Building.nodes_position_file 갱신까지 수행
 */
productController.uploadXlsFile = async (req, res) => {
	try {
		logger('request: uploadXlsFile')
		const { buildingId, nodesPosition } = req.body

		// 업로드 파일 존재 여부 확인
		if (!req.files || !req.files.file) {
			return res.status(400).json({ error: 'Fayl tanlanmagan' })
		}

		// 문자열로 온 JSON 파싱
		const nodesPositionArrParsed = JSON.parse(nodesPosition)

		// 각 항목에 nodeNum, position 필수 값이 있는지 검증
		for (const item of nodesPositionArrParsed) {
			if (!item.nodeNum || !item.position) {
				return res.json({
					error: 'Fail',
					message:
						'No matching data structure, please check uploading file data structure!',
				})
			}
		}

		// 업로드 파일 객체 (여러 개 들어온 경우 첫 번째로 사용)
		const file = Array.isArray(req.files.file)
			? req.files.file[0]
			: req.files.file

		const nodeService = new ProductService()

		// 위치 업데이트 + 빌딩에 파일명 저장까지 처리
		const result = await nodeService.setNodesPositionData(
			nodesPositionArrParsed,
			buildingId,
			file
		)

		if (result.state == 'fail') {
			return res.json(result)
		}

		res.json({ state: 'success', message: result.message })
	} catch (error) {
		console.error(error)
		res.json({ error: 'Serverda xatolik yuz berdi', error: error })
	}
}

// ============================== Temporary Services ================================== //

/**
 * POST /api/gateways/zone-name
 * 게이트웨이에 zone_name(구역 이름)을 설정하는 컨트롤러입니다.
 * - body: { zone_name, gateway_id }
 * - ProductService.setGatewayZoneNameData 를 통해 DB에 저장합니다.
 */
productController.setGatewayZoneName = async (req, res) => {
	try {
		// req.body 에서 zone_name, gateway_id 추출
		const { zone_name, gateway_id } = req.body

		// zone_name 필수 값 체크
		if (!zone_name) {
			return res.status(400).json({ message: 'zone_name is needed' })
		}

		const productService = new ProductService()

		// 게이트웨이의 zone_name 필드 업데이트
		const result = await productService.setGatewayZoneNameData(
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
 * POST /api/angle-nodes/positions
 * 각 비계전도 노드의 위치(position)를 문자열로 일괄 설정하는 컨트롤러입니다.
 * - body: [{ doorNum, position }, ...]
 * - ProductService.setAngleNodePositionData 를 호출해 doorNum 기준으로 position 업데이트
 */
productController.setAngleNodePosition = async (req, res) => {
	try {
		// body 전체를 positions 배열로 사용
		const positions = req.body

		// 요청 데이터가 배열이고 비어있지 않은지 검증
		if (!Array.isArray(positions) || positions.length === 0) {
			return res.status(400).json({
				message: 'Positions is needed, please enter angle-node positions ',
			})
		}

		const productService = new ProductService()

		// doorNum 별 Angle-Node position 업데이트
		const result = await productService.setAngleNodePositionData(positions)

		return res.status(200).json({
			state: 'success',
			message: result.message,
		})
	} catch (error) {
		logError(error)
		return res.status(500).json({ state: 'fail', message: error.message })
	}
}

// ========================== Angle-Node-Graphic routes ================================== //

/**
 * GET /api/angle-nodes/graphic?doorNum=10&from=2025-01-01&to=2025-01-02
 * 특정 비계전도 노드(doorNum)의 각도 히스토리를 그래프용으로 리턴하는 컨트롤러입니다.
 * - AngleNodeHistory 컬렉션에서 doorNum 및 createdAt 범위로 조회 후 시간순 정렬
 * - 응답: [{ doorNum, angle_x, angle_y, position, createdAt, ... }, ...]
 * 프론트에서 이 데이터를 사용하여 차트(그래프)를 그릴 수 있습니다.
 */
productController.angleNodeGraphicData = async (req, res) => {
	logger('request: angleNodeGraphicData')

	try {
		const { doorNum, from, to } = req.query

		// 필수 쿼리 파라미터 확인
		if (!doorNum || !from || !to) {
			return res.status(400).json({ message: 'doorNum, from, to required' })
		}

		// AngleNodeHistory 에서 doorNum + 기간 조건으로 조회
		const data = await AngleNodeHistory.find({
			doorNum: parseInt(doorNum),
			createdAt: {
				$gte: new Date(from),
				$lte: new Date(to),
			},
		}).sort({ createdAt: 1 }) // 시간순 정렬(오름차순)

		res.json(data)
	} catch (err) {
		console.error('Error fetching data:', err)
		res.status(500).json({ message: 'Server error' })
	}
}

/**
 * POST /api/angle-nodes/:id/image
 * 비계전도 노드의 이미지를 업로드하고, position 도 함께 수정하는 컨트롤러입니다.
 * - params: { id: nodeId }
 * - body: { node_position }
 * - file: req.file (multer 등으로 업로드된 이미지 파일)
 * - ProductService.uploadAngleNodeImageData 가
 *   기존 이미지 삭제 + 새 이미지 파일명 저장 + position 업데이트까지 처리합니다.
 */
productController.uploadAngleNodeImage = async (req, res) => {
	try {
		console.log('EditNode Request ')
		const nodeId = req.params.id
		const { node_position } = req.body

		// 업로드 파일 존재 확인
		if (!req.file) {
			return res.status(400).json({ message: 'No file uploaded' })
		}
		// nodeId 필수 체크
		if (!nodeId) {
			return res.status(400).json({ message: 'node_id is needed' })
		}

		// multer 에 의해 저장된 파일명 (또는 path)
		const imageUrl = req.file.filename

		const productService = new ProductService()

		// 기존 이미지 삭제 + 새 이미지 및 위치 정보 저장
		const result = await productService.uploadAngleNodeImageData(
			nodeId,
			node_position,
			imageUrl
		)

		return res.status(200).json({
			state: 'success',
			message: 'Angle-node image uploaded successfully!',
			building: result,
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
productController.combineNodesToGateway = async (req, res) => {
	try {
		logger('request: combineNodesToGateway:')
		const data = req.body
		const productService = new ProductService()

		await productService.combineNodesToGatewayData(data)

		res.json({
			state: 'succcess',
			message: '노드가 게이트웨이에 할당되었습니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}
