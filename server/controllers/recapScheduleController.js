import mongoose from "mongoose";
import RecapSchedule from "../models/recapScheduleModel.js";
import RecapDelivery from "../models/recapDeliveryModel.js";
import User from "../models/userModel.js";
import Membership from "../models/membershipModel.js";
import { recapDeliveryQueue } from "../services/queueService.js";
import { isSafeWebhookUrl } from "../utils/webhookUrlSafety.js";
import { z } from "zod";

const scheduleSchema = z.object({
  scheduleType: z.enum(["immediate", "daily", "weekly"]),
  deliveryChannel: z.enum(["email", "webhook", "in_app"]).optional(),
  webhookUrl: z
    .union([
      z.string().max(2048, "Webhook URL cannot exceed 2048 characters"),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  preferredTime: z
    .string()
    .max(10, "Preferred time cannot exceed 10 characters")
    .optional(),
  timezone: z
    .string()
    .max(50, "Timezone cannot exceed 50 characters")
    .optional(),
});

/**
 * Server-resolved org from requireOrganizationParamMatch, with membership fallback.
 * Never use req.params.organizationId for queries (Issue #1381).
 */
const resolveAuthorizedOrganizationId = (req) =>
  req.authorizedOrganizationId ||
  (req.user?.organization?._id || req.user?.organization)?.toString();

const validateChannelConfig = async (parsedData) => {
  const channel = parsedData.deliveryChannel || "in_app";
  const webhookUrl = (parsedData.webhookUrl || "").trim();

  if (channel === "webhook") {
    if (!webhookUrl) {
      return "Webhook URL is required when delivery channel is webhook.";
    }
    const safe = await isSafeWebhookUrl(webhookUrl);
    if (!safe) {
      return "Webhook URL is invalid or not allowed (use a public https destination).";
    }
  }

  return null;
};

export const upsertSchedule = async (req, res) => {
  try {
    const organizationId = resolveAuthorizedOrganizationId(req);
    const userId = req.user._id;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Organization membership required",
      });
    }

    const parsedData = scheduleSchema.parse(req.body);
    const channelError = await validateChannelConfig(parsedData);
    if (channelError) {
      return res.status(400).json({ error: channelError });
    }

    if (parsedData.deliveryChannel !== "webhook") {
      parsedData.webhookUrl = null;
    } else if (typeof parsedData.webhookUrl === "string") {
      parsedData.webhookUrl = parsedData.webhookUrl.trim();
    }

    const schedule = await RecapSchedule.findOneAndUpdate(
      { organizationId, userId },
      { ...parsedData, organizationId, userId },
      { new: true, upsert: true },
    );

    res.status(200).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("[recapScheduleController.upsertSchedule] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSchedule = async (req, res) => {
  try {
    const organizationId = resolveAuthorizedOrganizationId(req);
    const userId = req.user._id;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Organization membership required",
      });
    }

    const schedule = await RecapSchedule.findOne({ organizationId, userId });
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.status(200).json(schedule);
  } catch (error) {
    console.error("[recapScheduleController.getSchedule] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDeliveryHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = resolveAuthorizedOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Organization membership required",
      });
    }

    const deliveries = await RecapDelivery.find({ userId })
      .populate({
        path: "meetingId",
        select: "title date organization",
        match: { organization: organizationId },
      })
      .sort({ deliveredAt: -1 })
      .limit(50);

    const scoped = (deliveries || []).filter((d) => d.meetingId != null);

    res.status(200).json(scoped);
  } catch (error) {
    console.error("[recapScheduleController.getDeliveryHistory] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Failed delivery triage list (Issue #2069).
 */
export const getFailedDeliveries = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = resolveAuthorizedOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Organization membership required",
      });
    }

    const deliveries = await RecapDelivery.find({ userId, status: "failed" })
      .populate({
        path: "meetingId",
        select: "title date organization",
        match: { organization: organizationId },
      })
      .sort({ updatedAt: -1 })
      .limit(50);

    const scoped = (deliveries || []).filter((d) => d.meetingId != null);
    res.status(200).json(scoped);
  } catch (error) {
    console.error(
      "[recapScheduleController.getFailedDeliveries] Error:",
      error,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Dry-run preview of who would receive a recap and via which channel (#2069).
 */
export const dryRunDelivery = async (req, res) => {
  try {
    const organizationId = resolveAuthorizedOrganizationId(req);
    const userId = req.user._id;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Organization membership required",
      });
    }

    const schedule = (await RecapSchedule.findOne({
      organizationId,
      userId,
    }).lean()) || {
      scheduleType: "immediate",
      deliveryChannel: "email",
      webhookUrl: null,
    };

    // Prefer unsaved form values from the request body when present (#2069).
    const channel =
      req.body?.deliveryChannel || schedule.deliveryChannel || "email";
    const webhookUrl =
      req.body?.webhookUrl !== undefined
        ? req.body.webhookUrl
        : schedule.webhookUrl;
    const warnings = [];

    if (channel === "webhook" && !(webhookUrl || "").trim()) {
      warnings.push(
        "Webhook channel is selected but no webhook URL is configured — deliveries would fail.",
      );
    }

    const memberships = await Membership.find({
      organization: organizationId,
      status: "active",
    })
      .select("user role")
      .populate("user", "name email")
      .limit(100)
      .lean();

    let members = memberships
      .map((m) => m.user)
      .filter(Boolean)
      .map((u) => ({
        userId: u._id,
        name: u.name || "Member",
        email: u.email || null,
      }));

    // Fallback when Membership rows are sparse — still preview the caller.
    if (members.length === 0) {
      const self = await User.findById(userId).select("name email").lean();
      if (self) {
        members = [
          {
            userId: self._id,
            name: self.name || "You",
            email: self.email || null,
          },
        ];
      }
    }

    const recipients = members.map((member) => {
      let wouldReceive = true;
      let detail = "";

      if (channel === "email") {
        wouldReceive = Boolean(member.email);
        detail = wouldReceive
          ? `Email to ${member.email}`
          : "No email on account — would be skipped";
      } else if (channel === "webhook") {
        wouldReceive = Boolean((webhookUrl || "").trim());
        detail = wouldReceive
          ? `POST to configured webhook`
          : "Webhook URL missing — would fail";
      } else {
        detail = "In-app notification";
      }

      return {
        userId: member.userId,
        name: member.name,
        email: member.email,
        channel,
        wouldReceive,
        detail,
      };
    });

    res.status(200).json({
      scheduleType: schedule.scheduleType || "immediate",
      channel,
      webhookConfigured: Boolean((webhookUrl || "").trim()),
      warnings,
      recipientCount: recipients.filter((r) => r.wouldReceive).length,
      recipients,
    });
  } catch (error) {
    console.error("[recapScheduleController.dryRunDelivery] Error:", error);
    res.status(500).json({
      error: "Failed to build dry-run preview. Please try again.",
    });
  }
};

export const retryDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user._id;
    const organizationId = resolveAuthorizedOrganizationId(req);

    if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
      return res.status(400).json({ error: "Invalid delivery ID format" });
    }

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Organization membership required",
      });
    }

    const delivery = await RecapDelivery.findOne({
      _id: deliveryId,
      userId,
    }).populate("meetingId", "organization title");

    if (!delivery) {
      return res.status(404).json({
        error: "Delivery not found. It may have been removed or is not yours.",
      });
    }

    const meetingOrg = (
      delivery.meetingId?.organization?._id || delivery.meetingId?.organization
    )?.toString?.();

    if (meetingOrg && meetingOrg !== organizationId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cross-organization access denied",
      });
    }

    if (!delivery.meetingId) {
      return res.status(400).json({
        error:
          "Cannot retry: meeting is missing. Re-process the meeting and try again.",
      });
    }

    delivery.status = "pending";
    delivery.errorMessage = null;
    if (typeof delivery.save === "function") {
      await delivery.save();
    }

    if (recapDeliveryQueue.isActive) {
      await recapDeliveryQueue.add("retry-delivery", {
        deliveryId: delivery._id,
        meetingId: delivery.meetingId?._id || delivery.meetingId,
        userId: delivery.userId,
      });
    } else {
      console.log(`[Mock] Retrying delivery for ${deliveryId}`);
    }

    res.status(200).json({
      message: "Delivery retry enqueued successfully",
      deliveryId: String(delivery._id),
      status: "pending",
    });
  } catch (error) {
    console.error("[recapScheduleController.retryDelivery] Error:", error);
    res.status(500).json({
      error:
        error?.message ||
        "Internal server error while enqueueing retry. Check queue/Redis and try again.",
    });
  }
};
