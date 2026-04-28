/**
 * Notification routes — lightweight in-app notification log.
 *
 * Notifications are generated from server-side events (match accepted,
 * request fulfilled, SOS match, donation confirmed) and stored in MongoDB.
 * Socket.io events are the real-time delivery channel; this REST endpoint
 * lets the app load history on mount.
 */
const express = require("express");
const router = express.Router();
const verifyJWT = require("../middleware/authMiddleware");
const Notification = require("../model/Notification");

// GET  /notifications       — list my notifications (newest first)
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

// PATCH /notifications/read-all — mark all as read
router.patch("/read-all", verifyJWT, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
