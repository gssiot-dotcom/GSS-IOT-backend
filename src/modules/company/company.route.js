const router = require('express').Router()
const company_router = router
const companyController = require('./company.controller')
const uploadImage = require('../../middlewares/uploadImage')

company_router.post('/create', companyController.createClient)

company_router.get('/', companyController.getComanies)
company_router.get('/:id', companyController.getClient)

company_router.delete('/delete/:clientId', companyController.deleteCompany)

// company_router.put(
// 	'/upload-company-plan',
// 	uploadImage.single('image'),
// 	companyController.uploadBuildingImage,
// )

module.exports = company_router
