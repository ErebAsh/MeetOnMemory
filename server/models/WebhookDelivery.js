import mongoose from "mongoose";

const webhookDeliverySchema = new mongoose.Schema(
  {
    webhookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Webhook",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    responseStatus: {
      type: Number,
      default: null,
    },
    responseHeaders: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    responseBody: {
      type: String,
      default: null,
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
    attempt: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["success", "failed", "dlq"],
      required: true,
      index: true,
    },
    errorReason: {
      type: String,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Composite index for fast pagination of deliveries by webhook
webhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });
webhookDeliverySchema.index({ organizationId: 1, createdAt: -1 });

const WebhookDelivery =
  mongoose.models.WebhookDelivery ||
  mongoose.model("WebhookDelivery", webhookDeliverySchema);

export default WebhookDelivery;
