import notificationModel from "../models/notificationModel.js";

/**
 * Creates a notification in the database and pushes it to the user in real-time via Socket.IO
 *
 * @param {object} io - The Socket.IO server instance
 * @param {string} userId - The ID of the user to notify
 * @param {string} title - Notification title
 * @param {string} description - Notification description
 * @param {string} category - Category (e.g., "meetings", "organizations", "system", "ai_processing")
 * @param {string} actionUrl - URL to navigate to when clicked (optional)
 * @param {string} actionLabel - Label for the action button (optional)
 * @param {object} metadata - Additional metadata (optional)
 */
export const createAndPushNotification = async (
  io,
  userId,
  title,
  description,
  category = "system",
  actionUrl = "",
  actionLabel = "",
  metadata = {},
) => {
  try {
    // 1. Create notification in database
    const notification = await notificationModel.create({
      user: userId,
      title,
      description,
      category,
      actionUrl,
      actionLabel,
      metadata,
    });

    // 2. Format the response object (similar to how notificationController does)
    const formattedNotification = {
      id: notification._id,
      title: notification.title,
      description: notification.description,
      category: notification.category,
      isRead: notification.isRead,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };

    // 3. Emit via Socket.IO if io instance is provided
    if (io) {
      console.log(
        `📣 Pushing notification to room: ${userId.toString()} - Title: "${title}"`,
      );
      io.to(userId.toString()).emit("notification:new", formattedNotification);
    } else {
      console.warn(
        "⚠️ createAndPushNotification: io instance is missing or not provided.",
      );
    }

    return formattedNotification;
  } catch (error) {
    console.error("Error creating and pushing notification:", error);
    // Don't throw the error, just return null so it doesn't break the main flow (e.g., meeting creation)
    return null;
  }
};
