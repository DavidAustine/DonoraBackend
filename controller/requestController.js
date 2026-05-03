const PatientRequest = require("../model/PatientRequest");
const User = require("../model/User");

// ─── Helper: get BloodBank doc for a given user id ────────────────────────────
async function getBloodBankForUser(userId) {
  const BloodBank = require("../model/BloodBank");
  return BloodBank.findOne({ user: userId });
}

// ─── POST /api/requests ───────────────────────────────────────────────────────
// Allowed for: patient, bloodbank (on behalf of a patient)
const createRequest = async (req, res, next) => {
  try {
    const {
      requiredBloodType,
      unitsNeeded,
      lng,
      lat,
      isEmergency,
      targetBloodBank,
      patientNote,   // optional note when bloodbank submits on behalf of patient
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

    // Track which facility made the request so it can be filtered out
    // from that facility's own Requests feed.
    let requestedByFacility = null;
    if (req.user.role === "bloodbank") {
      const myBank = await getBloodBankForUser(req.user.id);
      if (myBank) requestedByFacility = myBank._id;
    }

    const newRequest = await PatientRequest.create({
      patient: req.user.id,
      requiredBloodType,
      unitsNeeded,
      targetBloodBank: validatedBloodBank,
      patientNote: patientNote || null,
      location: {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
      isEmergency: isEmergency || false,
      requestedByRole: req.user.role === "bloodbank" ? "bloodbank" : "patient",
      requestedByFacility,
    });

    // Broadcast emergency to all connected clients (web blood bank dashboards)
    if (newRequest.isEmergency) {
      const io = req.app.get("io");
      if (io) {
        io.emit("emergencyRequest", {
          _id: newRequest._id,
          requiredBloodType: newRequest.requiredBloodType,
          unitsNeeded: newRequest.unitsNeeded,
        });
      }
    }

    res.status(201).json(newRequest);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/requests/mine ───────────────────────────────────────────────────
// Returns the current user's OWN submitted requests (for tracking)
// Works for patient AND bloodbank roles.
const getMyRequests = async (req, res, next) => {
  try {
    let requests;

    if (req.user.role === "bloodbank") {
      // Blood bank: return requests they submitted (requestedByRole=bloodbank, patient=their userId)
      // AND requests that were accepted by them
      const BloodBank = require("../model/BloodBank");
      const myBank = await BloodBank.findOne({ user: req.user.id });

      const submitted = await PatientRequest.find({
        requestedByFacility: myBank?._id,
      }).sort({ createdAt: -1 });

      const accepted = await PatientRequest.find({
        acceptedBy: req.user.id,
        // exclude ones we submitted ourselves (already in submitted list)
        requestedByFacility: { $ne: myBank?._id },
      }).sort({ createdAt: -1 });

      requests = { submitted, accepted };
    } else if (req.user.role === "donor") {
      requests = await PatientRequest.find({
        acceptedBy: req.user.id,
      }).sort({ createdAt: -1 });
    } else {
      // patient
      requests = await PatientRequest.find({
        patient: req.user.id,
      }).sort({ createdAt: -1 });
    }

    res.json(requests);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/requests/cancel/:id ──────────────────────────────────────────
// Cancel a request — allowed by the submitter (patient or bloodbank that submitted)
const cancelRequest = async (req, res, next) => {
  try {
    // Match either by patient user id OR by the facility that submitted it
    const BloodBank = require("../model/BloodBank");
    let query = { _id: req.params.id };

    if (req.user.role === "bloodbank") {
      const myBank = await BloodBank.findOne({ user: req.user.id });
      query.requestedByFacility = myBank?._id;
    } else {
      query.patient = req.user.id;
    }

    const request = await PatientRequest.findOne(query);
    if (!request) return res.sendStatus(404);

    request.status = "cancelled";
    await request.save();

    res.json({ message: "Request cancelled successfully" });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/requests/nearby ─────────────────────────────────────────────────
// Returns nearby pending requests.
// For bloodbank: excludes requests that THEY submitted (can't accept own request).
// For donors: returns all compatible nearby (filtered by donor route separately).
// Visible to: bloodbank, donor, patient (read-only for patient)
const getNearbyRequests = async (req, res, next) => {
  try {
    const { lng, lat, radius = 10 } = req.query;

    if (!lng || !lat) {
      return res
        .status(400)
        .json({ message: "Longitude and latitude required" });
    }

    const maxDistanceMeters = parseFloat(radius) * 1000;

    // Build exclusion filter for blood banks (can't see/accept own requests)
    let excludeFacilityFilter = {};
    if (req.user.role === "bloodbank") {
      const BloodBank = require("../model/BloodBank");
      const myBank = await BloodBank.findOne({ user: req.user.id });
      if (myBank) {
        excludeFacilityFilter = { requestedByFacility: { $ne: myBank._id } };
      }
    }

    const requests = await PatientRequest.find({
      status: "pending",
      ...excludeFacilityFilter,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    }).populate("patient", "firstname surname bloodType phone")
      .populate("requestedByFacility", "name phone");

    res.json(requests);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/requests/public ─────────────────────────────────────────────────
// All pending requests visible to donors and other facilities (no location filter)
// Used by the "Nearby Facilities" view to show what's being requested
const getPublicRequests = async (req, res, next) => {
  try {
    const { lng, lat, radius = 50 } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ message: "Longitude and latitude required" });
    }

    const maxDistanceMeters = parseFloat(radius) * 1000;

    let excludeFacilityFilter = {};
    if (req.user.role === "bloodbank") {
      const BloodBank = require("../model/BloodBank");
      const myBank = await BloodBank.findOne({ user: req.user.id });
      if (myBank) {
        excludeFacilityFilter = { requestedByFacility: { $ne: myBank._id } };
      }
    }

    const requests = await PatientRequest.find({
      status: "pending",
      ...excludeFacilityFilter,
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
      .populate("patient", "firstname surname bloodType phone")
      .populate("requestedByFacility", "name phone")
      .limit(100);

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
  getPublicRequests,
};
