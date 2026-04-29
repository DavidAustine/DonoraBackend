const DirectConversation = require("../model/DirectConversation");
const ChatMessage = require("../model/ChatMessage");
const mongoose = require("mongoose");

const getOrCreateThread = async (req, res, next) => {
  try {
    const meId = req.user.id;
    const otherId = req.params.otherId;

    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // Build the same canonical key the model's pre-save hook would produce.
    // Using findOneAndUpdate with upsert makes this atomic — no race window
    // where two simultaneous requests can both pass the findOne check and
    // both call create(), producing duplicate threads.
    const participantKey = [meId, otherId].sort().join("|");

    let convo = await DirectConversation.findOneAndUpdate(
      { participantKey },
      {
        $setOnInsert: {
          participants: [meId, otherId],
          participantKey,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).populate("participants", "firstname surname role");

    res.json(convo);
  } catch (err) {
    // E11000 duplicate key — another request already created the thread
    // a millisecond ago. Just fetch and return it.
    if (err.code === 11000) {
      try {
        const participantKey = [req.user.id, req.params.otherId]
          .sort()
          .join("|");
        const convo = await DirectConversation.findOne({
          participantKey,
        }).populate("participants", "firstname surname role");
        if (convo) return res.json(convo);
      } catch (_) {}
    }
    next(err);
  }
};

const getThreadMessages = async (req, res, next) => {
  try {
    const { threadId } = req.params;

    const convo = await DirectConversation.findById(threadId);
    if (!convo) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isParticipant = convo.participants.some(
      (p) => p.toString() === req.user.id,
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

const getMyThreads = async (req, res, next) => {
  try {
    const BloodBank = require("../model/BloodBank");

    const threads = await DirectConversation.find({
      participants: req.user.id,
    })
      .populate("participants", "firstname surname role")
      .sort({ updatedAt: -1 });

    const enriched = await Promise.all(
      threads.map(async (t) => {
        const obj = t.toObject();
        obj.participants = await Promise.all(
          obj.participants.map(async (p) => {
            if (p.role === "bloodbank") {
              const bb = await BloodBank.findOne({ user: p._id }).select(
                "name",
              );
              if (bb) p.name = bb.name;
            }
            return p;
          }),
        );
        const last = await ChatMessage.findOne({ match: t._id }).sort({
          createdAt: -1,
        });
        if (last) obj.lastMessage = last;
        return obj;
      }),
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

module.exports = { getOrCreateThread, getThreadMessages, getMyThreads };
