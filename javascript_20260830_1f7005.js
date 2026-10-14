import mongoose from "mongoose";

const guestAccessSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accessLevel: {
      type: String,
      enum: ["view", "comment", "edit"],
      default: "view",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    metadata: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      lastAccessedAt: {
        type: Date,
      },
      accessCount: {
        type: Number,
        default: 0,
      },
      ipAddress: {
        type: String,
      },
      userAgent: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
guestAccessSchema.index({ token: 1 });
guestAccessSchema.index({ meetingId: 1, expiresAt: 1 });
guestAccessSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for isExpired
guestAccessSchema.virtual("isExpired").get(function () {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual for isValid
guestAccessSchema.virtual("isValid").get(function () {
  return !this.isRevoked && !this.isExpired;
});

// Ensure virtuals are included in JSON
guestAccessSchema.set("toJSON", { virtuals: true });
guestAccessSchema.set("toObject", { virtuals: true });

const GuestAccess = mongoose.model("GuestAccess", guestAccessSchema);

export default GuestAccess;
