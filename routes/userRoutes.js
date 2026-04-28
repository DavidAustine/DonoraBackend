const express = require('express')
const router = express.Router()
const verifyJWT = require('../middleware/authMiddleware')
const userController = require('../controller/userController')

router.get('/me', verifyJWT, userController.getMyProfile)
router.patch('/me', verifyJWT, userController.updateMyProfile)
router.patch('/location', verifyJWT, userController.updateLocation)
router.get('/:id', verifyJWT, userController.getUserProfile)

module.exports = router
