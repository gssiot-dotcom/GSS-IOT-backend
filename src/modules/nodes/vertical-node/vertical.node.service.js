const { VerticalNode, VerticalNodeHistory } = require('./Vertical.node.model')
const GatewaySchema = require('../../gateways/gateway.model')
const BuildingSchema = require('../../building/building.model')
const { eventBus } = require('../../../shared/eventBus')
const { logger } = require('../../../lib/logger')

const handleVerticalNodeMqttMessage = async ({ data, gatewayNumberLast4 }) => {
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

	logger('Vertical-Node mqtt message:', data, '|', timeString)

	const eventData = {
		gw_number: gatewayNumberLast4,
		node_number: data.doorNum,
		angle_x: data.angle_x,
		angle_y: data.angle_y,
	}

	const updateData = {
		angle_x: data.angle_x,
		angle_y: data.angle_y,
	}

	const buildingId = await GatewaySchema.findOne({
		serial_number: gatewayNumberLast4,
	}).then(gateway => gateway?.building_id)

	const realTimeData = {
		buildingId: buildingId?.toString(),
		gw_number: gatewayNumberLast4,
		node_number: data.doorNum,
		angle_x: data.angle_x,
		angle_y: data.angle_y,
	}

	// 🔥 endi mqttEmitter emas, eventBus:
	eventBus.emit('rt.vertical', realTimeData)

	const updatedNode = await VerticalNode.findOneAndUpdate(
		{ node_number: data.doorNum },
		{ $set: updateData },
		{ new: true },
	)

	if (!updatedNode) {
		logInfo('Node를 찾을 수 없음:', data.doorNum)
		return
	}

	try {
		await new VerticalNodeHistory(eventData).save()
	} catch (err) {
		logError('VerticalNodesHistory 저장 오류:', err.message)
		return
	}
}

class VerticalNodeService {
	constructor() {
		// 주입받지 않고 직접 스키마를 할당해서 사용
		this.verticalNodeSchema = VerticalNode
		this.gatewaySchema = GatewaySchema
		this.buildingSchema = BuildingSchema
		this.verticalNodeHistorySchema = VerticalNodeHistory
	}

	// ==================== Product creating & getting logics ===================== //

	/**
	 * 비계전도(VerticalNode) 여러 개를 생성하는 서비스
	 * @param {Array} arrayData - [{ doorNum }, ...]
	 * 1. doorNum 기준 중복 체크
	 * 2. 중복이 없으면 doorNum만 뽑아서 문서 생성(나머지 필드는 기본값)
	 */

	async handleVerticalNodeMqttMessage({ data, gatewayNumberLast4 }) {
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
			node_number: data.doorNum,
			angle_x: data.angle_x,
			angle_y: data.angle_y,
		}

		const updateData = {
			angle_x: data.angle_x,
			angle_y: data.angle_y,
		}

		const updatedNode = await this.verticalNodeHistorySchema.findOneAndUpdate(
			{ node_number: data.doorNum },
			{ $set: updateData },
			{ new: true },
		)

		if (!updatedNode) {
			logInfo('Node를 찾을 수 없음:', data.doorNum)
			return
		}
		// 🔥 endi mqttEmitter emas, eventBus:
		eventBus.emit('rt.vertical', updatedNode)

		try {
			await new this.verticalNodeHistorySchema(eventData).save()
		} catch (err) {
			logError('VerticalNodesHistory 저장 오류:', err.message)
			return
		}
	}

	async createVerticalNodesData(arrayData) {
		try {
			// 이미 존재하는 node_number 이 있는지 확인
			const existNodes = await this.verticalNodeSchema.find({
				node_number: { $in: arrayData.map(obj => obj.node_number) },
			})
			if (existNodes.length > 0) {
				const existNodeNums = existNodes.map(node => node.node_number)
				throw new Error(
					`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`,
				)
			}

			// VerticalNode 는 node_number 만 세팅하여 생성 (position 등은 추후 별도 API로 세팅)
			const arrayObject = arrayData.map(
				({ node_number, angle_x, angle_y, gateway_id }) => ({
					node_number,
					angle_x,
					angle_y,
					gateway_id,
				}),
			)

			const result = await this.verticalNodeSchema.insertMany(arrayObject)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async getVerticalNodesByGatewayId(gatewayId) {
		try {
			const verticalNodes = await this.verticalNodeSchema.find({
				gateway_id: gatewayId,
			})
			return verticalNodes
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async getVerticalNodes() {
		try {
			const verticalNodes = await this.verticalNodeSchema.find({})
			return verticalNodes
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async deleteVerticalNodeById(verticalNodeId) {
		try {
			const result =
				await this.verticalNodeSchema.findByIdAndDelete(verticalNodeId)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async updateVerticalNodeStatus(verticalNodeId) {
		try {
			const result = await this.verticalNodeSchema.findByIdAndUpdate(
				verticalNodeId,
				[{ $set: { node_status: { $not: '$node_status' } } }],
				{ new: true },
			)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}
}

module.exports = { VerticalNodeService, handleVerticalNodeMqttMessage }
