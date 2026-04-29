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

router.post(
  "/",
  verifyJWT,
  verifyRole(["patient"]),
  requestController.createRequest,
);

router.get(
  "/mine",
  verifyJWT,
  verifyRole(["patient", "donor"]),
  requestController.getMyRequests,
);

router.patch(
  "/cancel/:id",
  verifyJWT,
  verifyRole(["patient"]),
  requestController.cancelRequest,
);

router.get(
  "/nearby",
  verifyJWT,
  verifyRole(["bloodbank"]),
  requestController.getNearbyRequests,
);

module.exports = router;
