const mqtt = require('mqtt')
const NodeHistorySchema = require('../schema/History.model')
const NodeSchema = require('../schema/Node.model')
const EventEmitter = require('events')
const { notifyUsersOfOpenDoor } = require('../services/Telegrambot.service')
const AngleNodeHistory = require('../schema/Angle.node.history.model')
const AngleNodeSchema = require('../schema/Angle.node.model')
const { logger, logError, logInfo } = require('../lib/logger')

// Xabarlarni tarqatish uchun EventEmitter
// 메시지를 다른 곳에 전달하기 위해 EventEmitter 사용
const mqttEmitter = new EventEmitter()

// MQTT 토픽 설정
const allTopics = [
	'GSSIOT/01030369081/GATE_PUB/+', // 노드 데이터
	'GSSIOT/01030369081/GATE_RES/+', // 게이트웨이 응답
	'GSSIOT/01030369081/GATE_ANG/+', // 각도 센서 데이터
]
const nodeTopic = 'GSSIOT/01030369081/GATE_PUB/'
const angleTopic = 'GSSIOT/01030369081/GATE_ANG/'
const gwResTopic = 'GSSIOT/01030369081/GATE_RES/'

// ================= MQTT LOGICS =============== //

// MQTT 서버 연결
const mqttClient = mqtt.connect('mqtt://gssiot.iptime.org:10200', {
	username: '01030369081',
	password: 'qwer1234',
	// connectTimeout: 30 * 1000,
})

// 연결 성공 시 구독 처리
mqttClient.on('connect', () => {
	logger('Connected to GSSIOT MQTT server')
	allTopics.forEach(topic => {
		mqttClient.subscribe(topic, function (err) {
			if (!err) {
				logger('Subscribed to:', topic)
			} else {
				logError('Error subscribing:', err)
			}
		})
	})
})

// ===== 도어별(angle_x, angle_y) 켈리브레이션 상태 저장용 메모리 =====
// 구조: calibrationByDoor[doorNum] = { x:[], y:[], applied:boolean, offsetX:number, offsetY:number }
const calibrationByDoor = Object.create(null)

// 이전 message 리스너 제거 후 새로 등록
mqttClient.removeAllListeners('message')
mqttClient.on('message', async (topic, message) => {
	try {
		// MQTT 메시지 파싱
		const data = JSON.parse(message.toString())

		// 게이트웨이 번호 추출 (토픽의 마지막 조각 기준)
		const gatewayNumber = topic.split('/').pop().slice(-4)

		// 현재 시간 (서울 기준, 24시간제)
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

		// ================== Node 데이터 처리 ==================
		if (topic.startsWith(nodeTopic)) {
			logger('Door-Node mqtt message:', data, '|', timeString)

			// === [추가: start 트리거에 의한 캘리브레이션 리셋 - 현재 미사용으로 주석처리] ===
			/*
      if (data.start === true && data.doorNum !== undefined) {
        const doorNum = data.doorNum
        calibrationByDoor[doorNum] = {
          x: [],
          y: [],
          applied: false,
          offsetX: 0,
          offsetY: 0,
        }
        logger(`Calibration 리셋됨 (door ${doorNum}) → 새로 5개 샘플 수집 시작`)
      }
      */
			// === [추가 끝] ===

			// 이벤트 데이터 생성
			const eventData = {
				gw_number: gatewayNumber,
				doorNum: data.doorNum,
				doorChk: data.doorChk,
				betChk: data.betChk_3,
			}

			// DB 업데이트용 데이터
			const updateData = {
				doorChk: data.doorChk,
				betChk: data.betChk_3,
				...(data.betChk_2 !== undefined && { betChk_2: data.betChk_2 }),
			}

			// Node DB 업데이트
			const updatedNode = await NodeSchema.findOneAndUpdate(
				{ doorNum: data.doorNum },
				{ $set: updateData },
				{ new: true }
			)

			if (!updatedNode) {
				logInfo('Node를 찾을 수 없음:', data.doorNum)
				return
			}

			// History 저장
			const mqttEventSchema = new NodeHistorySchema(eventData)
			try {
				await mqttEventSchema.save()
			} catch (err) {
				logError('NodeHistorySchema 저장 오류:', err.message)
				return
			}

			// 이벤트 전달
			mqttEmitter.emit('mqttMessage', updatedNode)

			// 문이 열릴 때 텔레그램 알림 전송 (현재 비활성화)
			// if (data.doorChk === 1) {
			//   await notifyUsersOfOpenDoor(data.doorNum)
			// }
		}

		// ================== Gateway 응답 처리 ==================
		else if (topic.startsWith(gwResTopic)) {
			logger(
				`Gateway-creation event gateway-${gatewayNumber}:`,
				data,
				'|',
				timeString
			)
			emitGwRes(data)
		}

		// ================== 각도 센서 데이터 처리 ==================
		else if (topic.startsWith(angleTopic)) {
			logger(
				`MPU-6500 sensor data from gateway-${gatewayNumber}:`,
				data,
				'|',
				timeString
			)

			const doorNum = data.doorNum

			// 도어별 켈리브레이션 상태 초기화
			if (!calibrationByDoor[doorNum]) {
				calibrationByDoor[doorNum] = {
					x: [],
					y: [],
					applied: false,
					offsetX: 0,
					offsetY: 0,
				}
			}

			const calib = calibrationByDoor[doorNum]

			// 1) 아직 켈리브레이션 미적용이면 초기 5개 수집 후 평균 -> 부호 반전하여 offset 확정
			if (!calib.applied) {
				calib.x.push(data.angle_x)
				calib.y.push(data.angle_y)

				if (calib.x.length >= 5) {
					// 평균값 계산
					const sumX = calib.x.reduce((a, b) => a + b, 0)
					const sumY = calib.y.reduce((a, b) => a + b, 0)
					const avgX = sumX / calib.x.length
					const avgY = sumY / calib.y.length

					// 부호 반대로 저장 (offset은 항상 avg의 반대 부호)
					calib.offsetX = -avgX
					calib.offsetY = -avgY
					calib.applied = true

					logger(
						`Calibration 완료(door ${doorNum}): offsetX=${calib.offsetX}, offsetY=${calib.offsetY}`
					)
					//  이 시점(5번째 측정)부터 보정값 적용하여 저장 시작
				} else {
					logger(`Calibration 수집 중 (door ${doorNum}) ${calib.x.length}/5...`)
					//  아직 보정값 확정 전이므로 angle DB/History 저장은 하지 않음
					return
				}
			}

			// 2) 보정값 적용: "무조건 더해서" 저장
			let calibratedX = data.angle_x + calib.offsetX
			let calibratedY = data.angle_y + calib.offsetY

			// ✅ 소수점 둘째 자리까지만 반올림 후 숫자로 변환
			calibratedX = parseFloat(calibratedX.toFixed(2))
			calibratedY = parseFloat(calibratedY.toFixed(2))

			// DB 업데이트용 데이터(보정값 저장)
			const updateData = {
				angle_x: calibratedX,
				angle_y: calibratedY,
			}

			// 히스토리 저장용 데이터(보정값 저장)
			const historyData = {
				gw_number: gatewayNumber,
				doorNum: doorNum,
				angle_x: calibratedX,
				angle_y: calibratedY,
			}

			// 기존 AngleNode 업데이트 (없으면 생성)
			const updatedAngleNode = await AngleNodeSchema.findOneAndUpdate(
				{ doorNum: doorNum },
				{ $set: updateData },
				{ new: true, upsert: true }
			)

			// History 저장
			const result = new AngleNodeHistory(historyData)
			await result.save()

			// 이벤트 전달
			mqttEmitter.emit('mqttAngleMessage', updatedAngleNode)

			// 👉 기존 값과 차이가 클 때만 저장하는 로직(EPSILON 비교)은 요구사항에 따라 사용하지 않음
		}
	} catch (err) {
		logError('MQTT 메시지 처리 오류:', err.message)
	}
})

// MQTT 연결 오류 처리
mqttClient.on('error', error => {
	logError('MQTT connection error:', error)
})

// 게이트웨이 응답 이벤트 전달 함수
const emitGwRes = data => {
	mqttEmitter.emit('gwPubRes', data)
}

module.exports = { mqttEmitter, mqttClient }
