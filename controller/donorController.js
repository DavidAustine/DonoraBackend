const DonorProfile = require('../model/DonorProfile')
const User = require('../model/User')
const PatientRequest = require('../model/PatientRequest')
const notify = require('../utils/notify')
const Match = require('../model/Match')
const { getCompatibleDonorTypes } = require('../utils/bloodCompatiblity')

// GET DONORS (PUBLIC SEARCH)
const getDonors = async (req, res, next) => {
  try {
    const { bloodType, page = 1, limit = 10 } = req.query
    const filter = { availabilityStatus: true, medicalEligible: true }
    const donors = await DonorProfile.find(filter)
      .populate({ path: "user", select: "firstname surname bloodType location phone" })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
    const result = bloodType
      ? donors.filter(d => {
          if (!d.user) return false
          return getCompatibleDonorTypes(bloodType).includes(d.user.bloodType)
        })
      : donors
    res.json(result)
  } catch (err) { next(err) }
}

// GET NEARBY DONORS
const getNearbyDonors = async (req, res, next) => {
  try {
    const { lng, lat, radius = 5 } = req.query
    if (!lng || !lat) return res.status(400).json({ message: "Longitude and latitude required" })
    const maxDistanceMeters = parseFloat(radius) * 1000
    const nearbyUsers = await User.find({
      role: "donor",
      location: { $near: { $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: maxDistanceMeters } },
    }).select('_id firstname surname bloodType location phone')
    const nearbyUserIds = nearbyUsers.map(u => u._id)
    const donors = await DonorProfile.find({
      user: { $in: nearbyUserIds },
      availabilityStatus: true,
      medicalEligible: true,
    }).populate({ path: "user", select: "firstname surname bloodType location phone" })
    res.json(donors)
  } catch (err) { next(err) }
}

// GET SINGLE DONOR PROFILE
const getDonorProfile = async (req, res, next) => {
  try {
    const donorProfile = await DonorProfile.findOne({ user: req.params.id })
      .populate("user", "firstname surname bloodType location phone")
    if (!donorProfile) return res.status(404).json({ message: "Donor not found" })
    res.json(donorProfile)
  } catch (err) { next(err) }
}

// GET MY DONOR PROFILE (for logged-in donor)
const getMyDonorProfile = async (req, res, next) => {
  try {
    const donorProfile = await DonorProfile.findOne({ user: req.user.id })
      .populate("user", "firstname surname bloodType location phone")
    if (!donorProfile) return res.status(404).json({ message: "Donor profile not found" })
    res.json(donorProfile)
  } catch (err) { next(err) }
}

// ACCEPT REQUEST (donor)
const acceptRequest = async (req, res, next) => {
  try {
    const donorProfile = await DonorProfile.findOne({ user: req.user.id }).populate("user")
    if (!donorProfile) return res.status(404).json({ message: "Donor profile not found" })
    if (!donorProfile.availabilityStatus) return res.status(400).json({ message: "You are unavailable" })
    const donorBloodType = donorProfile.user.bloodType
    const request = await PatientRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending", rejectedBy: { $ne: req.user.id } },
      { status: "matched", acceptedBy: req.user.id },
      { new: true }
    )
    if (!request) return res.status(400).json({ message: "Request already taken or invalid" })
    const compatibleDonorTypes = getCompatibleDonorTypes(request.requiredBloodType)
    if (!compatibleDonorTypes.includes(donorBloodType)) {
      request.status = "pending"
      request.acceptedBy = null
      await request.save()
      return res.status(400).json({ message: "Blood type not compatible" })
    }
    const match = await Match.create({
      request: request._id,
      participants: [request.patient, req.user.id],
      type: "donor",
    })
    // Notify patient in real-time
    const io = req.app?.get('io')
    await notify(
      io,
      request.patient,
      'donor_match',
      'A donor accepted your request!',
      `${donorProfile.user?.firstname || 'A donor'} will donate ${request.requiredBloodType} blood for you.`,
      match._id
    )

    res.json({ message: "Request accepted successfully", matchId: match._id })
  } catch (err) { next(err) }
}

// TOGGLE AVAILABILITY
const toggleAvailability = async (req, res, next) => {
  try {
    const donor = await DonorProfile.findOne({ user: req.user.id })
    if (!donor) return res.status(404).json({ message: "Donor profile not found" })
    donor.availabilityStatus = !donor.availabilityStatus
    await donor.save()
    res.json({ message: "Availability updated", availabilityStatus: donor.availabilityStatus })
  } catch (err) { next(err) }
}

// GET COMPATIBLE REQUESTS (donor)
const getCompatibleRequests = async (req, res, next) => {
  try {
    const donorProfile = await DonorProfile.findOne({ user: req.user.id }).populate("user")
    if (!donorProfile) return res.status(404).json({ message: "Donor profile not found" })
    if (!donorProfile.availabilityStatus) return res.status(400).json({ message: "You are currently unavailable" })
    const donorBloodType = donorProfile.user.bloodType
    const donorLocation = donorProfile.user.location
    if (!donorBloodType || !donorLocation?.coordinates?.length)
      return res.status(400).json({ message: "Complete your profile first (blood type + location)" })
    const { radius = 20 } = req.query
    const maxDistanceMeters = parseFloat(radius) * 1000
    const nearbyRequests = await PatientRequest.find({
      status: "pending",
      rejectedBy: { $ne: req.user.id },
      location: { $near: { $geometry: donorLocation, $maxDistance: maxDistanceMeters } },
    }).populate("patient", "firstname surname bloodType phone")
    const compatibleRequests = nearbyRequests.filter(request => {
      return getCompatibleDonorTypes(request.requiredBloodType).includes(donorBloodType)
    })
    res.json(compatibleRequests)
  } catch (err) { next(err) }
}

// REJECT REQUEST
const rejectRequest = async (req, res, next) => {
  try {
    const request = await PatientRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $addToSet: { rejectedBy: req.user.id } },
      { new: true }
    )
    if (!request) return res.status(404).json({ message: "Request not found or not pending" })
    res.json({ message: "Request rejected successfully" })
  } catch (err) { next(err) }
}

// COMPLETE MATCH (donor/patient side)
const completeMatch = async (req, res, next) => {
  try {
    const { matchId } = req.body
    const match = await Match.findById(matchId)
    if (!match) return res.status(404).json({ message: "Match not found" })
    if (!match.participants.some(p => p.toString() === req.user.id))
      return res.status(403).json({ message: "Unauthorized" })
    match.status = "completed"
    await match.save()
    await PatientRequest.findByIdAndUpdate(match.request, { status: "completed" })
    res.json({ message: "Match marked as completed" })
  } catch (err) { next(err) }
}

// ─── BLOOD BANK CONFIRMS DONATION ─────────────────────────────────────────
// Called by blood bank when they confirm a donor has donated.
// PATCH /api/donors/confirm-donation   body: { donorUserId }
// This auto-increments donationCount and calculates next eligible date (56 days).
const confirmDonation = async (req, res, next) => {
  try {
    const { donorUserId } = req.body

    // Only blood banks can confirm
    if (req.user.role !== "bloodbank" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only blood banks can confirm donations" })
    }

    if (!donorUserId) {
      return res.status(400).json({ message: "donorUserId is required" })
    }

    const donationDate = new Date()
    // Standard whole blood donation: 56 days (8 weeks) recovery
    const nextEligible = new Date(donationDate)
    nextEligible.setDate(nextEligible.getDate() + 56)

    const donorProfile = await DonorProfile.findOneAndUpdate(
      { user: donorUserId },
      {
        $inc: { donationCount: 1 },
        $set: {
          lastDonationDate: donationDate,
          nextEligibleDate: nextEligible,
          // Auto-mark unavailable until next eligible date
          availabilityStatus: false,
          medicalEligible: false,
        },
      },
      { new: true }
    ).populate("user", "firstname surname bloodType")

    if (!donorProfile) {
      return res.status(404).json({ message: "Donor profile not found" })
    }

    // Notify donor via socket
    const io = req.app.get("io")
    if (io) {
      io.to(donorUserId.toString()).emit("donationConfirmed", {
        donationCount: donorProfile.donationCount,
        lastDonationDate: donorProfile.lastDonationDate,
        nextEligibleDate: donorProfile.nextEligibleDate,
      })
    }

    // Schedule re-enabling availability on nextEligibleDate
    // (In production use a job queue like Bull/Agenda; here we use setTimeout as a simple demo)
    const delay = nextEligible - donationDate
    setTimeout(async () => {
      try {
        await DonorProfile.findOneAndUpdate(
          { user: donorUserId },
          { $set: { availabilityStatus: true, medicalEligible: true } }
        )
        if (io) {
          io.to(donorUserId.toString()).emit("donorEligibleAgain", {
            message: "You are now eligible to donate again!",
          })
        }
      } catch (_) {}
    }, delay)

    res.json({
      message: "Donation confirmed successfully",
      donorProfile: {
        donationCount: donorProfile.donationCount,
        lastDonationDate: donorProfile.lastDonationDate,
        nextEligibleDate: donorProfile.nextEligibleDate,
        donor: donorProfile.user,
      },
    })
  } catch (err) { next(err) }
}

module.exports = {
  getDonors,
  getNearbyDonors,
  getDonorProfile,
  getMyDonorProfile,
  acceptRequest,
  toggleAvailability,
  getCompatibleRequests,
  rejectRequest,
  completeMatch,
  confirmDonation,
}
