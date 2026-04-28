const PatientRequest = require("../model/PatientRequest");
const User = require("../model/User");

// CREATE REQUEST (patient)
const createRequest = async (req, res, next) => {
  try {
    const {
      requiredBloodType,
      unitsNeeded,
      lng,
      lat,
      isEmergency,
      targetBloodBank,
    } = req.body;

    if (!requiredBloodType || !unitsNeeded || !lng || !lat) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    let validatedBloodBank = null;

    if (targetBloodBank) {
      const BloodBank = require("../model/BloodBank");
      const found = await BloodBank.findById(targetBloodBank);
      if (!found)
        return res.status(404).json({ message: "Target blood bank not found" });
      validatedBloodBank = found._id;
    }

    const newRequest = await PatientRequest.create({
      patient: req.user.id,
      requiredBloodType,
      unitsNeeded,
      targetBloodBank: validatedBloodBank,
      location: {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
      isEmergency: isEmergency || false,
    });

    res.status(201).json(newRequest);
  } catch (err) {
    next(err);
  }
};

// GET MY REQUESTS
// FIX: now handles donor role too (was patient-only which caused silent 403s
// in the mobile request tab for donors). Donors see requests where they are
// the acceptedBy party — i.e. requests they have matched with.
const getMyRequests = async (req, res, next) => {
  try {
    if (req.user.role === "donor" || req.user.role == "bloodbank") {
      // Donors see requests they have accepted / are matched with
      const requests = await PatientRequest.find({
        acceptedBy: req.user.id,
      }).sort({ createdAt: -1 });
      return res.json(requests);
    }

    // Patients see their own requests
    const requests = await PatientRequest.find({
      patient: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    next(err);
  }
};

// CANCEL REQUEST (patient)
const cancelRequest = async (req, res, next) => {
  try {
    const request = await PatientRequest.findOne({
      _id: req.params.id,
      patient: req.user.id,
    });

    if (!request) return res.sendStatus(404);

    request.status = "cancelled";
    await request.save();

    res.json({ message: "Request cancelled successfully" });
  } catch (err) {
    next(err);
  }
};

// GET NEARBY REQUESTS (bloodbank)
const getNearbyRequests = async (req, res, next) => {
  try {
    const { lng, lat, radius = 10 } = req.query;

    if (!lng || !lat) {
      return res
        .status(400)
        .json({ message: "Longitude and latitude required" });
    }

    const maxDistanceMeters = parseFloat(radius) * 1000;

    const requests = await PatientRequest.find({
      status: "pending",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    }).populate("patient", "firstname surname bloodType phone");

    res.json(requests);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRequest,
  getMyRequests,
  cancelRequest,
  getNearbyRequests,
};
