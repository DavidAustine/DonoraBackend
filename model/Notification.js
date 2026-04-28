const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "request_accepted",  // patient: their request was accepted
        "request_fulfilled", // patient: their request was fulfilled
        "donor_match",       // patient: a compatible donor was found
        "sos_match",         // patient: SOS was matched
        "message",           // any: new chat message
        "donation_confirmed",// donor: blood bank confirmed donation
        "new_request_nearby",// donor: new compatible request near them
        "system",
      ],
      default: "system",
    },

    title: { type: String, required: true },
    body: { type: String, default: "" },

    // Optional: link to related entity (match, request, etc.)
    refId: { type: String, default: null },

    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
