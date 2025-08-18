const fs = require('fs')
const path = require('path')
const multer = require('multer')

// Saqlash joyi: /static/excels
const uploadDir = path.join(process.cwd(), 'static/excels')
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true })
}

// Multer storage
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadDir),
	filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})

// Faqat Excel/CSV qabul qilamiz
const allowedTypes = [
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
	'application/vnd.ms-excel', // .xls (ba’zan .csv ham shuni beradi)
	'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
	'text/csv', // .csv
	'application/csv', // .csv (ba’zi clientlar)
]

const fileFilter = (req, file, cb) => {
	if (allowedTypes.includes(file.mimetype)) {
		return cb(null, true)
	}
	// Ba’zan mimetype noto‘g‘ri kelishi mumkin — kengaytma zaxira tekshiruv
	const ext = path.extname(file.originalname).toLowerCase()
	if (['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext)) {
		return cb(null, true)
	}
	return cb(new Error('Only .xlsx, .xls, .xlsm, .csv files are allowed'), false)
}

// Limitni biroz kattaroq qilamiz (masalan 20MB)
const uploadExcel = multer({
	storage,
	limits: { fileSize: 1024 * 1024 * 20 },
	fileFilter,
})

module.exports = uploadExcel
