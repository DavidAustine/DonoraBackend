const express = require('express')
const router = express.Router()
const donorController = require('../controller/donorController')
const verifyJWT = require('../middleware/authMiddleware')

const verifyRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.sendStatus(403)
  next()
}

router.get("/me", verifyJWT, verifyRole(['donor']), donorController.getMyDonorProfile)
router.patch("/availability", verifyJWT, verifyRole(['donor']), donorController.toggleAvailability)
router.get("/requests", verifyJWT, verifyRole(['donor']), donorController.getCompatibleRequests)
router.patch("/complete", verifyJWT, verifyRole(['donor']), donorController.completeMatch)
router.post("/reject/:id", verifyJWT, verifyRole(['donor']), donorController.rejectRequest)
router.post("/accept/:id", verifyJWT, verifyRole(['donor']), donorController.acceptRequest)
router.patch("/confirm-donation", verifyJWT, verifyRole(['bloodbank', 'admin']), donorController.confirmDonation)

// Public routes
router.get("/nearby", donorController.getNearbyDonors)
router.get("/:id", donorController.getDonorProfile)
router.get("/", donorController.getDonors)

module.exports = router
