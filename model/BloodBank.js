const mongoose = require("mongoose");

const bloodBankSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true
    },

    phone: String,

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },

    isVerified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

bloodBankSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("BloodBank", bloodBankSchema);