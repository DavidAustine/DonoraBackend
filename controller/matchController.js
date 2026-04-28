const Match = require("../model/Match");
const PatientRequest = require("../model/PatientRequest");

// GET MY MATCHES (deduplicated by participant pair — keeps newest active per pair)
const getMyMatches = async (req, res, next) => {
  try {
    const BloodBank = require("../model/BloodBank");

    const matches = await Match.find({ participants: req.user.id })
      .populate("request")
      .populate("participants", "firstname surname role bloodType phone")
      .sort({ createdAt: -1 });

    // Attach bloodbank display name for any bloodbank-role participant
    const enriched = await Promise.all(
      matches.map(async (match) => {
        const m = match.toObject();
        m.participants = await Promise.all(
          m.participants.map(async (p) => {
            if (p.role === "bloodbank") {
              const bb = await BloodBank.findOne({ user: p._id }).select("name");
              if (bb) p.name = bb.name;
            }
            return p;
          })
        );
        return m;
      })
    );

    // Deduplicate: for each unique sorted participant pair, keep only the
    // most-recent active match (fall back to most-recent of any status).
    const seen = new Map();
    const deduped = [];
    for (const m of enriched) {
      const key = (m.participants || [])
        .map((p) => (p._id || p).toString())
        .sort()
        .join("|");
      if (!seen.has(key)) {
        seen.set(key, true);
        deduped.push(m);
      }
    }

    res.json(deduped);
  } catch (err) {
    next(err);
  }
};

// FIND EXISTING ACTIVE MATCH WITH A SPECIFIC USER
// Used by mobile /chat/new to avoid creating a second chat session.
const findMatchWithUser = async (req, res, next) => {
  try {
    const otherId = req.params.userId;
    const meId    = req.user.id;

    // Look for any active match where both users are participants
    const match = await Match.findOne({
      participants: { $all: [meId, otherId] },
      status: "active",
    })
      .populate("request")
      .populate("participants", "firstname surname role bloodType phone")
      .sort({ createdAt: -1 });

    if (!match) {
      return res.status(404).json({ message: "No active match found" });
    }

    res.json(match);
  } catch (err) {
    next(err);
  }
};

const cancelMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) return res.status(404).json({ message: "Match not found" });

    if (!match.participants.some((p) => p.toString() === req.user.id))
      return res.status(403).json({ message: "Unauthorized" });

    if (match.status !== "active")
      return res.status(400).json({ message: "Match already closed" });

    match.status = "cancelled";
    await match.save();

    await PatientRequest.findByIdAndUpdate(match.request, {
      status: "pending",
      acceptedBy: null,
    });

    res.json({ message: "Match cancelled successfully" });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyMatches, findMatchWithUser, cancelMatch };
