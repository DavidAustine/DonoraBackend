const PatientRequest = require("../model/PatientRequest");
const User = require("../model/User");

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

const getMyRequests = async (req, res, next) => {
  try {
    if (req.user.role === "donor" || req.user.role == "bloodbank") {
      const requests = await PatientRequest.find({
        acceptedBy: req.user.id,
      }).sort({ createdAt: -1 });
      return res.json(requests);
    }

    const requests = await PatientRequest.find({
      patient: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    next(err);
  }
};

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
