const mongoose = require("mongoose");

const bloodStockSchema = new mongoose.Schema(
  {
    bloodBank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BloodBank",
      required: true
    },

    bloodType: {
      type: String,
      required: true
    },

    unitsAvailable: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("BloodStock", bloodStockSchema);
