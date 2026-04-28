const express = require('express')
const router = express.Router()
const matchController = require('../controller/matchController')
const verifyJWT = require('../middleware/authMiddleware')

router.get("/my", verifyJWT, matchController.getMyMatches)
router.get("/find-with/:userId", verifyJWT, matchController.findMatchWithUser)
router.patch("/cancel/:id", verifyJWT, matchController.cancelMatch)

module.exports = router
