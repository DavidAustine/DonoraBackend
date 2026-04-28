const express = require('express')
const router = express.Router()
const verifyJWT = require('../middleware/authMiddleware')
const requestController = require('../controller/requestController')

const verifyRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.sendStatus(403)
    }
    next()
  }
}

// ── Patient routes ────────────────────────────────────────────────────────────

router.post('/', verifyJWT, verifyRole(['patient']), requestController.createRequest)

// FIX: was restricted to ['patient'] only, but request.jsx calls this for donors
// too (to show requests they've accepted). The controller now handles both roles.
router.get('/mine', verifyJWT, verifyRole(['patient', 'donor']), requestController.getMyRequests)

router.patch('/cancel/:id', verifyJWT, verifyRole(['patient']), requestController.cancelRequest)

// ── Blood bank routes ─────────────────────────────────────────────────────────

router.get('/nearby', verifyJWT, verifyRole(['bloodbank']), requestController.getNearbyRequests)

module.exports = router
