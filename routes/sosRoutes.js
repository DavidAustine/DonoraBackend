const express = require("express")
const router = express.Router()
const verifyJWT = require("../middleware/authMiddleware")
const sosController = require("../controller/sosController")

router.post("/", verifyJWT, sosController.createSOS)
router.post("/accept", verifyJWT, sosController.acceptSOS)
router.get("/mine", verifyJWT, sosController.getMySOS)
router.get("/match/:matchId", verifyJWT, sosController.getSOSMatch)
router.patch("/:id/resolve", verifyJWT, sosController.resolveSOS)

module.exports = router
