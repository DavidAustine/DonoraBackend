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

    // Optional: name/note about who the patient is (when requested by facility)
    patientNote: {
      type: String,
    },

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

    // Who actually submitted this request (patient or bloodbank on behalf)
    requestedByRole: {
      type: String,
      enum: ["patient", "bloodbank"],
      default: "patient",
    },

    // If a blood bank/medical facility submitted this on behalf of a patient,
    // store the BloodBank._id here so we can filter it out from that facility's
    // Requests page (a facility should not see/accept its own requests).
    requestedByFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BloodBank",
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
