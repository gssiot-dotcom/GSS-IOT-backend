const multer = require('multer')
const path = require('path')

//  Configure Strorage
const uploadDir = path.join(process.cwd(), 'static/images')
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir)
	},
	filename: (req, file, cb) => {
		cb(null, `${Date.now()}-${file.originalname}`)
	},
})

// File filter to allow only images
const fileFilter = (req, file, cb) => {
	const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']
	if (allowedTypes.includes(file.mimetype)) {
		return cb(null, true)
	} else {
		cb(new Error('Only .jpg, .jpeg, .png format images are allowed'), false)
	}
}

const uploadImage = multer({
	storage: storage,
	limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
	fileFilter: fileFilter,
})

module.exports = uploadImage
