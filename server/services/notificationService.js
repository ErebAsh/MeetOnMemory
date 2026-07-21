import notificationModel from "../models/notificationModel.js";

/**
 * Creates a notification in the database
 *
 * @param {string} userId - The ID of the user to notify
 * @param {string} title - Notification title
 * @param {string} description - Notification description
 * @param {string} category - Category (e.g., "meetings", "organizations", "system", "ai_processing")
 * @param {string} actionUrl - URL to navigate to when clicked (optional)
 * @param {string} actionLabel - Label for the action button (optional)
 * @param {object} metadata - Additional metadata (optional)
 */
export const createNotification = async (
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

    return formattedNotification;
  } catch (error) {
    console.error("Error creating and pushing notification:", error);
    // Don't throw the error, just return null so it doesn't break the main flow (e.g., meeting creation)
    return null;
  }
};
