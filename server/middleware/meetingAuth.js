import Meeting from "../models/meetingModel.js";

/**
 * @desc Middleware to verify the authenticated user has access to a specific meeting.
 */
export const verifyMeetingAccess = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }

    // Owner/creator access check
    const isOwner =
      Boolean(meeting.uploadedBy) &&
      Boolean(req.user?._id) &&
      meeting.uploadedBy.toString() === req.user._id.toString();

    // Verify organization ownership match - fail closed if organization information is missing
    const meetingOrgId = meeting.organization;
    const userOrgId = req.user?.organization;

    const isSameOrg = Boolean(
      meetingOrgId &&
      userOrgId &&
      meetingOrgId.toString() === userOrgId.toString(),
    );

    if (!isOwner && !isSameOrg) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to meeting" });
    }

    req.meeting = meeting;
    next();
  } catch (_err) {
    res
      .status(500)
      .json({ success: false, error: "Server error during authorization" });
  }
};

/**
 * @desc Middleware to verify the authenticated user has access to a specific action item.
 */
export const verifyActionItemAccess = async (req, res, next) => {
  try {
    const ActionItem = (await import("../models/actionItemModel.js")).default;
    const item = await ActionItem.findById(req.params.id).populate(
      "sourceMeetingId",
    );

    if (!item)
      return res
        .status(404)
        .json({ success: false, error: "Action item not found" });

    const meeting = item.sourceMeetingId;
    const isOwner =
      Boolean(meeting?.uploadedBy) &&
      Boolean(req.user?._id) &&
      meeting.uploadedBy.toString() === req.user._id.toString();

    const meetingOrgId =
      meeting?.organization?._id ||
      meeting?.organization ||
      item.organization?._id ||
      item.organization;
    const userOrgId = req.user?.organization?._id || req.user?.organization;

    const isSameOrg = Boolean(
      meetingOrgId &&
      userOrgId &&
      meetingOrgId.toString() === userOrgId.toString(),
    );

    if (!isOwner && !isSameOrg) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to action item" });
    }

    req.actionItem = item;
    next();
  } catch (err) {
    console.error("Error in verifyActionItemAccess:", err);
    res
      .status(500)
      .json({ success: false, error: "Server error during authorization" });
  }
};
