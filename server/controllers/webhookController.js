import mongoose from "mongoose";
import { URL } from "url";
import { z } from "zod";
import Webhook from "../models/Webhook.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";

import dns from "dns/promises";
import ipaddr from "ipaddr.js";

const isSafeWebhookUrl = async (urlStr) => {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Block obvious localhosts immediately
    if (hostname === "localhost" || hostname === "localhost.localdomain") {
      return false;
    }

    // Resolve the hostname to an IP address
    let resolvedIp;
    try {
      // dns.lookup checks /etc/hosts and DNS, returning the IP
      const { address } = await dns.lookup(hostname);
      resolvedIp = address;
    } catch (err) {
      // If we can't resolve it, it's not a valid safe public URL
      return false;
    }

    // Parse the resolved IP using ipaddr.js
    let addr;
    try {
      addr = ipaddr.parse(resolvedIp);
    } catch (err) {
      return false;
    }

    // Check if the address is in a private, loopback, link-local, or otherwise restricted range
    const range = addr.range();

    // ipaddr.js classifies public addresses as 'unicast'
    // Private ranges are classified as 'private', 'loopback', 'linkLocal', etc.
    if (range !== "unicast") {
      return false;
    }

    // Explicitly block known IPv4 mapped IPv6 loopbacks just in case
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
      const v4addr = addr.toIPv4Address();
      if (v4addr.range() !== "unicast") {
        return false;
      }
    }

    return true;
  } catch (err) {
    return false;
  }
};

// Helper to verify user permissions (must be Owner or Admin of the target Organization)
const hasAdminPermission = async (userId, organizationId) => {
  if (!organizationId) return false;

  try {
    const org = await Organization.findById(organizationId);
    if (!org) return false;

    // Check if user is the direct owner of the organization
    if (org.owner.toString() === userId.toString()) {
      return true;
    }

    // Check if user has an active admin membership role
    const membership = await Membership.findOne({
      user: userId,
      organization: organizationId,
      role: "admin",
      status: "active",
    }).lean();

    return !!membership;
  } catch (err) {
    console.error("Error checking permissions:", err);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════
// Zod schemas for payload validation
// ═══════════════════════════════════════════════════════════════

const createWebhookSchema = z.object({
  targetUrl: z
    .string({ required_error: "Target URL is required." })
    .trim()
    .min(1, "Target URL cannot be empty.")
    .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
      message: "Target URL must start with http:// or https://.",
    })
    .refine((url) => isSafeWebhookUrl(url), {
      message:
        "Target URL must be a public, safe address. Local/private addresses are not permitted.",
    }),
  events: z
    .array(z.enum(["meeting.created", "mom.generated", "policy.updated"]), {
      required_error: "At least one event trigger must be specified.",
    })
    .min(1, "At least one event trigger must be specified."),
  secret: z.string().trim().optional(),
  organizationId: z
    .string({ required_error: "Valid Organization ID is required." })
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Valid Organization ID is required.",
    }),
});

const updateWebhookSchema = z.object({
  targetUrl: z
    .string()
    .trim()
    .min(1, "Target URL cannot be empty.")
    .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
      message: "Target URL must start with http:// or https://.",
    })
    .refine((url) => isSafeWebhookUrl(url), {
      message:
        "Target URL must be a public, safe address. Local/private addresses are not permitted.",
    })
    .optional(),
  events: z
    .array(z.enum(["meeting.created", "mom.generated", "policy.updated"]))
    .min(1, "At least one event trigger must be specified.")
    .optional(),
  secret: z.string().trim().min(1, "Secret key cannot be empty.").optional(),
  isActive: z.boolean().optional(),
});

// Helper to get authenticated user ID
const getUserId = (req) => {
  const id = req.user?.id || req.user?._id;
  if (!id) throw new UnauthorizedError();
  return id.toString();
};

/**
 * 🟢 Register a new Webhook subscription
 * POST /api/webhooks
 */
export const createWebhook = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    let validated;
    try {
      validated = createWebhookSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      validated.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can configure webhooks.",
      );
    }

    const webhookData = {
      organizationId: validated.organizationId,
      targetUrl: validated.targetUrl,
      events: validated.events,
      isActive: true,
    };

    if (validated.secret) {
      webhookData.secret = validated.secret;
    }

    const webhook = await Webhook.create(webhookData);

    return res.status(201).json({
      success: true,
      message: "Webhook registered successfully.",
      webhook: {
        _id: webhook._id,
        organizationId: webhook.organizationId,
        targetUrl: webhook.targetUrl,
        events: webhook.events,
        secret: webhook.secret,
        isActive: webhook.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 🟢 Get webhook subscriptions for an organization
 * GET /api/webhooks?organizationId=xxx
 */
export const getWebhooks = async (req, res, next) => {
  try {
    const { organizationId } = req.query;
    const userId = getUserId(req);

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      throw new ValidationError("Valid Organization ID is required.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(userId, organizationId);
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can view webhooks.",
      );
    }

    const webhooks = await Webhook.find({ organizationId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ success: true, webhooks });
  } catch (error) {
    next(error);
  }
};

/**
 * 🟢 Update webhook subscription details
 * PATCH /api/webhooks/:id
 */
export const updateWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Valid Webhook ID is required.");
    }

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      throw new NotFoundError("Webhook subscription not found.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      webhook.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can modify webhooks.",
      );
    }

    let validated;
    try {
      validated = updateWebhookSchema.parse(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    if (validated.targetUrl !== undefined) {
      webhook.targetUrl = validated.targetUrl;
    }
    if (validated.events !== undefined) {
      webhook.events = validated.events;
    }
    if (validated.secret !== undefined) {
      webhook.secret = validated.secret;
    }
    if (validated.isActive !== undefined) {
      webhook.isActive = validated.isActive;
    }

    await webhook.save();

    return res.status(200).json({
      success: true,
      message: "Webhook updated successfully.",
      webhook,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 🟢 Delete webhook subscription
 * DELETE /api/webhooks/:id
 */
export const deleteWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Valid Webhook ID is required.");
    }

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      throw new NotFoundError("Webhook subscription not found.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      webhook.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can delete webhooks.",
      );
    }

    await webhook.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Webhook deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
