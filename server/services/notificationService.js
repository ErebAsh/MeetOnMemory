import notificationModel from "../models/notificationModel.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";
import QueuedNotification from "../models/queuedNotificationModel.js";
import EmailService from "./EmailService.js";
import { sendSlackNotification } from "./slackService.js";
import User from "../models/userModel.js";

// ─────────────────────────────────────────────────────────────────────────────
// Notification Service
//
// Supports:
// 1. Category suppression preferences (pushMeetingReminders, pushTaskAssignments, etc.)
// 2. Per-meeting mute lists (mutedMeetingIds)
// 3. Channel routing (Slack, Email, InApp)
// 4. Batch threshold queuing and digest delivery for batchable alerts (SLAs, comments)
// 5. Bulk insert with single find + insertMany for scale
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY_TO_PREFERENCE = Object.freeze({
  meetings: "pushMeetingReminders",
  tasks: "pushTaskAssignments",
  ai_processing: "pushAiProcessingComplete",
  organizations: "pushOrganizationUpdates",
  policies: "pushPolicyUpdates",
  reports: "pushReportUpdates",
  comments: null,
  system: null,
});

/**
 * Maps a notification context to a simplified routing category: slaAlerts, comments, or recaps.
 */
export const getRoutingCategory = (category, title, description) => {
  const text =
    `${title || ""} ${description || ""} ${category || ""}`.toLowerCase();
  if (
    text.includes("sla") ||
    text.includes("breach") ||
    text.includes("due") ||
    text.includes("mitigate") ||
    category === "tasks" ||
    category === "policies"
  ) {
    return "slaAlerts";
  }
  if (
    text.includes("comment") ||
    text.includes("reply") ||
    category === "comments"
  ) {
    return "comments";
  }
  return "recaps";
};

/**
 * Validates action URLs, repairing relative links and guaranteeing valid URL structures.
 */
export const validateAndRepairLink = (url) => {
  if (!url) return "";
  let repairedUrl = url;
  if (url.startsWith("/")) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    repairedUrl = `${baseUrl}${url}`;
  }
  try {
    new URL(repairedUrl);
    return repairedUrl;
  } catch {
    return `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard`;
  }
};

/**
 * Loads preferences for many users in one query and returns a lookup keyed by user id.
 */
const loadPreferences = async (userIds) => {
  const map = new Map();
  if (!userIds.length) return map;

  try {
    const docs = await NotificationPreference.find({
      user: { $in: userIds },
    }).lean();

    for (const doc of docs) {
      map.set(String(doc.user), doc);
    }
  } catch (error) {
    console.error(
      "⚠️ Failed to load notification preferences; delivering with defaults:",
      error.message,
    );
  }

  return map;
};

/**
 * Decides whether a category is suppressed for a given preference document.
 */
export const isSuppressed = (prefs, category) => {
  const field = CATEGORY_TO_PREFERENCE[category];
  if (!field) return false;
  if (!prefs) return false;
  return prefs[field] === false;
};

/**
 * True when the user has muted in-app notifications for this meeting (Issue #2064).
 */
export const isMeetingMuted = (prefs, metadata = {}) => {
  if (!prefs?.mutedMeetingIds?.length) return false;
  const meetingId = metadata?.meetingId;
  if (!meetingId) return false;
  const target = String(meetingId);
  return prefs.mutedMeetingIds.some((id) => String(id) === target);
};

/**
 * Formats a notification document for API/socket responses.
 */
export const formatNotification = (notification) => ({
  id: notification._id,
  user: notification.user,
  title: notification.title,
  description: notification.description,
  category: notification.category,
  isRead: notification.isRead,
  actionUrl: notification.actionUrl,
  actionLabel: notification.actionLabel,
  metadata: notification.metadata,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

/**
 * Creates notifications for multiple recipients.
 */
export const createNotifications = async (recipients, payload) => {
  const {
    title,
    description,
    category = "system",
    actionUrl = "",
    actionLabel = "",
    metadata = {},
    forceImmediate = false,
  } = payload ?? {};

  if (!Array.isArray(recipients) || recipients.length === 0) return [];
  if (!title || !description) {
    console.warn(
      "⚠️ createNotifications: title and description are required — skipping.",
    );
    return [];
  }

  const uniqueIds = [
    ...new Set(recipients.filter(Boolean).map((id) => String(id))),
  ];
  if (uniqueIds.length === 0) return [];

  try {
    const prefsByUser = await loadPreferences(uniqueIds);

    const deliverToImmediate = [];
    const queueList = [];
    const usersMap = {};

    try {
      const users = await User.find({ _id: { $in: uniqueIds } }).lean();
      for (const u of users) {
        usersMap[String(u._id)] = u;
      }
    } catch {
      // User model lookup failure shouldn't block notification creation
    }

    for (const userId of uniqueIds) {
      const prefs = prefsByUser.get(userId);

      if (isSuppressed(prefs, category)) continue;
      if (isMeetingMuted(prefs, metadata)) continue;

      const routingCat = getRoutingCategory(category, title, description);
      const routing = prefs?.routingPreferences?.[routingCat] || {
        slack: true,
        email: true,
        inApp: true,
      };

      if (!routing.slack && !routing.email && !routing.inApp) {
        continue;
      }

      const isBatchable =
        routingCat === "slaAlerts" || routingCat === "comments";
      const threshold =
        !forceImmediate && isBatchable && prefs?.batchThresholdMinutes
          ? prefs.batchThresholdMinutes
          : 0;

      if (threshold > 0) {
        const processAfter = new Date(Date.now() + threshold * 60 * 1000);
        queueList.push({
          userId,
          title,
          description,
          category,
          actionUrl: actionUrl || "",
          actionLabel,
          metadata,
          processAfter,
          status: "pending",
        });
      } else {
        if (routing.inApp) {
          deliverToImmediate.push(userId);
        }
        const userObj = usersMap[userId];
        if (routing.email && userObj?.email) {
          EmailService.sendNotificationEmail(
            userObj.email,
            title,
            description,
          ).catch((e) => console.error("Email send error:", e));
        }
        if (routing.slack && userObj?.organization) {
          sendSlackNotification(
            userObj.organization,
            `*${title}*\n${description}`,
          ).catch((e) => console.error("Slack send error:", e));
        }
      }
    }

    if (queueList.length > 0) {
      await QueuedNotification.insertMany(queueList);
    }

    if (deliverToImmediate.length === 0) return [];

    const docs = await notificationModel.insertMany(
      deliverToImmediate.map((user) => ({
        user,
        title,
        description,
        category,
        actionUrl: actionUrl || "",
        actionLabel,
        metadata,
      })),
    );

    return docs.map(formatNotification);
  } catch (error) {
    console.error("Error creating notifications:", error);
    return [];
  }
};

/**
 * Creates a notification for a single recipient.
 */
export const createNotification = async (
  userId,
  title,
  description,
  category = "system",
  actionUrl = "",
  actionLabel = "",
  metadata = {},
  forceImmediate = false,
) => {
  if (!userId) return null;

  const [notification] = await createNotifications([userId], {
    title,
    description,
    category,
    actionUrl,
    actionLabel,
    metadata,
    forceImmediate,
  });

  return notification ?? null;
};

/**
 * Process pending queued notifications, aggregating them into digest summaries.
 */
export const processNotificationQueue = async () => {
  try {
    const now = new Date();
    const pending = await QueuedNotification.find({
      status: "pending",
      processAfter: { $lte: now },
    });

    if (pending.length === 0) return;

    const groups = {};
    for (const item of pending) {
      const routingCat = getRoutingCategory(
        item.category,
        item.title,
        item.description,
      );
      const key = `${item.userId}_${routingCat}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    const processedIds = [];
    const failedIds = [];

    for (const key in groups) {
      const items = groups[key];
      const firstItem = items[0];
      const userId = firstItem.userId;
      const category = firstItem.category;
      const itemIds = items.map((it) => it._id);

      try {
        const user = await User.findById(userId);
        if (!user) {
          failedIds.push(...itemIds);
          continue;
        }

        const prefs = await NotificationPreference.findOne({ user: userId });
        const routingCat = getRoutingCategory(
          category,
          firstItem.title,
          firstItem.description,
        );
        const routing = prefs?.routingPreferences?.[routingCat] || {
          slack: true,
          email: true,
          inApp: true,
        };

        let finalTitle = firstItem.title;
        let finalDescription = firstItem.description;
        let finalActionUrl = firstItem.actionUrl;

        if (items.length > 1) {
          finalTitle = `[Digest] You have ${items.length} new updates in ${
            routingCat === "slaAlerts"
              ? "SLAs"
              : routingCat === "comments"
                ? "Comments"
                : "Recaps"
          }`;
          finalDescription = items
            .map((it, idx) => `${idx + 1}. ${it.title}: ${it.description}`)
            .join("\n");
        }

        if (routing.inApp) {
          const validCategories = new Set([
            "meetings",
            "tasks",
            "ai_processing",
            "organizations",
            "policies",
            "reports",
            "comments",
            "system",
          ]);
          const safeCategory = validCategories.has(category)
            ? category
            : "system";

          await notificationModel.create({
            user: userId,
            title: finalTitle,
            description: finalDescription,
            category: safeCategory,
            actionUrl: finalActionUrl,
            actionLabel: firstItem.actionLabel,
            metadata: firstItem.metadata,
          });
        }

        if (routing.email && user.email) {
          await EmailService.sendNotificationEmail(
            user.email,
            finalTitle,
            finalDescription,
          );
        }

        if (routing.slack && user.organization) {
          await sendSlackNotification(
            user.organization,
            `*${finalTitle}*\n${finalDescription}`,
          );
        }

        processedIds.push(...itemIds);
      } catch (err) {
        console.error(
          `❌ Failed to dispatch notifications for user ${userId}:`,
          err,
        );
        failedIds.push(...itemIds);
      }
    }

    if (processedIds.length > 0 || failedIds.length > 0) {
      const bulkOps = [];
      if (processedIds.length > 0) {
        bulkOps.push({
          updateMany: {
            filter: { _id: { $in: processedIds } },
            update: { $set: { status: "processed" } },
          },
        });
      }
      if (failedIds.length > 0) {
        bulkOps.push({
          updateMany: {
            filter: { _id: { $in: failedIds } },
            update: { $set: { status: "failed" } },
          },
        });
      }
      await QueuedNotification.bulkWrite(bulkOps);
    }
  } catch (error) {
    console.error("❌ Error in processNotificationQueue:", error);
  }
};

/** @deprecated Prefer createNotification. */
export const notifyUser = async (
  userId,
  category,
  description,
  metadata = {},
) =>
  createNotification(userId, category, description, category, "", "", metadata);
