const { Node, NodesHistory } = require('../../nodes/door-node/node.model')
const BuildingSchema = require('../../building/building.model')
const GatewaySchema = require('../../gateways/gateway.model')
const { eventBus } = require('../../../shared/eventBus')
const { logger, logError, logInfo } = require('../../../lib/logger')
const fileService = require('../../../services/file.service')
const { AngleNode } = require('../angle-node/angleNode.model')
const { VerticalNode } = require('../vertical-node/Vertical.node.model')

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

	const updatedNode = await Node.findOneAndUpdate(
		{ doorNum: data.doorNum },
		{ $set: updateData },
		{ new: true }
	)

	if (!updatedNode) {
		logInfo('Node를 찾을 수 없음:', data.doorNum)
		return
	}

	try {
		await new NodesHistory(eventData).save()
	} catch (err) {
		logError('NodesHistory 저장 오류:', err.message)
		return
	}

	// 🔥 endi mqttEmitter emas, eventBus:
	eventBus.emit('node.updated', updatedNode)
}

/**
 * 해치발판 Node 여러 개를 한 번에 생성하는 서비스
 * @param {Array} arrayData - [{ doorNum, ... }, ...]
 * 1. doorNum 기준으로 기존 노드 중복 여부 확인
 * 2. 중복 있으면 에러 throw
 * 3. insertMany 로 한 번에 노드 생성
 */
async function createNodesData(arrayData) {
	try {
		// 이미 존재하는 doorNum 이 있는지 확인
		const existNodes = await Node.find({
			doorNum: { $in: arrayData.map(data => data.doorNum) },
		})
		if (existNodes.length > 0) {
			const existNodeNums = existNodes.map(node => node.doorNum)
			throw new Error(
				`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`
			)
		}

		// 중복이 없으면 그대로 삽입
		const result = await Node.insertMany(arrayData)
		return result
	} catch (error) {
		throw new Error(`Error: ${error.message}`)
	}
}

/**
 * 모든 Node 조회
 */
async function getNodesData() {
	try {
		const nodes = await Node.find()
		if (!nodes || nodes.length == 0) {
			throw new Error('There is no any nodes in database :(')
		}
		return nodes
	} catch (error) {
		throw error
	}
}

/**
 * node_status = true 인 활성 Node 들만 조회
 * - 없으면 빈 배열 반환
 */
async function getAllTypeActiveNodesData() {
	try {
		const door_nodes = await Node.find({ node_status: true })
		const angle_nodes = await AngleNode.find({ node_status: true })
		const vertical_nodes = await VerticalNode.find({ node_status: true })
		if (!door_nodes || !angle_nodes.length || !vertical_nodes) {
			return []
		}
		const result = {
			nodes: door_nodes,
			angle_nodes,
			vertical_nodes,
		}
		return result
	} catch (error) {
		throw error
	}
}

/**
 * 단일 노드 위치 업데이트
 * @param {Number} doorNum 
 * @param {String} position 
 */
async function updateNodePositionData(doorNum, position) {
	try {
		const updatedNode = await Node.findOneAndUpdate(
			{ doorNum: doorNum },
			{ $set: { position: position } },
			{ new: true } // 업데이트된 결과 객체 반환
		)

		if (!updatedNode) {
			throw new Error('해당 번호의 노드를 찾을 수 없습니다.')
		}

		return updatedNode
	} catch (error) {
		throw error
	}
}

// module.exports에 추가 잊지 마세요!
module.exports = {
	// ... 기존 export 항목들
	updateNodePositionData,
}
/**
 * 빌딩 ID 기준으로 노드 히스토리 통계를 내고, 엑셀 파일 버퍼를 생성
 * Flow:
 *  1. Building 조회 → gateway_sets 에 포함된 게이트웨이들의 serial_number 추출
 *  2. NodeHistory 에서 gw_number ∈ serialNumbers 인 기록 모두 조회
 *  3. doorNum 별로 doorChk=1 인 횟수와 마지막 열린 시간 집계
 *  4. 집계 결과 배열(result)을 createExcelFile 에 전달하여 ExcelJS 버퍼 생성
 */
async function downloadNodeHistoryData(buildingId) {
	try {
		// 빌딩 정보 조회 (어떤 게이트웨이들이 연결되어 있는지 확인)
		const building = await BuildingSchema.findById(buildingId)

		// 빌딩에 연결된 게이트웨이들의 serial_number 추출
		const buildingGateways = await GatewaySchema.find(
			{
				_id: { $in: building.gateway_sets },
			},
			{ serial_number: 1, _id: 0 }
		)

		const serialNumbers = buildingGateways.map(gateway => gateway.serial_number)

		// 해당 게이트웨이들에서 발생한 NodeHistory 전체 조회
		const history = await NodesHistory.find({
			gw_number: { $in: serialNumbers },
		})

		// 히스토리가 하나도 없으면 에러
		if (!history || history.length === 0) {
			throw new Error('History is not found')
		}

		// doorNum 기준 문 열림 횟수 및 마지막 열린 시간 집계
		const doorStats = {} // { doorNum: { doorOpen_count, gw_number, last_open } }

		history.forEach(entry => {
			if (entry.doorChk === 1) {
				if (!doorStats[entry.doorNum]) {
					// 첫 등장일 경우
					doorStats[entry.doorNum] = {
						doorOpen_count: 1,
						gw_number: entry.gw_number,
						last_open: entry.createdAt,
					}
				} else {
					doorStats[entry.doorNum].doorOpen_count++
					// 마지막 열린 시간 최신값으로 갱신
					if (
						new Date(entry.createdAt) >
						new Date(doorStats[entry.doorNum].last_open)
					) {
						doorStats[entry.doorNum].last_open = entry.createdAt
					}
				}
			}
		})

		// doorStats 오브젝트를 배열 형태로 변환
		const result = Object.entries(doorStats).map(([doorNum, data]) => {
			const lastOpenDate =
				typeof data.last_open === 'string'
					? data.last_open
					: new Date(data.last_open).toISOString()

			return {
				doorNum: Number(doorNum),
				doorOpen_count: data.doorOpen_count,
				gw_number: data.gw_number,
				last_open: lastOpenDate.substring(0, 10), // YYYY-MM-DD
			}
		})

		// ExcelJS 를 사용하여 엑셀 버퍼 생성
		const buffer = await this.createExcelFile(result)
		return buffer
	} catch (error) {
		console.error('Error generating Excel:', error)
		throw error
	}
}

/**
 * 노드 상태 토글 (node_status true ↔ false)
 * @param {String} nodeId
 */
async function updateNodeStatusData(nodeId) {
	try {
		// MongoDB 4.2 부터 지원되는 파이프라인 업데이트 사용
		const updatingNode = await Node.findOneAndUpdate(
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
async function deleteNodeData(nodeId) {
	try {
		const deletingNode = await Node.findOneAndDelete({
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

/**
 * 단일 노드 위치 업데이트
 * @param {Number} doorNum 
 * @param {String} position 
 */
async function updateNodePositionData(doorNum, position) {
	try {
		const updatedNode = await Node.findOneAndUpdate(
			{ doorNum: doorNum },
			{ $set: { position: position } },
			{ new: true } // 업데이트된 결과 객체 반환
		)

		if (!updatedNode) {
			throw new Error('해당 번호의 노드를 찾을 수 없습니다.')
		}

		return updatedNode
	} catch (error) {
		throw error
	}
}


/**
 * Node.position 을 doorNum 기준으로 일괄 업데이트 + 빌딩에 엑셀 파일명 저장
 * @param {Array} nodesPosition - [{ nodeNum, position }, ...]
 * @param {String} buildingId
 * @param {Object} file - 업로드된 엑셀 파일 객체 (multer 등)
 * Flow:
 *  1. nodesPosition 을 순회하며 doorNum 기준 updateMany 로 position 업데이트
 *  2. 매칭된 Node 가 없는 doorNum 은 모아서 fail 메시지 리턴
 *  3. 파일을 /exels 폴더에 저장(fileService.save)
 *  4. 기존에 있던 nodes_position_file 이 있으면 삭제(fileService.delete)
 *  5. Building.nodes_position_file 에 새 파일명 저장
 */
async function setNodesPositionData(nodesPosition, buildingId, file) {
	try {
		// 각 노드에 대한 position 업데이트
		const updatePromises = nodesPosition.map(async item => {
			const result = await Node.updateMany(
				{ doorNum: item.nodeNum },
				{ $set: { position: item.position } }
			)
			return {
				doorNum: item.nodeNum,
				matchedCount: result.matchedCount,
				modifiedCount: result.modifiedCount,
			}
		})

		const results = await Promise.all(updatePromises)

		// 매칭된 Node 가 하나도 없는 doorNum 목록
		const noUpdates = results
			.filter(res => res.matchedCount === 0)
			.map(res => res.doorNum)

		if (noUpdates.length > 0) {
			return {
				state: 'fail',
				message: `${noUpdates} 번 노드가 발견되지 않았습니다. 파일을 확인하세요!`,
			}
		}

		// 파일 저장 (예: static/exels 폴더 등)
		const fileName = fileService.save(file, 'exels')

		// 빌딩 정보 조회 후 기존 파일 삭제 + 새 파일명 저장
		const building = await BuildingSchema.findById(buildingId)
		if (building) {
			const oldFilename = building.nodes_position_file

			if (oldFilename && oldFilename.trim() !== '') {
				fileService.delete(oldFilename)
			}

			await this.buildingSchema.findByIdAndUpdate(
				buildingId,
				{ nodes_position_file: fileName },
				{ new: true }
			)
		}

		return {
			message: `${nodesPosition.length}개 노드가 성공적으로 배치되었습니다.`,
		}
	} catch (error) {
		console.error('Error on node positioning:', error)
		throw new Error('Error on node positioning.')
	}
}

module.exports = {
	createNodesData,
	getNodesData,
	getAllTypeActiveNodesData,
	downloadNodeHistoryData,
	updateNodeStatusData,
	deleteNodeData,
	setNodesPositionData,
	handleNodeMqttMessage,
	updateNodePositionData,
}
