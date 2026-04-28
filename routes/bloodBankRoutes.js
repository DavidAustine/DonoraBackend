const express = require("express");
const router = express.Router();
const verifyJWT = require("../middleware/authMiddleware");
const bloodBankController = require("../controller/bloodBankController");

const verifyRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.sendStatus(403);
    }
    next();
  };
};

// ── Public ────────────────────────────────────────────────────────────────────
// GET /bloodbank/nearby?lng=&lat=&radius=
// Used by patient mobile app "Blood Bank" tab to find nearby blood banks.
// Also used by blood bank web app to show peer banks on map (future).
router.get("/nearby", bloodBankController.getNearbyBloodBanks);

// ── Blood-bank-only ───────────────────────────────────────────────────────────
router.post(
  "/stock",
  verifyJWT,
  verifyRole(["bloodbank"]),
  bloodBankController.updateStock
);
router.get(
  "/stock",
  verifyJWT,
  verifyRole(["bloodbank"]),
  bloodBankController.getMyStock
);
router.post(
  "/fulfill/:id",
  verifyJWT,
  verifyRole(["bloodbank"]),
  bloodBankController.fulfillRequest
);
router.post("/accept/:id", verifyJWT, bloodBankController.acceptPatientRequest);
router.get("/me", verifyJWT, bloodBankController.getMyBloodBank);
router.patch("/me", verifyJWT, bloodBankController.updateMyBloodBank);

module.exports = router;
