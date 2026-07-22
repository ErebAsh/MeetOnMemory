import mongoose from "mongoose";

const transcriptSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    status: {
      type: String,
      enum: ["recording", "processing", "completed", "failed"],
      default: "recording",
    },
    language: {
      type: String,
      default: "en",
    },
    fullText: {
      type: String,
      default: "",
    },
    segments: [
      {
        speaker: { type: String, default: "Unknown" },
        text: { type: String, required: true },
        startTime: { type: Number, required: true },
        endTime: { type: Number, required: true },
        confidence: { type: Number, default: 1.0 },
      },
    ],
    timestamps: {
      recordingStartedAt: { type: Date, default: null },
      recordingEndedAt: { type: Date, default: null },
      processingStartedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes for query performance
transcriptSchema.index({ meetingId: 1 });
transcriptSchema.index({ organizationId: 1 });
transcriptSchema.index({ status: 1 });
transcriptSchema.index({ createdAt: -1 });

const Transcript = mongoose.model("Transcript", transcriptSchema);
export default Transcript;
