// server/controllers/notificationController.js
import notificationModel from "../models/notificationModel.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";

// Helper to format notification response
const formatNotificationResponse = (notification) => {
  return {
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
};

// @desc    Get all notifications for a user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    const { category, status } = req.query;

    let query = notificationModel.find({ user: req.user.id });

    if (category === "meetings") {
      query = query.where("category").equals("meetings");
    } else if (category === "ai_processing") {
      query = query.where("category").equals("ai_processing");
    } else if (category === "organizations") {
      query = query.where("category").equals("organizations");
    } else if (category === "policies") {
      query = query.where("category").equals("policies");
    } else if (category === "reports") {
      query = query.where("category").equals("reports");
    } else if (category === "system") {
      query = query.where("category").equals("system");
    }

    if (status === "unread") {
      query = query.where("isRead").equals(false);
    } else if (status === "read") {
      query = query.where("isRead").equals(true);
    }

    const notifications = await query.sort({ createdAt: -1 }).limit(100);

    const unreadCount = await notificationModel.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      notifications: notifications.map(formatNotificationResponse),
      unreadCount,
    });
  } catch (error) {
    console.error("Error in getNotifications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    const notification = await notificationModel.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification: formatNotificationResponse(notification),
    });
  } catch (error) {
    console.error("Error in markAsRead:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/mark-all-read
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    const result = await notificationModel.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true },
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in markAllAsRead:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    const notification = await notificationModel.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Error in deleteNotification:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    const unreadCount = await notificationModel.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get notification preferences for a user
// @route   GET /api/notifications/preferences
// @access  Private
export const getPreferences = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    let preferences = await NotificationPreference.findOne({
      user: req.user.id,
    });

    if (!preferences) {
      preferences = await NotificationPreference.create({
        user: req.user.id,
      });
    }

    res.status(200).json({ success: true, preferences });
  } catch (error) {
    console.error("Error in getPreferences:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
export const updatePreferences = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    const allowedFields = [
      "emailMeetingReminders",
      "emailTaskAssignments",
      "emailWeeklyDigest",
      "pushMeetingReminders",
      "pushTaskAssignments",
      "pushAiProcessingComplete",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (typeof req.body[field] === "boolean") {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid preference fields provided.",
      });
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { user: req.user.id },
      { $set: updates },
      { new: true, upsert: true },
    );

    res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      preferences,
    });
  } catch (error) {
    console.error("Error in updatePreferences:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
