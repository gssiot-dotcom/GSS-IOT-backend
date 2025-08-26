const multerImageUpload = require('../middlewares/uploadImage')

const ImageUploader = async  (req, res) => {
	try {

		uploadImage.single('image')(req, res, err => {
		if (err instanceof multer.MulterError) {
			return res.status(400).json({ message: err.message, code: err.code })
		} else if (err) {
			return res.status(400).json({ message: err.message })
		}

		if (!req.file) {
			return res.status(400).json({ message: 'No file uploaded' })
		}

		// URL qaytarishda static/images ga yo‘naltirasiz
		const imageUrl = req.file.filename


		return imageUrl
	} catch (error) {
		throw new
	}
}