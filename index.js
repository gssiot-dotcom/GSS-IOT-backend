require('dotenv').config()
const express = require('express')
const http = require('http')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const { Server } = require('socket.io')
const path = require('path')

const cron = require('node-cron')


// ===== 라우트 =====
const user_router = require('./routes/User.route')
const product_router = require('./routes/Product.route')
const company_router = require('./routes/compnay.route') // 기존 철자 유지
const angleCalibRoutes = require('./routes/angleCalibration.routes')
const alertLogRouter = require('./routes/alertLog.routes')
const weatherRoutes = require('./routes/weather.routes')
const angleHistoryRoutes = require('./routes/angleHistory.routes');
const angleNodeRoutes = require('./routes/angleNode.routes')
const reportNodesCsvRouter = require('./routes/report.nodes.csv.routes');
// ===== 서비스 =====
const { setupSocket } = require('./services/Socket.service')
const { startHeartbeatJob } = require('./services/heartBeat.service')
const { ingestAllBuildingsWeather } = require('./services/weatherIngest.service')
const reportDailyRoutes = require('./routes/report.daily.routes'); // 보고서
const app = express()
const server = http.createServer(app)



// 매 10분 실행(예시). 운영은 API 요금/쿼터 고려해서 조정.
cron.schedule('*/10 * * * *', async () => {
  try {
    const { ok, fail } = await ingestAllBuildingsWeather()
    console.log(`[weather cron] saved: ${ok}, failed: ${fail}`)
  } catch (e) {
    console.error('[weather cron] error:', e.message)
  }
})

// ===== Allowed Origins =====
const allowedOrigins = [
  'https://infogssiot.com',
  'http://13.125.157.133:3001',
  'http://13.125.157.133',
  'http://localhost:5173',
  'http://192.168.1.102:3005', // 필요 시 유지
]

// ===== Socket.IO (CORS는 별개로 설정) =====
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// ===== 미들웨어 (CORS/바디파서 먼저!) =====
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
app.use('/static', express.static(path.join(__dirname, 'static')))



app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('CORS policy violation: ' + origin))
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)
// 프리플라이트 빠른 처리
app.options(
  '*',
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('CORS policy violation: ' + origin))
    },
    credentials: true,
  })
)



// ===== 기본 & 헬스체크 =====
app.get('/', (req, res) => {
  res.send('Welcome to GSSIOT projects new Server! :)')
})
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }))

// ===== 라우트 마운트 =====
app.use('/auth', user_router)
app.use('/product', product_router)
app.use('/company', company_router)

// 캘리브레이션 라우터 (CORS 이후, 한 번만)
app.use('/api', angleCalibRoutes)
//알람 라우터
app.use('/api/alert-logs', alertLogRouter) 
//날씨/기준치 API
app.use('/api/weather', weatherRoutes)
//보고서
app.use('/api/reports', require('./routes/reportTable1.routes'));
app.use('/api/reports', reportDailyRoutes); 
app.use(reportDailyRoutes);
//최신값 반환
app.use('/api', angleHistoryRoutes);
//alive 반환
app.use('/api/angle-nodes', angleNodeRoutes)
app.use('/api/reports', reportNodesCsvRouter);
// ===== 404 핸들러 =====
app.use((req, res, next) => {
  if (res.headersSent) return next()
  res.status(404).json({ message: 'Not Found' })
})

// ===== 공통 에러 핸들러 =====
app.use((err, req, res, next) => {
  console.error('[ERROR]', err)
  const status =
    err.status || (err.name === 'ValidationError' ? 400 : 500)
  res.status(status).json({
    message: err.message || '서버 오류',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
})

// ===== 소켓 설정 =====
setupSocket(io)

// ===== 서버 시작 =====
const PORT = process.env.PORT || 3000 // 프론트와 맞추세요
let heartbeat // 종료 시 정리용

const startServer = async () => {
  try {
    // Mongo 연결 (Atlas 기본 / 커스텀 URI 우선)
    const mongoUri =
      process.env.MONGO_URI ||
      `mongodb+srv://Muhammad_Yusuf:${process.env.DB_PASSWORD}@papay.qzqt3.mongodb.net/GSS-FIGMA-DB?retryWrites=true&w=majority`

    await mongoose.connect(mongoUri)
    console.log('MongoDB connected successfully')

    // Heartbeat Job 시작
    heartbeat = startHeartbeatJob({
      intervalMs: 5 * 60 * 1000, // 5분
      windowMs: 60 * 60 * 1000,  // 1시간 윈도우
    })

    server.listen(PORT, () => {
      console.log(`Server is running successfully on: http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Server start error:', error)
    process.exit(1)
  }
}

startServer()

// ===== 안전 종료 처리 =====
const graceful = (signal) => {
  console.log(`[${signal}] shutting down...`)
  try {
    if (heartbeat?.stop) heartbeat.stop()
  } catch {}
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('[MongoDB] connection closed')
      process.exit(0)
    })
  })
}
process.on('SIGINT', () => graceful('SIGINT'))
process.on('SIGTERM', () => graceful('SIGTERM'))
