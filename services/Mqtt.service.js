const mqtt = require('mqtt')
const NodeHistorySchema = require('../schema/History.model')
const NodeSchema = require('../schema/Node.model')
const EventEmitter = require('events')
// const { notifyUsersOfOpenDoor } = require('../services/Telegrambot.service')
const AngleNodeHistory = require('../schema/Angle.node.history.model')
const AngleNodeSchema = require('../schema/Angle.node.model')
const { logger, logError, logInfo } = require('../lib/logger')
const GatewaySchema = require('../schema/Gateway.model')
const AngleCalibration = require('../schema/Angle.Calibration.model') // ✅ 보정 테이블
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

      const payload = {
        doorNum: data.doorNum,
        gateway_number: gatewayNumber,
        angle_x: data.angle_x,
        angle_y: data.angle_y,
      }

      await handleIncomingAngleNodeData(payload)
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

async function handleIncomingAngleNodeData(payload) {
  const { gateway_number, doorNum, angle_x, angle_y } = payload
  const now = new Date()

  // Node 상태 업데이트 (lastSeen / alive)
  await AngleNodeSchema.updateOne(
    { doorNum },
    { $set: { lastSeen: now, node_alive: true } },
    { upsert: true }
  )

  // Gateway 상태 업데이트 (lastSeen / alive)
  await GatewaySchema.updateOne(
    { serial_number: gateway_number },
    {
      $set: { lastSeen: now, gateway_alive: true },
      $setOnInsert: {},
    },
    { upsert: true }
  )

  // ===== 보정값 조회/수집 처리 =====
  let calibDoc = await AngleCalibration.findOne({ doorNum }).lean()

  // 엔드포인트로 collecting=true가 된 상태라면 → 합/카운트 누적
  if (calibDoc?.collecting) {
    const newCount = (calibDoc.sampleCount ?? 0) + 1
    const newSumX = (calibDoc.sumX ?? 0) + Number(angle_x ?? 0)
    const newSumY = (calibDoc.sumY ?? 0) + Number(angle_y ?? 0)
    const target = calibDoc.sampleTarget ?? 5

    if (newCount >= target) {
      // ✅ 평균 계산 후 offset 확정
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

      // 메모리상의 최신 상태 반영(이 아래 계산에 사용)
      calibDoc = {
        ...calibDoc,
        applied: true,
        collecting: false,
        offsetX: avgX,
        offsetY: avgY,
        sampleCount: newCount,
        sumX: newSumX,
        sumY: newSumY,
      }

      logger(`Calibration 확정(door ${doorNum}) → offsetX=${avgX}, offsetY=${avgY}`)
    } else {
      // 아직 목표 미달 → 누적만 저장
      await AngleCalibration.updateOne(
        { doorNum },
        {
          $set: {
            sampleCount: newCount,
            sumX: newSumX,
            sumY: newSumY,
          },
        }
      )
      logger(`Calibration 수집 중 (door ${doorNum}) ${newCount}/${target}`)
    }
  }

  // 최종 offset (적용 가능 여부 포함)
  const offsetX = calibDoc?.applied ? (calibDoc.offsetX ?? 0) : 0
  const offsetY = calibDoc?.applied ? (calibDoc.offsetY ?? 0) : 0

  // ✅ 보정 적용 (calibrated = raw - offset)
  let calibratedX = angle_x - offsetX
  let calibratedY = angle_y - offsetY

  // 소수점 둘째 자리 반올림
  calibratedX = parseFloat(calibratedX.toFixed(2))
  calibratedY = parseFloat(calibratedY.toFixed(2))

  // ✅ Angle-Node: raw + 보정값 저장
  const updatedAngleNode = await AngleNodeSchema.findOneAndUpdate(
    { doorNum },
    {
      $set: {
        angle_x: angle_x,          // raw
        angle_y: angle_y,          // raw
        calibrated_x: calibratedX, // 보정값
        calibrated_y: calibratedY, // 보정값
        lastSeen: now,
        node_alive: true,
      },
    },
    { new: true, upsert: true }
  )

  // AngleNodeHistory: 보정값만 저장
  await new AngleNodeHistory({
    gw_number: gateway_number,
    doorNum,
    angle_x: calibratedX, // 보정 적용된 값
    angle_y: calibratedY, // 보정 적용된 값
  }).save()

  // ✅ 빌딩 연결된 게이트웨이일 때만, 보정값 기준으로 알림 로그 적재(yellow/red만)
const { checkAndLogAngle } = require('../services/Alert.service')
 await checkAndLogAngle({
   gateway_serial: String(gateway_number),
   doorNum,
   metric: 'angle_x',
   value: Number(calibratedX),
   raw: { angle_x, angle_y, calibratedX, calibratedY }
 })
 await checkAndLogAngle({
   gateway_serial: String(gateway_number),
   doorNum,
  metric: 'angle_y',
   value: Number(calibratedY),
   raw: { angle_x, angle_y, calibratedX, calibratedY }
 })

  // 이벤트 전달
  mqttEmitter.emit('mqttAngleMessage', updatedAngleNode)
}

module.exports = { mqttEmitter, mqttClient }
