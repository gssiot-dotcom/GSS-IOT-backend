const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logger, logError } = require('../../lib/logger')

const { getPaginationQuery } = require('../../utils/pagination')
const AdminDashboardService = require('./admin.service')

const adminDashboardService = new AdminDashboardService()

let adminDashboardController = module.exports

adminDashboardController.getAdminDashboard = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getAdminDashboard({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Admin resources fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch admin resources',
			error.status || 500,
		)
	}
}

adminDashboardController.getCompanyMembers = async (req, res) => {
	try {
		const { companyId } = req.params
		const { memberRole, search = '' } = req.query

		const data = await adminDashboardService.getCompanyMembers({
			companyId,
			memberRole,
			search,
		})

		return sendSuccess(res, {
			message: 'Company members fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch company members',
			error.status || 500,
		)
	}
}

adminDashboardController.createCompanyMemberUser = async (req, res) => {
	try {
		const { companyId } = req.params

		const data = await adminDashboardService.createCompanyMemberUser({
			companyId,
			payload: req.body,
		})

		return sendSuccess(res, {
			message: 'User created and assigned to company successfully',
			data,
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.updateCompanyMemberStatuses = async (req, res) => {
	try {
		const { companyId } = req.params
		const { activeMemberIds = [] } = req.body

		const data = await adminDashboardService.updateCompanyMemberStatuses({
			companyId,
			activeMemberIds,
		})

		return sendSuccess(res, {
			message: 'Company member statuses updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to update company member statuses',
			error.status || 500,
		)
	}
}

adminDashboardController.getCompanyBuildings = async (req, res) => {
	try {
		const { companyId } = req.params
		const { memberRole, search = '' } = req.query

		const data = await adminDashboardService.getCompanyBuildings({
			companyId,
			memberRole,
			search,
		})

		return sendSuccess(res, {
			message: 'Company buildings fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch company buildings',
			error.status || 500,
		)
	}
}

adminDashboardController.createCompanyBuilding = async (req, res) => {
	try {
		const { companyId } = req.params

		const data = await adminDashboardService.createCompanyBuilding({
			companyId,
			payload: req.body,
		})

		return sendSuccess(res, {
			message: 'Building created and assigned to company successfully',
			data,
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.updateCompanyBuildingStatuses = async (req, res) => {
	try {
		const { companyId } = req.params
		const { activeBuildingIds = [] } = req.body

		const data = await adminDashboardService.updateCompanyBuildingStatuses({
			companyId,
			activeBuildingIds,
		})

		return sendSuccess(res, {
			message: 'Company building statuses updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to update company building statuses',
			error.status || 500,
		)
	}
}

adminDashboardController.getAdminResources = async (req, res) => {
	try {
		const { page, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getAdminResources({
			page,
			limit: 20,
			skip,
		})

		return sendSuccess(res, {
			message: 'Admin resources fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch admin resources',
			error.status || 500,
		)
	}
}

adminDashboardController.getAssigningResources = async (req, res) => {
	try {
		const { page, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getAssigningResources({
			page,
			limit: 20,
			skip,
		})

		return sendSuccess(res, {
			message: 'Assigning resources fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch unassigned resources',
			error.status || 500,
		)
	}
}
