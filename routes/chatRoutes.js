const express = require("express")
const router = express.Router()
const verifyJWT = require("../middleware/authMiddleware")
const chatController = require("../controller/chatController")

router.post("/", verifyJWT, chatController.sendMessage)
router.get("/:matchId", verifyJWT, chatController.getChatMessages)

module.exports = router