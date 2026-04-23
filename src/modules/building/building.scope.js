const {
	BuildingSchema,
	BuildingWorkerSchema,
} = require('../building/building.model')
const BuildingWorker = require('./building-worker.model')
const CompanyMember = require('../companies/company-member.model')
const { CompanyMemberSchema } = require('../company/company.model')

exports.canAccessBuilding = async (req, res, next) => {
	try {
		const user = req.user
		const buildingId = req.params.id

		if (user.user_type === 'ADMIN') return next()

		const building = await BuildingSchema.findById(buildingId).lean()
		if (!building) {
			return res.status(404).json({ message: 'Building not found' })
		}

		if (user.user_type === 'MANAGER') {
			const membership = await CompanyMemberSchema.findOne({
				user_id: user._id,
				company_id: building.company_id,
				status: true,
			}).lean()

			if (!membership) {
				return res.status(403).json({ message: 'Forbidden' })
			}

			return next()
		}

		if (user.user_type === 'WORKER') {
			const assignment = await BuildingWorkerSchema.findOne({
				user_id: user._id,
				building_id: building._id,
				status: true,
			}).lean()

			if (!assignment) {
				return res.status(403).json({ message: 'Forbidden' })
			}

			return next()
		}

		return res.status(403).json({ message: 'Forbidden' })
	} catch (err) {
		next(err)
	}
}
