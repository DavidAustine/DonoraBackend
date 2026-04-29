const ChatMessage = require("../model/ChatMessage");
const Match = require("../model/Match");

const sendMessage = async (req, res, next) => {
  try {
    const { matchId, message } = req.body;

    if (!matchId || !message)
      return res
        .status(400)
        .json({ message: "matchId and message are required" });

    const match = await Match.findById(matchId);

    if (!match) return res.status(404).json({ message: "Match not found" });

    if (!match.participants.some((p) => p.toString() === req.user.id))
      return res.status(403).json({ message: "Unauthorized" });

    const newMessage = await ChatMessage.create({
      match: matchId,
      sender: req.user.id,
      message,
    });

    res.status(201).json(newMessage);
  } catch (err) {
    next(err);
  }
};

const getChatMessages = async (req, res, next) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);

    if (!match) return res.status(404).json({ message: "Match not found" });

    if (!match.participants.some((p) => p.toString() === req.user.id))
      return res.status(403).json({ message: "Unauthorized" });

    const messages = await ChatMessage.find({ match: matchId })
      .populate("sender", "firstname surname") // ✅ was "fullname" — field doesn't exist
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage, getChatMessages };
