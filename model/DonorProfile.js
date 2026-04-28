const mongoose = require("mongoose");

const donorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    availabilityStatus: {
      type: Boolean,
      default: true,
    },

    lastDonationDate: Date,

    // Auto-computed: lastDonationDate + 56 days (8 weeks standard)
    nextEligibleDate: Date,

    // Total confirmed donations (incremented by blood bank confirmation)
    donationCount: {
      type: Number,
      default: 0,
    },

    medicalEligible: {
      type: Boolean,
      default: true,
    },

    notificationPreference: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DonorProfile", donorProfileSchema);
