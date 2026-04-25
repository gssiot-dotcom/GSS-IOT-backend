exports.USER_TYPES = ['ADMIN', 'MANAGER', 'WORKER', 'USER']
exports.SIGNUP_USER_TYPES = ['MANAGER', 'WORKER', 'USER']
exports.COMPANY_MEMBERSHIP_TYPES = ['MANAGER', 'ADMIN', 'VIEWER']

exports.GATEWAY_TYPES = ['GATEWAY', 'SECURITY_OFFICE']

exports.NODE_TYPE = {
	DOOR: 'door_node',
	ANGLE: 'angle_node',
	GANGFORM: 'gangform_node',
}

// It is for company users
exports.NODE_UPDATE_ALLOWED_FIELDS = [
	'position',
	'node_status',
	'save_status',
	'node_position_img',
]
