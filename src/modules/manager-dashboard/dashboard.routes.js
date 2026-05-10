const router = require('express').Router()

const { isAuth } = require('../../middlewares/auth.middleware')
const controller = require('./dashboard.controller')

router.use(isAuth)

router.get('/dashboard', controller.dashboard)
router.get('/buildings', controller.buildings)

router.get(
	'/buildings/:buildingId/nodes/:nodeType',
	controller.buildingNodesByType,
)

module.exports = router
