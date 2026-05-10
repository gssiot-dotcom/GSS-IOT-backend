const express = require('express')
const {
	getAdminResources,
	getAssigningResources,
	getAdminDashboard,
	getCompanyMembers,
	createCompanyMemberUser,
	updateCompanyMemberStatuses,
	getCompanyBuildings,
	updateCompanyBuildingStatuses,
} = require('./admin.controller')

const router = express.Router()

router.get('/dashboard', getAdminDashboard)
// ============ Company Members ==============
router.get('/companies/:companyId/members', getCompanyMembers)
router.post('/companies/:companyId/members', createCompanyMemberUser)
router.patch(
	'/companies/:companyId/members/status',
	updateCompanyMemberStatuses,
)

// ============= Company Buildings ==============
router.get('/companies/:companyId/buildings', getCompanyBuildings)

router.patch(
	'/companies/:companyId/buildings/statuses',
	updateCompanyBuildingStatuses,
)

router.get('/resources', getAdminResources)
router.get('/unassigned-resources', getAssigningResources)

module.exports = router
