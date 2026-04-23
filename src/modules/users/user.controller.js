const UserService = require('./user.service')
const userService = new UserService()

let userController = module.exports

userController.getUsers = async (req, res) => {
	try {
		const data = await userService.getUsers(req.query)

		return res.status(200).json({
			state: 'success',
			message: 'Users fetched successfully',
			data,
		})
	} catch (error) {
		return res.status(400).json({
			state: 'error',
			message: error.message || 'Failed to fetch users',
			data: null,
		})
	}
}

userController.getUserById = async (req, res) => {
	try {
		const data = await userService.getUserById(req.params.id)

		return res.status(200).json({
			state: 'success',
			message: 'User fetched successfully',
			data,
		})
	} catch (error) {
		return res.status(400).json({
			state: 'error',
			message: error.message || 'Failed to fetch user',
			data: null,
		})
	}
}

userController.createUser = async (req, res) => {
	try {
		const data = await userService.createUser(req.body)

		return res.status(201).json({
			state: 'success',
			message: 'User created successfully',
			data,
		})
	} catch (error) {
		return res.status(400).json({
			state: 'error',
			message: error.message || 'Failed to create user',
			data: null,
		})
	}
}

userController.updateUser = async (req, res) => {
	try {
		const data = await userService.updateUser(req.params.id, req.body)

		return res.status(200).json({
			state: 'success',
			message: 'User updated successfully',
			data,
		})
	} catch (error) {
		return res.status(400).json({
			state: 'error',
			message: error.message || 'Failed to update user',
			data: null,
		})
	}
}

userController.deleteUser = async (req, res) => {
	try {
		const data = await userService.deleteUser(req.params.id)

		return res.status(200).json({
			state: 'success',
			message: 'User deleted successfully',
			data,
		})
	} catch (error) {
		return res.status(400).json({
			state: 'error',
			message: error.message || 'Failed to delete user',
			data: null,
		})
	}
}

userController.changeUserStatus = async (req, res) => {
	try {
		const data = await userService.changeUserStatus(
			req.params.id,
			req.body.status,
		)

		return res.status(200).json({
			state: 'success',
			message: 'User status updated successfully',
			data,
		})
	} catch (error) {
		return res.status(400).json({
			state: 'error',
			message: error.message || 'Failed to update user status',
			data: null,
		})
	}
}
