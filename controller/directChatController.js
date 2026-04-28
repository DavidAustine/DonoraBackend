const DirectConversation = require("../model/DirectConversation");
const ChatMessage = require("../model/ChatMessage");
const mongoose = require("mongoose");

/**
 * GET /chat/direct/thread/:otherId
 * ---------------------------------
 * Find or create a DirectConversation between the current user and otherId.
 * Returns the conversation object (with _id usable as matchId in the chat UI).
 */
const getOrCreateThread = async (req, res, next) => {
  try {
    const meId = req.user.id;
    const otherId = req.params.otherId;

    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // Look for existing conversation with both participants
    let convo = await DirectConversation.findOne({
      participants: { $all: [meId, otherId], $size: 2 },
    }).populate("participants", "firstname surname role");

    if (!convo) {
      convo = await DirectConversation.create({
        participants: [meId, otherId],
      });
      convo = await DirectConversation.findById(convo._id).populate(
        "participants",
        "firstname surname role"
      );
    }

    res.json(convo);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /chat/direct/:threadId/messages
 * -------------------------------------
 * Get all messages for a DirectConversation thread.
 * Reuses ChatMessage — messages whose `match` field equals the threadId.
 */
const getThreadMessages = async (req, res, next) => {
  try {
    const { threadId } = req.params;

    const convo = await DirectConversation.findById(threadId);
    if (!convo) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isParticipant = convo.participants.some(
      (p) => p.toString() === req.user.id
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const messages = await ChatMessage.find({ match: threadId })
      .populate("sender", "firstname surname")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /chat/direct/my-threads
 * ----------------------------
 * List all DirectConversation threads for the current user,
 * with the last message populated.
 */
const getMyThreads = async (req, res, next) => {
  try {
    const BloodBank = require("../model/BloodBank");

    const threads = await DirectConversation.find({
      participants: req.user.id,
    })
      .populate("participants", "firstname surname role")
      .sort({ updatedAt: -1 });

    // Enrich blood-bank participants with their bank name
    const enriched = await Promise.all(
      threads.map(async (t) => {
        const obj = t.toObject();
        obj.participants = await Promise.all(
          obj.participants.map(async (p) => {
            if (p.role === "bloodbank") {
              const bb = await BloodBank.findOne({ user: p._id }).select("name");
              if (bb) p.name = bb.name;
            }
            return p;
          })
        );
        // Attach last message
        const last = await ChatMessage.findOne({ match: t._id }).sort({
          createdAt: -1,
        });
        if (last) obj.lastMessage = last;
        return obj;
      })
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

module.exports = { getOrCreateThread, getThreadMessages, getMyThreads };
