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
    // Sorted canonical key used to guarantee one thread per pair.
    // Set on creation via pre-save hook — never mutated after that.
    participantKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Last message snapshot for list screens (updated on every send)
    lastMessage: {
      message: String,
      createdAt: Date,
    },
  },
  { timestamps: true },
);

// Build the canonical key before every new document is saved.
// This makes findOneAndUpdate({ upsert: true }) safe — the unique
// index on participantKey prevents duplicate threads even under
// concurrent requests.
directConversationSchema.pre("save", function (next) {
  if (this.isNew) {
    this.participantKey = [...this.participants]
      .map((p) => p.toString())
      .sort()
      .join("|");
  }
  next();
});

// Fast look-up: find the conversation between two specific users
directConversationSchema.index({ participants: 1 });

module.exports = mongoose.model("DirectConversation", directConversationSchema);
