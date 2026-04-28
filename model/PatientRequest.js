const mongoose = require("mongoose");

const patientRequestSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requiredBloodType: {
      type: String,
      required: true,
    },

    unitsNeeded: {
      type: Number,
      required: true,
    },

    // No default: "Point" — same reason as User.js
    // coordinates are always provided explicitly when creating a request
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: [Number], // [longitude, latitude]
    },

    status: {
      type: String,
      enum: ["pending", "matched", "completed", "cancelled"],
      default: "pending",
    },

    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    targetBloodBank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BloodBank",
    },

    isEmergency: {
      type: Boolean,
      default: false,
    },

    rejectedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// sparse: true — safe for docs that may not have location set
patientRequestSchema.index({ location: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("PatientRequest", patientRequestSchema);
