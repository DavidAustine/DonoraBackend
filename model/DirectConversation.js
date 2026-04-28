const mongoose = require("mongoose");

/**
 * DirectConversation
 * ------------------
 * A lightweight chat thread between exactly two users that does NOT
 * require a Match record. Used for donor ↔ blood-bank enquiries where
 * no formal match/request exists yet.
 *
 * Messages reuse the existing ChatMessage collection — they just
 * reference this document's _id as their `match` field so the existing
 * chat controller keeps working without changes.
 */
const directConversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // Last message snapshot for list screens (updated on every send)
    lastMessage: {
      message: String,
      createdAt: Date,
    },
  },
  { timestamps: true }
);

// Fast look-up: find the conversation between two specific users
directConversationSchema.index({ participants: 1 });

module.exports = mongoose.model("DirectConversation", directConversationSchema);
