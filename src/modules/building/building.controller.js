const { logger } = require('../../lib/logger')
const BuildingService = require('./building.service')

let buildingController = module.exports

buildingController.createBuilding = async (req, res) => {
	try {
		logger('request: createBuilding')
		const data = req.body
		const companyService = new BuildingService()
		const result = await companyService.createBuildingData(data)
		res.json({
			state: 'succcess',
			building: result,
			message: '빌딩이 생성돼었습니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

buildingController.getBuildings = async (req, res) => {
	try {
		logger('request: getBuildings')
		const companyService = new BuildingService()
		const buildings = await companyService.getBuildingsData()
		res.json({ state: 'succcess', buildings: buildings })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

buildingController.getActiveBuildings = async (req, res) => {
	try {
		logger('request: getActiveBuildings')
		const companyService = new BuildingService()
		const buildings = await companyService.getActiveBuildingsData()
		res.json({ state: 'succcess', buildings: buildings })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

buildingController.getBuildingNodes = async (req, res) => {
	try {
		logger('request: getBuildingNodes')

		const { id } = req.params
		const companyService = new BuildingService()

		const result = await companyService.getBuildingNodesData(id)

		if (!result || !result.building || !result.nodes) {
			throw new Error('No building or nodes found')
		}

		res.json({
			state: 'success',
			building: result.building,
			nodes: result.nodes,
		})
	} catch (error) {
		console.error('Error in getBuildingNodes:', error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

buildingController.getBuildingAngleNodes = async (req, res) => {
	try {
		logger('request: getBuildingAngleNodes')

		const { id } = req.params
		const companyService = new BuildingService()

		const result = await companyService.getBuildingAngleNodesData(id)

		if (!result || !result.building || !result.angleNodes) {
			throw new Error('No building or nodes found')
		}

		res.json({
			state: 'success',
			building: result.building,
			gateways: result.gateways,
			angle_nodes: result.angleNodes,
		})
	} catch (error) {
		console.error('Error on getBuildingAngleNodes:', error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

buildingController.deleteBuilding = async (req, res) => {
	try {
		logger('request: deleteBuilding')
		const { buildingId } = req.params
		const companyService = new BuildingService(),
			result = await companyService.deleteBuildingData(buildingId)

		res.json({
			state: 'success',
			building: buildingId,
			message: result.message,
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

buildingController.uploadBuildingImage = async (req, res) => {
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
		const companyService = new BuildingService()
		const result = await companyService.uploadBuildingImageData(
			building_id,
			imageUrl,
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

buildingController.setAlarmLevel = async (req, res) => {
	try {
		console.log('setAlarmLevel called')
		// Endi bu yerda req.body va req.file bor
		const { building_id, alarmLevel } = req.body

		if (!building_id) {
			return res.status(400).json({ message: 'building_id is needed' })
		}

		const companyService = new BuildingService()
		const result = await companyService.setAlarmLevel(building_id, alarmLevel)

		return res.status(200).json({
			state: 'success',
			message: 'Building alarm-level set successfully!',
			building: result,
		})
	} catch (error) {
		logError(error)
		return res.status(500).json({ state: 'fail', message: error.message })
	}
}

buildingController.changeGatewayBuilding = async (req, res) => {
	try {
		logger('request: changeGatewayBuilding')
		const { gateway_id, building_id } = req.body

		if (!gateway_id || !building_id) {
			return res.status(400).json({
				state: 'fail',
				message: 'gateway_id와 building_id가 필요합니다.',
			})
		}

		const companyService = new BuildingService()
		const result = await companyService.moveGatewayToBuildingData(
			gateway_id,
			building_id,
		)

		return res.json({
			state: 'success',
			message: '게이트웨이의 빌딩이 변경되었습니다.',
			data: result,
		})
	} catch (error) {
		logError(error.message)
		return res.status(500).json({ state: 'fail', message: error.message })
	}
}
