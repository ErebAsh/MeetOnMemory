import mongoose from "mongoose";

const meetingOwnershipTransferSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

meetingOwnershipTransferSchema.index({ toUser: 1, status: 1 });
meetingOwnershipTransferSchema.index({ fromUser: 1, status: 1 });
meetingOwnershipTransferSchema.index({ meeting: 1, status: 1 });
meetingOwnershipTransferSchema.index({ status: 1, expiresAt: 1 });

const MeetingOwnershipTransfer = mongoose.model(
  "MeetingOwnershipTransfer",
  meetingOwnershipTransferSchema,
);
export default MeetingOwnershipTransfer;
