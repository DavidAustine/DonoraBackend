const express = require("express");
const router = express.Router();
const verifyJWT = require("../middleware/authMiddleware");
const directChatController = require("../controller/directChatController");

// List all direct-chat threads for the current user
router.get("/my-threads", verifyJWT, directChatController.getMyThreads);

// Find or create a thread with a specific user
router.get("/thread/:otherId", verifyJWT, directChatController.getOrCreateThread);

// Get messages for a specific thread
router.get("/:threadId/messages", verifyJWT, directChatController.getThreadMessages);

module.exports = router;
