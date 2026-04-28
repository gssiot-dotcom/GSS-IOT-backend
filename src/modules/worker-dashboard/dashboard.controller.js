const WorkerDashboardService = require('./dashboard.service')
const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logError, logger } = require('../../lib/logger')

const workerDashboardService = new WorkerDashboardService()

let workerDashboardController = module.exports

workerDashboardController.assignedBuildings = async (req, res, next) => {
	try {
		logger('request: worker-dashboard-assignedBuildings')

		const result = await workerDashboardService.getAssignedBuildings(
			req.user._id,
		)

		return sendSuccess(res, {
			message: 'Assigned buildings fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.WorkerDashboard: assignedBuildings', error)
		return sendFail(res, error)
	}
}

workerDashboardController.buildingNodesByType = async (req, res, next) => {
	try {
		logger('request: worker-dashboard-buildingNodesByType')

		const result = await workerDashboardService.getBuildingNodesByType(
			req.user._id,
			req.params.buildingId,
			req.params.nodeType,
		)

		return sendSuccess(res, {
			message: 'Building nodes fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.WorkerDashboard: buildingNodesByType', error)
		return sendFail(res, error)
	}
}
