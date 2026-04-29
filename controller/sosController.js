const SOSAlert = require("../model/SOSAlert");
const User = require("../model/User");
const BloodBank = require("../model/BloodBank");
const Match = require("../model/Match");
const PatientRequest = require("../model/PatientRequest");
const notify = require("../utils/notify");

const createSOS = async (req, res, next) => {
  try {
    const { lng, lat, unitsNeeded = 1, bloodType } = req.body;

    if (!lng || !lat)
      return res.status(400).json({ message: "Location required" });

    const patient = await User.findById(req.user.id).select("bloodType");
    const effectiveBloodType = bloodType || patient?.bloodType;

    const sos = await SOSAlert.create({
      patient: req.user.id,
      location: {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
      bloodType: effectiveBloodType,
      unitsNeeded: parseInt(unitsNeeded) || 1,
    });

    const nearbyBloodBanks = await BloodBank.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: 10000,
        },
      },
    }).select("_id user name phone");

    const io = req.app.get("io");

    for (const bb of nearbyBloodBanks) {
      io?.to(bb.user.toString()).emit("newSOS", {
        sosId: sos._id,
        bloodType: effectiveBloodType,
        unitsNeeded,
        patientId: req.user.id,
        location: sos.location,
      });

      await notify(
        io,
        bb.user,
        "system",
        "🚨 Emergency SOS Alert",
        `Patient needs ${effectiveBloodType} blood — ${unitsNeeded} unit(s). Tap to respond.`,
        sos._id,
      );
    }

    res.status(201).json({
      message: `SOS sent to ${nearbyBloodBanks.length} nearby blood bank(s)`,
      sos,
      nearbyBloodBanks: nearbyBloodBanks.map((bb) => ({
        id: bb._id,
        userId: bb.user,
        name: bb.name,
        phone: bb.phone,
      })),
      nearbyCount: nearbyBloodBanks.length,
    });
  } catch (err) {
    next(err);
  }
};
const acceptSOS = async (req, res, next) => {
  try {
    const { sosId } = req.body;

    if (req.user.role !== "bloodbank") {
      return res
        .status(403)
        .json({ message: "Only blood banks can accept SOS alerts" });
    }

    const sos = await SOSAlert.findById(sosId);
    if (!sos) return res.status(404).json({ message: "SOS not found" });
    if (sos.status !== "active")
      return res.status(400).json({ message: "SOS already resolved" });

    const emergencyRequest = await PatientRequest.create({
      patient: sos.patient,
      requiredBloodType: sos.bloodType || "O+",
      unitsNeeded: sos.unitsNeeded || 1,
      location: sos.location,
      status: "matched",
      acceptedBy: req.user.id,
      isEmergency: true,
    });

    const match = await Match.create({
      request: emergencyRequest._id,
      participants: [sos.patient, req.user.id],
      type: "bloodbank",
      status: "active",
    });

    sos.status = "resolved";
    sos.acceptedBy = req.user.id;
    sos.matchId = match._id;
    await sos.save();

    const io = req.app.get("io");

    io?.to(sos.patient.toString()).emit("sosAccepted", {
      matchId: match._id,
      bloodBankUserId: req.user.id,
      message: "A blood bank has accepted your SOS!",
    });

    await notify(
      io,
      sos.patient,
      "sos_match",
      "✅ SOS Accepted",
      "A nearby blood bank has responded to your emergency. Open Matches to chat.",
      match._id,
    );

    res.json({
      message: "SOS accepted",
      matchId: match._id,
      requestId: emergencyRequest._id,
    });
  } catch (err) {
    next(err);
  }
};

const resolveSOS = async (req, res, next) => {
  try {
    const sos = await SOSAlert.findOneAndUpdate(
      { _id: req.params.id, patient: req.user.id },
      { status: "resolved" },
      { new: true },
    );
    if (!sos) return res.status(404).json({ message: "SOS not found" });
    res.json({ message: "SOS resolved" });
  } catch (err) {
    next(err);
  }
};

const getMySOS = async (req, res, next) => {
  try {
    const alerts = await SOSAlert.find({ patient: req.user.id })
      .sort({ createdAt: -1 })
      .populate("acceptedBy", "firstname surname");
    res.json(alerts);
  } catch (err) {
    next(err);
  }
};

const getSOSMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const match = await Match.findById(matchId)
      .populate("request")
      .populate("participants", "firstname surname role location phone");
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!match.participants.some((p) => p._id.toString() === req.user.id))
      return res.status(403).json({ message: "Unauthorized" });

    const bbUser = match.participants.find((p) => p.role === "bloodbank");
    let bloodBankDetails = null;
    if (bbUser) {
      bloodBankDetails = await BloodBank.findOne({ user: bbUser._id });
    }

    res.json({ match, bloodBank: bloodBankDetails });
  } catch (err) {
    next(err);
  }
};

module.exports = { createSOS, acceptSOS, resolveSOS, getMySOS, getSOSMatch };
