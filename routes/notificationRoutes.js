const express = require("express");
const router = express.Router();
const verifyJWT = require("../middleware/authMiddleware");
const Notification = require("../model/Notification");

router.get("/", verifyJWT, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

router.patch("/read-all", verifyJWT, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } },
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
