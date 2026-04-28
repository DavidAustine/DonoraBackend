const User = require("../model/User");
const DonorProfile = require("../model/DonorProfile");

const BloodBank = require("../model/BloodBank");
// GET MY PROFILE

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -refreshToken -resetPasswordToken",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let bloodBank = null;

    if (user.role === "bloodbank") {
      bloodBank = await BloodBank.findOne({ user: user._id });
    }

    res.json({
      user,
      bloodBank,
    });
  } catch (err) {
    next(err);
  }
};

// GET PUBLIC PROFILE OF ANY USER (for "view user" page)
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "firstname surname bloodType role age createdAt",
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    let donorProfile = null;
    if (user.role === "donor") {
      donorProfile = await DonorProfile.findOne({ user: user._id }).select(
        "availabilityStatus donationCount lastDonationDate nextEligibleDate medicalEligible",
      );
    }

    res.json({ user, donorProfile });
  } catch (err) {
    next(err);
  }
};

// UPDATE PROFILE
const updateMyProfile = async (req, res, next) => {
  try {
    const { firstname, surname, phone, bloodType, age } = req.body;
    const updates = {};
    if (firstname) updates.firstname = firstname;
    if (surname) updates.surname = surname;
    if (phone) updates.phone = phone;
    if (bloodType) updates.bloodType = bloodType;
    if (age) updates.age = age;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true },
    ).select("-password -refreshToken -resetPasswordToken");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });
    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
};

// UPDATE LIVE LOCATION
const updateLocation = async (req, res, next) => {
  try {
    const { lng, lat } = req.body;
    if (lng === undefined || lat === undefined)
      return res.status(400).json({ message: "lng and lat are required" });

    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    if (isNaN(longitude) || isNaN(latitude))
      return res.status(400).json({ message: "Invalid coordinates" });

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          location: { type: "Point", coordinates: [longitude, latitude] },
        },
      },
      { new: true },
    ).select("firstname surname location role");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });
    res.json({ message: "Location updated", location: updatedUser.location });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyProfile,
  getUserProfile,
  updateMyProfile,
  updateLocation,
};
