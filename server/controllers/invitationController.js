// server/controllers/invitationController.js
//
// HTTP layer only — parse request, call service, send response.
// All business logic lives in server/services/InvitationService.js.

import * as InvitationService from "../services/InvitationService.js";

/**
 * ✅ Create Invitation
 * POST /api/invitations
 */
export const createInvitation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.createInvitation(
      req.user.id,
      req.body,
      {
        origin: req.headers.origin,
        inviterName: req.user.name,
      },
    );

    res.status(201).json(result);
  } catch (error) {
    console.error("❌ Error creating invitation:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Duplicate invitation not allowed." });
    }
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Get Organization Invitations
 * GET /api/invitations/organization/:organizationId
 */
export const getOrganizationInvitations = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.getOrganizationInvitations(
      req.user.id,
      req.params.organizationId,
      req.query.status,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error fetching invitations:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Get User's Invitations
 * GET /api/invitations/user
 */
export const getUserInvitations = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.getUserInvitations(req.user.id);

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error fetching user invitations:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Accept Invitation
 * POST /api/invitations/:token/accept
 */
export const acceptInvitation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.acceptInvitation(
      req.user.id,
      req.params.token,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error accepting invitation:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Reject Invitation
 * POST /api/invitations/:token/reject
 */
export const rejectInvitation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.rejectInvitation(
      req.user.id,
      req.params.token,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error rejecting invitation:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Revoke Invitation
 * DELETE /api/invitations/:id
 */
export const revokeInvitation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.revokeInvitation(
      req.user.id,
      req.params.id,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error revoking invitation:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Get Invitation by Token
 * GET /api/invitations/:token
 */
export const getInvitationByToken = async (req, res) => {
  try {
    const result = await InvitationService.getInvitationByToken(
      req.params.token,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error fetching invitation:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Resend Invitation
 * POST /api/invitations/:id/resend
 */
export const resendInvitation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.resendInvitation(
      req.user.id,
      req.params.id,
      {
        origin: req.headers.origin,
        inviterName: req.user.name,
      },
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error resending invitation:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * ✅ Expire Invitation Manually
 * POST /api/invitations/:id/expire
 */
export const expireInvitation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const result = await InvitationService.expireInvitation(
      req.user.id,
      req.params.id,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error expiring invitation:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message || "Server error" });
  }
};
