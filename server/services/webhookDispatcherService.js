import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import crypto from "crypto";
import axios from "axios";
import Webhook from "../models/Webhook.js";
import eventBus from "./eventBus.js";

const redisUri = process.env.REDIS_URI;

// Initialize Redis connection for BullMQ if configured
const connection = redisUri
  ? new Redis(redisUri, {
      maxRetriesPerRequest: null,
      family: 0,
    })
  : null;

if (connection) {
  connection.on("error", (err) => {
    console.error("⚠️ Webhook Redis Connection Error:", err.message);
  });
}

// Initialize BullMQ Queue
export const webhookQueue = connection
  ? new Queue("webhook-dispatches", { connection })
  : null;

/**
 * Signs the payload using HMAC SHA-256 with the webhook's secret.
 * @param {object} payload - Webhook payload object
 * @param {string} secret - Webhook secret key
 * @returns {string} Hex signature
 */
const generateSignature = (payload, secret) => {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
};

/**
 * Core dispatch function. Sends signed POST request to client url.
 * @param {string} webhookId - MongoDB Webhook Subscription ID
 * @param {object} payload - Payload object containing event details
 * @returns {Promise<void>}
 */
export const performDispatch = async (webhookId, payload) => {
  const webhook = await Webhook.findById(webhookId).select("+secret");
  if (!webhook || !webhook.isActive) {
    console.log(`⚠️ Webhook subscription ${webhookId} not found or inactive. Skipping.`);
    return;
  }

  const signature = generateSignature(payload, webhook.secret);

  try {
    console.log(`📡 Sending webhook event '${payload.event}' to ${webhook.targetUrl}...`);
    const response = await axios.post(webhook.targetUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-meetonmemory-signature": signature,
      },
      timeout: 10000, // 10 second timeout
    });

    console.log(`✅ Webhook event '${payload.event}' successfully sent to ${webhook.targetUrl}. Status: ${response.status}`);
  } catch (error) {
    const errorMsg = error.response
      ? `Status Code: ${error.response.status}`
      : error.message;
    console.error(`❌ Webhook dispatch failed for ${webhook.targetUrl}: ${errorMsg}`);
    
    // Throwing error allows BullMQ to retry the job
    throw new Error(`Webhook dispatch failed: ${errorMsg}`);
  }
};

/**
 * Dispatches the event payload to all active webhooks subscribed to this event in the organization.
 * @param {string} organizationId - Target organization ID
 * @param {string} event - Event name (e.g. 'meeting.created')
 * @param {object} data - Event data payload
 */
export const dispatchWebhookEvent = async (organizationId, event, data) => {
  if (!organizationId) {
    return;
  }

  try {
    // Find active webhooks for this organization that subscribe to this specific event
    const webhooks = await Webhook.find({
      organizationId,
      events: event,
      isActive: true,
    });

    if (webhooks.length === 0) {
      return;
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const webhook of webhooks) {
      if (webhookQueue) {
        // Add to BullMQ with exponential backoff retries for reliability
        await webhookQueue.add(
          "dispatch-webhook",
          { webhookId: webhook._id, payload },
          {
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 2000, // 2s initial delay
            },
          }
        );
      } else {
        // Fallback: Synchronous dispatch in local/dev environment without Redis
        performDispatch(webhook._id, payload).catch((err) => {
          console.error("⚠️ Local webhook dispatch sync fallback failed:", err.message);
        });
      }
    }
  } catch (err) {
    console.error("⚠️ Failed to queue webhook dispatches:", err.message);
  }
};

/**
 * Initializes the Webhook worker listening on the dispatch queue.
 */
export const initWebhookWorker = () => {
  if (!connection) {
    console.warn("⚠️ Redis not configured. Webhook background worker will not start (falling back to sync dispatch).");
    return;
  }

  const worker = new Worker(
    "webhook-dispatches",
    async (job) => {
      const { webhookId, payload } = job.data;
      await performDispatch(webhookId, payload);
    },
    { connection, concurrency: 10 }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Webhook job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Webhook job ${job.id} failed after retries:`, err.message);
  });

  console.log("✅ Webhook Worker initialized and listening to webhook-dispatches queue");
};

// ─────────────────────────────────────────────────────────────
// 📡 Register internal event bus listeners to fire webhooks
// ─────────────────────────────────────────────────────────────

eventBus.on("meeting.created", (meeting) => {
  const orgId = meeting.organization;
  if (!orgId) return;

  const data = {
    meetingId: meeting._id,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date,
    meetingType: meeting.meetingType,
    organizationId: orgId,
  };

  dispatchWebhookEvent(orgId, "meeting.created", data);
});

eventBus.on("mom.generated", (meeting) => {
  const orgId = meeting.organization;
  if (!orgId) return;

  const data = {
    meetingId: meeting._id,
    title: meeting.title,
    summary: meeting.summary,
    structuredMoM: meeting.structuredMoM,
    organizationId: orgId,
  };

  dispatchWebhookEvent(orgId, "mom.generated", data);
});

eventBus.on("policy.updated", (policy) => {
  const orgId = policy.organization;
  if (!orgId) return;

  const data = {
    policyId: policy._id,
    name: policy.name,
    version: policy.version,
    summary: policy.summary,
    key_changes: policy.key_changes,
    keywords: policy.keywords,
    organizationId: orgId,
  };

  dispatchWebhookEvent(orgId, "policy.updated", data);
});
