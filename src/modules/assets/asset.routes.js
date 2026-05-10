const express = require('express')
const assetController = require('./asset.controller')

// const authMiddleware = require('../middlewares/auth.middleware')

const router = express.Router()

// router.use(authMiddleware)

router.post('/upload-url', assetController.createUploadUrl)
router.post('/save', assetController.saveAsset)
router.get('/view-url', assetController.getViewUrl)
router.post('/remove', assetController.removeAsset)

module.exports = router
