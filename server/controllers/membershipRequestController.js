// server/controllers/membershipRequestController.js
import MembershipRequest from "../models/membershipRequestModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import mongoose from "mongoose";

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Whitelist allowed status values
 */
const allowedStatuses = ["pending", "approved", "rejected", "cancelled"];
const isValidStatus = (status) => allowedStatuses.includes(status);

/**
 * ✅ Create Membership Request
 * POST /api/membership-requests
 */
export const createMembershipRequest = async (req, res) => {
  try {
    const { organizationId, message } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "Organization ID is required." });
    }

    // Validate organizationId
    if (!isValidObjectId(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID." });
    }

    const cleanOrganizationId = new mongoose.Types.ObjectId(String(organizationId));

    const userId = req.user.id;

    // Check if organization exists
    const organization = await Organization.findById(cleanOrganizationId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Check if user already has an active membership
    const existingMembership = await Membership.findOne({
      user: userId,
      organization: cleanOrganizationId,
      status: "active",
    }).lean();

    if (existingMembership) {
      return res
        .status(400)
        .json({ success: false, message: "Already a member of this organization." });
    }

    // Check if there's already a pending request
    const existingRequest = await MembershipRequest.findOne({
      user: userId,
      organization: cleanOrganizationId,
      status: "pending",
    }).lean();

    if (existingRequest) {
      return res
        .status(409)
        .json({ success: false, message: "Pending request already exists." });
    }

    // Create membership request
    const membershipRequest = await MembershipRequest.create({
      user: userId,
      organization: cleanOrganizationId,
      message: message ? String(message).trim().substring(0, 500) : "",
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Membership request created successfully.",
      membershipRequest,
    });
  } catch (error) {
    console.error("❌ Error creating membership request:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Duplicate request not allowed." });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get Membership Requests for Organization
 * GET /api/membership-requests/organization/:organizationId
 */
export const getOrganizationMembershipRequests = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status } = req.query;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // Validate organizationId
    if (!isValidObjectId(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID." });
    }

    const cleanOrganizationId = new mongoose.Types.ObjectId(String(organizationId));

    // Validate status if provided
    const validStatus = status && isValidStatus(status) ? allowedStatuses.find(s => s === status) : null;
    if (status && !validStatus) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value." });
    }

    const organization = await Organization.findById(cleanOrganizationId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: cleanOrganizationId,
      role: "admin",
      status: "active",
    }).lean();

    const isOwner = organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view requests." });
    }

    const filter = { organization: cleanOrganizationId };
    if (validStatus) {
      filter.status = validStatus;
    }

    const requests = await MembershipRequest.find(filter)
      .populate("user", "name email profilePic isAccountVerified")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("❌ Error fetching membership requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get User's Membership Requests
 * GET /api/membership-requests/user
 */
export const getUserMembershipRequests = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const requests = await MembershipRequest.find({
      user: req.user.id,
    })
      .populate("organization", "name slug description logo")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("❌ Error fetching user membership requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Approve Membership Request
 * PATCH /api/membership-requests/:id/approve
 */
export const approveMembershipRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid membership request ID." });
    }

    const cleanRequestId = new mongoose.Types.ObjectId(String(id));
    const request = await MembershipRequest.findById(cleanRequestId).populate(
      "organization"
    );

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Membership request not found." });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "Request is not in pending status." });
    }

    // Check if user is admin or owner of the organization
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: request.organization._id,
      role: "admin",
      status: "active",
    }).lean();

    const isOwner =
      request.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to approve requests." });
    }

    // Update request status
    request.status = "approved";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes ? String(reviewNotes).trim().substring(0, 500) : "";
    await request.save();

    // Create membership
    const newMembership = await Membership.create({
      user: request.user,
      organization: request.organization._id,
      role: "member",
      status: "active",
    });

    // Update user model for backward compatibility
    await userModel.findByIdAndUpdate(request.user, {
      role: "member",
      organization: request.organization._id,
      hasCompletedOnboarding: true,
    });

    res.status(200).json({
      success: true,
      message: "Membership request approved successfully.",
      request,
      membership: newMembership,
    });
  } catch (error) {
    console.error("❌ Error approving membership request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Reject Membership Request
 * PATCH /api/membership-requests/:id/reject
 */
export const rejectMembershipRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid membership request ID." });
    }

    const cleanRequestId = new mongoose.Types.ObjectId(String(id));
    const request = await MembershipRequest.findById(cleanRequestId).populate(
      "organization"
    );

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Membership request not found." });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "Request is not in pending status." });
    }

    // Check if user is admin or owner of the organization
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: request.organization._id,
      role: "admin",
      status: "active",
    }).lean();

    const isOwner =
      request.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to reject requests." });
    }

    // Update request status
    request.status = "rejected";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes ? String(reviewNotes).trim().substring(0, 500) : "";
    await request.save();

    res.status(200).json({
      success: true,
      message: "Membership request rejected successfully.",
      request,
    });
  } catch (error) {
    console.error("❌ Error rejecting membership request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Cancel Membership Request
 * PATCH /api/membership-requests/:id/cancel
 */
export const cancelMembershipRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid membership request ID." });
    }

    const cleanRequestId = new mongoose.Types.ObjectId(String(id));
    const request = await MembershipRequest.findById(cleanRequestId);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Membership request not found." });
    }

    // Only the requester can cancel
    if (request.user.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to cancel this request." });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "Can only cancel pending requests." });
    }

    request.status = "cancelled";
    await request.save();

    res.status(200).json({
      success: true,
      message: "Membership request cancelled successfully.",
      request,
    });
  } catch (error) {
    console.error("❌ Error cancelling membership request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
