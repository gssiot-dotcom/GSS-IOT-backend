const express = require('express')
const company_router = express.Router()
const companyController = require('../controllers/company-controller')
const multer = require('multer')
const uploadImage = require('../middlewares/uploadImage')

// ========== Building related endpoints ======= //
company_router.post('/create-building', companyController.createBuilding)
company_router.get(
	'/get-active-buildings',
	companyController.getActiveBuildings
)
company_router.get('/get-buildings', companyController.getBuildings)
company_router.get('/buildings/:id', companyController.getBuildingNodes)
company_router.get(
	'/buildings/:id/angle-nodes',
	companyController.getBuildingAngleNodes
)
company_router.get(
	'/buildings/:id/angle-nodes/summary',
	companyController.getAngleNodeSummary
)
company_router.delete(
	'/delete/building/:buildingId',
	companyController.deleteBuilding
)

// ========== Client related endpoints ======= //
company_router.post('/create-client', companyController.createClient)
company_router.get('/clients', companyController.getComanies)
company_router.get('/clients/:id', companyController.getClient)
company_router.delete(
	'/delete/client/:clientId',
	companyController.deleteCompany
)

//  =========================  Boss Client user related endpoints ================ //
company_router.post('/boss-clients', companyController.getBossClients)
company_router.post('/gateway/wake_up', companyController.wakeUpOfficeGateway)

// ======================================================= //
company_router.post('/upload-company-plan', (req, res) => {
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
		const imageUrl = `${req.protocol}://${req.get('host')}/static/images/${
			req.file.filename
		}`

		res.status(200).json({
			message: 'Company plan image uploaded successfully.',
			imageUrl,
		})
	})
})

module.exports = company_router
