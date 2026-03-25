// // src/app.js
// const express = require('express')
// const cookieParser = require('cookie-parser')
// const cors = require('cors')
// const path = require('path')

// // ===== Routes =====
// const user_router = require('./routes/User.route')
// const product_router = require('./routes/Product.route')
// const company_router = require('./routes/compnay.route') // 기존 철자 유지

// const angleCalibRoutes = require('./routes/angleCalibration.routes')
// const alertLogRouter = require('./routes/alertLog.routes')
// const weatherRoutes = require('./routes/weather.routes')
// const angleHistoryRoutes = require('./routes/angleHistory.routes')
// const angleNodeRoutes = require('./routes/angleNode.routes')
// const reportNodesCsvRouter = require('./routes/report.nodes.csv.routes')
// const angleNodeSaveStatusRoutes = require('./routes/angleNode.saveStatus.routes')
// const gatewayPositionRoutes = require('./routes/gateway.position.routes')
// const verticalNodeRoutes = require('./routes/verticalNode.routes')

// const reportDailyRoutes = require('./routes/report.daily.routes')
// const reportTable1Routes = require('./routes/reportTable1.routes') // ✅ ../ emas, ./ bo‘lishi kerak (src ichida turgani uchun)

// const app = express()

// // ===== Allowed Origins =====
// const allowedOrigins = [
// 	'https://infogssiot.com',
// 	'http://13.125.157.133:3001',
// 	'http://13.125.157.133',
// 	'http://localhost:5173',
// 	'http://192.168.1.102:3005',
// ]

// // ===== CORS options =====
// const corsOptions = {
// 	origin(origin, callback) {
// 		if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
// 		return callback(new Error('CORS policy violation: ' + origin))
// 	},
// 	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
// 	allowedHeaders: ['Content-Type', 'Authorization'],
// 	credentials: true,
// }

// // ===== Middlewares =====
// app.use(express.json({ limit: '2mb' }))
// app.use(cookieParser())
// app.use(express.urlencoded({ extended: true }))
// app.use('/static', express.static(path.join(__dirname, 'static')))

// app.use(cors(corsOptions))

// // preflight
// app.options('*', cors(corsOptions))

// // ===== Basic routes =====
// app.get('/', (req, res) => {
// 	res.send('Welcome to GSSIOT projects new Server! :)')
// })
// app.get('/health', (req, res) => res.status(200).json({ ok: true }))

// // ===== Mount routes =====
// app.use('/auth', user_router)
// app.use('/product', product_router)
// app.use('/company', company_router)

// // calibration
// app.use('/api', angleCalibRoutes)

// // alert logs
// app.use('/alert-logs', alertLogRouter)

// // weather
// app.use('/weather', weatherRoutes)

// // reports
// app.use('/reports', reportTable1Routes)
// app.use('/reports', reportDailyRoutes)
// app.use('/reports', reportNodesCsvRouter)

// // latest values / history
// app.use('', angleHistoryRoutes)

// // angle nodes alive/latest
// app.use('/angle-nodes', angleNodeRoutes)

// // gateway position
// app.use('/gateways', gatewayPositionRoutes)

// // save_status
// app.use('/nodes', angleNodeSaveStatusRoutes)

// // vertical nodes
// app.use('/vertical-nodes', verticalNodeRoutes)

// // ===== 404 =====
// app.use((req, res, next) => {
// 	if (res.headersSent) return next()
// 	res.status(404).json({ message: 'Not Found' })
// })

// // ===== Error handler =====
// app.use((err, req, res, next) => {
// 	console.error('[ERROR]', err)
// 	const status = err.status || (err.name === 'ValidationError' ? 400 : 500)
// 	res.status(status).json({
// 		message: err.message || '서버 오류',
// 		...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
// 	})
// })

// module.exports = { app, allowedOrigins }
