const CompanyService = require('./company.service')
const { logger, logError } = require('../../lib/logger')

let companyController = module.exports

companyController.createClient = async (req, res) => {
	try {
		logger('request: createClient')
		const data = req.body
		const companyService = new CompanyService()
		const client = await companyService.createClientData(data)
		res.json({
			state: 'succcess',
			client: client,
			message: '클라이언트가 생성돼었읍니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

companyController.getComanies = async (req, res) => {
	try {
		logger('request: getCompanies')
		const comapnyService = new CompanyService()
		const clients = await comapnyService.getCompanies()
		res.json({
			state: 'succcess',
			clients: clients,
		})
	} catch (error) {
		logger('Error', error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

companyController.getClient = async (req, res) => {
	try {
		logger('request: getCompany-buildings')
		const { id } = req.params,
			comapnyService = new CompanyService(),
			result = await comapnyService.getCompanyData(id)
		res.json({
			state: 'success',
			client: result.client,
			client_buildings: result.buildings,
		})
	} catch (error) {
		logger('Error', error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

companyController.deleteCompany = async (req, res) => {
	try {
		logger('request: deleteCompany')
		const { clientId } = req.params
		const companyService = new CompanyService(),
			result = await companyService.deleteCompanyData(clientId)

		res.json({
			state: 'success',
			client: clientId,
			message: result.message,
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

companyController.uploadBuildingImage = async (req, res) => {
	try {
		// Endi bu yerda req.body va req.file bor
		const { building_id } = req.body

		logger(req.body)
		if (!req.file) {
			return res.status(400).json({ message: 'No file uploaded' })
		}
		if (!building_id) {
			return res.status(400).json({ message: 'building_id is needed' })
		}

		const imageUrl = req.file.filename // yoki req.file.path
		const companyService = new CompanyService()
		const result = await companyService.uploadBuildingImageData(
			building_id,
			imageUrl
		)

		return res.status(200).json({
			state: 'success',
			message: 'Building image uploaded successfully!',
			building: result,
		})
	} catch (error) {
		logError(error)
		return res.status(500).json({ state: 'fail', message: error.message })
	}
}

// ------------------------------------------------------------------- //

companyController.getBossClients = async (req, res) => {
	try {
		logger('request: getClientBoss')
		const { userId } = req.body
		const comapnyService = new CompanyService()
		const clients = await comapnyService.getBossClientsData(userId)
		res.json({
			state: 'success',
			clients: clients,
		})
	} catch (error) {
		logger('Error', error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

companyController.getBossBuildings = async (req, res) => {
	try {
		logger('request: getBossBuildings')
		const { clientId } = req.body,
			comapnyService = new CompanyService(),
			result = await comapnyService.getBossBuildingsData(clientId)
		res.json({
			state: 'success',
			clients: result.client,
			client_buildings: result.buildings,
		})
	} catch (error) {
		logger('Error', error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}
