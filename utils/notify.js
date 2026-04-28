/**
 * notify(io, userId, type, title, body, refId)
 *
 * Saves a Notification document AND emits it over Socket.io.
 * Import in any controller to push real-time + persistent notifications.
 *
 * Usage:
 *   const notify = require('../utils/notify')
 *   await notify(req.app.get('io'), patientId, 'request_accepted',
 *     'Blood bank accepted your request', 'Check Matches for details', matchId)
 */
const Notification = require("../model/Notification");

const notify = async (io, userId, type, title, body = "", refId = null) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      body,
      refId: refId ? String(refId) : null,
    });

    // Push to connected socket room (user joins their own userId room on connect)
    if (io) {
      io.to(userId.toString()).emit("notification", notification);
    }

    return notification;
  } catch (err) {
    // Non-fatal — log but never crash the calling controller
    console.error("notify error:", err.message);
  }
};

module.exports = notify;
