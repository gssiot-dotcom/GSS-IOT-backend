const ROLES = {
	ADMIN: 'ADMIN',
	MANAGER: 'MANAGER',
	WORKER: 'WORKER',
	USER: 'USER',
}

module.exports = {
	listBuildings: [ROLES.ADMIN, ROLES.MANAGER],
	getBuildingDetail: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WORKER],
	createBuilding: [ROLES.ADMIN, ROLES.MANAGER],
	updateBuilding: [ROLES.ADMIN, ROLES.MANAGER],
	deleteBuilding: [ROLES.ADMIN],
	getMyBuildings: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WORKER],
}
