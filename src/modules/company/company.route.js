const router = require('express').Router()
const company_router = router
const companyController = require('./company.controller')
const uploadImage = require('../../middlewares/uploadImage')

company_router.post('/create-client', companyController.createClient)

company_router.get('/clients', companyController.getComanies)
company_router.get('/clients/:id', companyController.getClient)

company_router.delete(
	'/delete/client/:clientId',
	companyController.deleteCompany
)

company_router.put(
	'/upload-company-plan',
	uploadImage.single('image'),
	companyController.uploadBuildingImage
)

module.exports = company_router
