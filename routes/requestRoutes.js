const express = require("express");
const router = express.Router();
const verifyJWT = require("../middleware/authMiddleware");
const requestController = require("../controller/requestController");

const verifyRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.sendStatus(403);
    }
    next();
  };
};

// Create a blood request
// Allowed: patient (for themselves) AND bloodbank (on behalf of a patient)
router.post(
  "/",
  verifyJWT,
  verifyRole(["patient", "bloodbank"]),
  requestController.createRequest,
);

// Get my own submitted/accepted requests (for tracking)
// Allowed: patient, donor, bloodbank
router.get(
  "/mine",
  verifyJWT,
  verifyRole(["patient", "donor", "bloodbank"]),
  requestController.getMyRequests,
);

// Cancel a request I submitted
// Allowed: patient, bloodbank
router.patch(
  "/cancel/:id",
  verifyJWT,
  verifyRole(["patient", "bloodbank"]),
  requestController.cancelRequest,
);

// Nearby pending requests (excluding own facility's requests for bloodbank)
// Allowed: bloodbank, donor
router.get(
  "/nearby",
  verifyJWT,
  verifyRole(["bloodbank", "donor"]),
  requestController.getNearbyRequests,
);

// All public pending requests (wider radius, for "Nearby Facilities" feature)
// Allowed: bloodbank, donor
router.get(
  "/public",
  verifyJWT,
  verifyRole(["bloodbank", "donor"]),
  requestController.getPublicRequests,
);

module.exports = router;
