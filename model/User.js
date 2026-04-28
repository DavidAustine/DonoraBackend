const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: function () {
        return this.role !== "bloodbank";
      },
      trim: true,
    },

    surname: {
      type: String,
      required: function () {
        return this.role !== "bloodbank";
      },
      trim: true,
    },

    age: {
      type: Date,
      required: function () {
        return this.role !== "bloodbank";
      },
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ["patient", "donor", "bloodbank", "admin", "user"],
      required: true,
    },

    bloodType: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: function () {
        return this.role === "donor" || this.role === "patient";
      },
    },

    phone: String,

    // No default: "Point" — location is only written when user explicitly sets it.
    // A bare { type: "Point" } with no coordinates breaks the 2dsphere index on insert.
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: [Number], // [longitude, latitude]
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    refreshToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true },
);

// sparse: true — skips indexing documents that have no location field yet
userSchema.index({ location: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("User", userSchema);
