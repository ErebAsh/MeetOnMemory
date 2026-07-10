import mongoose from "mongoose";

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    owner: { type: String, default: "Unassigned" },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "superseded"],
      default: "open",
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    dueDate: { type: Date, default: null },
    embedding: { type: [Number], default: [] },
    relatesTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "ActionItem" }],
    resolvedAt: { type: Date, default: null },
    resolvedInMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
  },
  { timestamps: true },
);

const ActionItem =
  mongoose.models.ActionItem || mongoose.model("ActionItem", actionItemSchema);
export default ActionItem;
