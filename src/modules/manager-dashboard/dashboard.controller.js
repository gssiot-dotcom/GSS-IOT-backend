const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logger, logError } = require('../../lib/logger')
const ManagerDashboardService = require('./dashboard.service')

const managerDashboardService = new ManagerDashboardService()

let managerDashboardController = module.exports

managerDashboardController.dashboard = async (req, res, next) => {
	try {
		logger('request: manager-dashboard')

		const result = await managerDashboardService.getManagerDashboard(
			req.user._id,
		)

		return sendSuccess(res, {
			message: 'Manager dashboard fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.ManagerDashboard: dashboard', error)
		return sendFail(res, error)
	}
}

managerDashboardController.buildings = async (req, res, next) => {
	try {
		logger('request: manager-buildings')

		const result = await managerDashboardService.getManagerBuildingsPage(
			req.user._id,
		)

		return sendSuccess(res, {
			message: 'Manager buildings fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.ManagerDashboard: buildings', error)
		return sendFail(res, error)
	}
}

managerDashboardController.buildingNodesByType = async (req, res, next) => {
	try {
		logger('request: manager-dashboard-buildingNodesByType')

		const result = await managerDashboardService.getBuildingNodesByType(
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
		logError('ERROR: contr.ManagerDashboard: buildingNodesByType', error)
		return sendFail(res, error)
	}
}
