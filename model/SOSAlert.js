const mongoose = require("mongoose");

const sosAlertSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: [Number],
    },
    bloodType: { type: String },
    unitsNeeded: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "resolved"], default: "active" },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
  },
  { timestamps: true }
);

sosAlertSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("SOSAlert", sosAlertSchema);
