const BloodStock = require("../model/BloodStock");
const BloodBank = require("../model/BloodBank");
const PatientRequest = require("../model/PatientRequest");
const Match = require("../model/Match");

// ─── UPDATE STOCK ─────────────────────────────────────────────────────────────
const updateStock = async (req, res, next) => {
  try {
    const { bloodType, units } = req.body;

    if (!bloodType || units === undefined) {
      return res.status(400).json({ message: "Blood type and units required" });
    }

    const bloodBankProfile = await BloodBank.findOne({ user: req.user.id });
    if (!bloodBankProfile) {
      return res.status(404).json({ message: "BloodBank profile not found" });
    }

    let stock = await BloodStock.findOne({
      bloodBank: bloodBankProfile._id,
      bloodType,
    });

    if (stock) {
      stock.unitsAvailable = units;
      await stock.save();
    } else {
      stock = await BloodStock.create({
        bloodBank: bloodBankProfile._id,
        bloodType,
        unitsAvailable: units,
      });
    }

    res.json(stock);
  } catch (err) {
    next(err);
  }
};

// ─── GET MY STOCK ─────────────────────────────────────────────────────────────
const getMyStock = async (req, res, next) => {
  try {
    const bloodBankProfile = await BloodBank.findOne({ user: req.user.id });
    if (!bloodBankProfile) {
      return res.status(404).json({ message: "BloodBank profile not found" });
    }

    const stock = await BloodStock.find({ bloodBank: bloodBankProfile._id });
    res.json(stock);
  } catch (err) {
    next(err);
  }
};

// ─── FULFILL REQUEST ──────────────────────────────────────────────────────────
const fulfillRequest = async (req, res, next) => {
  try {
    const bloodBank = await BloodBank.findOne({ user: req.user.id });
    if (!bloodBank)
      return res.status(404).json({ message: "BloodBank profile not found" });

    const match = await Match.findOne({
      request: req.params.id,
      type: "bloodbank",
      status: "active",
      participants: req.user.id,
    });
    if (!match)
      return res.status(400).json({ message: "Active match not found" });

    const request = await PatientRequest.findById(req.params.id);
    if (!request) return res.sendStatus(404);

    const stock = await BloodStock.findOne({
      bloodBank: bloodBank._id,
      bloodType: request.requiredBloodType,
    });

    if (!stock || stock.unitsAvailable < request.unitsNeeded)
      return res.status(400).json({ message: "Insufficient stock" });

    stock.unitsAvailable -= request.unitsNeeded;
    await stock.save();

    match.status = "completed";
    await match.save();

    request.status = "completed";
    await request.save();

    // Emit real-time event to patient
    const io = req.app.get("io");
    if (io) {
      io.to(request.patient.toString()).emit("requestFulfilled", {
        requestId: request._id,
        bloodBankName: bloodBank.name,
      });
    }

    res.json({ message: "Request fulfilled successfully" });
  } catch (err) {
    next(err);
  }
};

// ─── ACCEPT PATIENT REQUEST ───────────────────────────────────────────────────
const acceptPatientRequest = async (req, res, next) => {
  try {
    const bloodBank = await BloodBank.findOne({ user: req.user.id });
    if (!bloodBank)
      return res.status(404).json({ message: "BloodBank profile not found" });

    const request = await PatientRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        status: "matched",
        acceptedBy: req.user.id,
        targetBloodBank: bloodBank._id,
      },
      { new: true }
    );

    if (!request)
      return res
        .status(400)
        .json({ message: "Request already processed or not found" });

    const match = await Match.create({
      request: request._id,
      participants: [request.patient, req.user.id],
      type: "bloodbank",
    });

    // Real-time notification to patient
    const io = req.app.get("io");
    if (io) {
      io.to(request.patient.toString()).emit("requestAccepted", {
        requestId: request._id,
        matchId: match._id,
        bloodBankName: bloodBank.name,
        type: "bloodbank",
      });
    }

    res.json({ message: "Request accepted successfully", matchId: match._id });
  } catch (err) {
    next(err);
  }
};

// ─── GET MY BLOOD BANK ────────────────────────────────────────────────────────
const getMyBloodBank = async (req, res, next) => {
  try {
    const bloodBank = await BloodBank.findOne({ user: req.user.id });
    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank not found" });
    }
    res.json(bloodBank);
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE MY BLOOD BANK ─────────────────────────────────────────────────────
const updateMyBloodBank = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    const updated = await BloodBank.findOneAndUpdate(
      { user: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Blood bank not found" });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// ─── GET NEARBY BLOOD BANKS (public) ─────────────────────────────────────────
// GET /bloodbank/nearby?lng=&lat=&radius=
// Called by patient mobile "Blood Bank" tab and web app map.
const getNearbyBloodBanks = async (req, res, next) => {
  try {
    const { lng, lat, radius = 10 } = req.query;

    if (!lng || !lat) {
      return res
        .status(400)
        .json({ message: "Longitude and latitude required" });
    }

    const maxDistanceMeters = parseFloat(radius) * 1000;

    const banks = await BloodBank.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    })
      .select("name phone location isVerified user availableTypes address")
      .limit(20);

    res.json(banks);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  updateStock,
  getMyStock,
  fulfillRequest,
  acceptPatientRequest,
  getMyBloodBank,
  updateMyBloodBank,
  getNearbyBloodBanks,
};
