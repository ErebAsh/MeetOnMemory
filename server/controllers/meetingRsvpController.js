import {
  initializeRsvps,
  updateRsvpStatus,
  getPendingRsvpsForUser,
  getMeetingRsvpSummary,
  getAllRsvpsForUser,
} from "../services/meetingRsvpService.js";
import { resolveAccessibleMeeting } from "../utils/resolveAccessibleMeeting.js";
import MeetingRsvp from "../models/meetingRsvpModel.js";

/**
 * Send RSVP requests to participants
 */
export const sendRsvpRequests = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userIds } = req.body;
    const userId = req.user.id || req.user._id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "user_ids_required",
      });
    }

    // Verify meeting access and retrieve meeting document
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res.status(access.error.status).json({
        success: false,
        message: access.error.message,
      });
    }

    const meeting = access.meeting;

    // Only organizer or admin can send RSVPs
    const isOrganizer = meeting.uploadedBy?.toString() === userId.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "owner";

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "only_organizer_can_send_rsvps",
      });
    }

    const rsvps = await initializeRsvps(meetingId, userIds);

    res.status(200).json({
      success: true,
      data: rsvps,
    });
  } catch (error) {
    console.error("Error sending RSVP requests:", error);
    res.status(500).json({ success: false, message: "server_error" });
  }
};

/**
 * Respond to an RSVP request
 */
export const respondToRsvp = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id || req.user._id;
    const { status, declineReason, availabilityNote } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status_required",
      });
    }

    // 1. Verify meeting access and retrieve meeting document
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res.status(access.error.status).json({
        success: false,
        message: access.error.message,
      });
    }

    const meeting = access.meeting;

    // 2. Verify authorization to RSVP (must be owner, admin, listed participant, or have an existing RSVP, or access to meeting org)
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "owner";
    const isParticipant = meeting.participants?.some(
      (p) =>
        p.user?.toString() === userId.toString() ||
        (p.email &&
          req.user.email &&
          p.email.toLowerCase() === req.user.email.toLowerCase()),
    );

    const hasExistingRsvp = await MeetingRsvp.findOne({ meetingId, userId });

    if (!isOwner && !isAdmin && !isParticipant && !hasExistingRsvp) {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden: You are not invited or authorized to RSVP for this meeting",
      });
    }

    // 3. Enforce capacity limit when accepting
    if (status === "accepted" && meeting.maxParticipants) {
      const acceptedCount = (meeting.participants || []).filter(
        (p) =>
          p.rsvpStatus === "accepted" &&
          p.user?.toString() !== userId.toString(),
      ).length;

      if (acceptedCount >= meeting.maxParticipants) {
        return res.status(409).json({
          success: false,
          message:
            "Meeting has reached maximum capacity. You can join the waitlist instead.",
          isFull: true,
        });
      }
    }

    // 4. Perform upsert
    const updatedRsvp = await updateRsvpStatus(meetingId, userId, {
      status,
      declineReason,
      availabilityNote,
    });

    res.status(200).json({
      success: true,
      data: updatedRsvp,
    });
  } catch (error) {
    console.error("Error responding to RSVP:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "server_error" });
  }
};

/**
 * Get pending RSVPs for the logged-in user
 */
export const getPendingRsvps = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const rsvps = await getPendingRsvpsForUser(userId);

    res.status(200).json({
      success: true,
      data: rsvps,
    });
  } catch (error) {
    console.error("Error getting pending RSVPs:", error);
    res.status(500).json({ success: false, message: "server_error" });
  }
};

/**
 * Get all RSVPs (pending and past) for the logged-in user
 */
export const getAllRsvps = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const rsvps = await getAllRsvpsForUser(userId);

    res.status(200).json(rsvps);
  } catch (error) {
    console.error("Error getting all RSVPs:", error);
    res.status(500).json({ success: false, message: "server_error" });
  }
};

/**
 * Get the RSVP summary for a specific meeting
 */
export const getMeetingSummary = async (req, res) => {
  try {
    const { meetingId } = req.params;

    // Verify meeting access before returning summary
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res.status(access.error.status).json({
        success: false,
        message: access.error.message,
      });
    }

    const summary = await getMeetingRsvpSummary(meetingId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error getting RSVP summary:", error);
    res.status(500).json({ success: false, message: "server_error" });
  }
};
