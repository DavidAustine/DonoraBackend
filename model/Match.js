const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientRequest",
      required: true
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    type: {
      type: String,
      enum: ["donor", "bloodbank"],
      required: true
    },

    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Match", matchSchema);  