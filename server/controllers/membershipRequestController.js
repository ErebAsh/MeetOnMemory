// server/controllers/membershipRequestController.js
import MembershipRequest from "../models/membershipRequestModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import mongoose from "mongoose";
import AuditService from "../services/AuditService.js";
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
 * ✅ Get Membership Requests for Organization (with search, filter, pagination, sorting)
 * GET /api/membership-requests/organization/:organizationId
 */
export const getOrganizationMembershipRequests = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status, search, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

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

    // Build filter
    const filter = { organization: cleanOrganizationId };
    if (validStatus) {
      filter.status = validStatus;
    }

    // Build search query
    let searchQuery = {};
    if (search && search.trim()) {
      const searchTerm = search.trim();
      searchQuery = {
        $or: [
          { "user.name": { $regex: searchTerm, $options: "i" } },
          { "user.email": { $regex: searchTerm, $options: "i" } },
        ],
      };
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const validSortFields = ["createdAt", "status", "name"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortObj = {};
    
    if (sortField === "name") {
      sortObj["user.name"] = sortDirection;
    } else {
      sortObj[sortField] = sortDirection;
    }

    // Execute query with search
    const requests = await MembershipRequest.find(filter)
      .populate("user", "name email profilePic isAccountVerified")
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Filter by search term if provided (client-side filtering for populated fields)
    let filteredRequests = requests;
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filteredRequests = requests.filter((req) => {
        const userName = req.user?.name?.toLowerCase() || "";
        const userEmail = req.user?.email?.toLowerCase() || "";
        const userId = req.user?._id?.toString() || "";
        return (
          userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          userId.includes(searchTerm)
        );
      });
    }

    // Get total count for pagination
    const total = await MembershipRequest.countDocuments(filter);
    const filteredTotal = search ? filteredRequests.length : total;

    res.status(200).json({
      success: true,
      requests: filteredRequests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limitNum),
      },
    });
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

    AuditService.logAction({
      actorId: req.user.id,
      action: "MEMBERSHIP_REQUEST_APPROVED",
      entity: "MembershipRequest",
      entityId: request._id,
      organizationId: request.organization._id,
      details: { userId: request.user },
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

    AuditService.logAction({
      actorId: req.user.id,
      action: "MEMBERSHIP_REQUEST_REJECTED",
      entity: "MembershipRequest",
      entityId: request._id,
      organizationId: request.organization._id,
      details: { userId: request.user, reviewNotes },
    });

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

/**
 * ✅ Bulk Approve Membership Requests
 * POST /api/membership-requests/bulk-approve
 */
export const bulkApproveMembershipRequests = async (req, res) => {
  try {
    const { requestIds, reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Request IDs array is required." });
    }

    // Validate all request IDs
    const validRequestIds = requestIds
      .filter((id) => isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    if (validRequestIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid request IDs provided." });
    }

    // Fetch all requests
    const requests = await MembershipRequest.find({
      _id: { $in: validRequestIds },
    }).populate("organization");

    if (requests.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No membership requests found." });
    }

    // Check authorization for each request
    const results = [];
    const errors = [];

    for (const request of requests) {
      if (request.status !== "pending") {
        errors.push({
          requestId: request._id,
          message: "Request is not in pending status.",
        });
        continue;
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
        errors.push({
          requestId: request._id,
          message: "Not authorized to approve this request.",
        });
        continue;
      }

      // Update request status
      request.status = "approved";
      request.reviewedBy = req.user.id;
      request.reviewedAt = new Date();
      request.reviewNotes = reviewNotes
        ? String(reviewNotes).trim().substring(0, 500)
        : "";
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

      AuditService.logAction({
        actorId: req.user.id,
        action: "MEMBERSHIP_REQUEST_APPROVED",
        entity: "MembershipRequest",
        entityId: request._id,
        organizationId: request.organization._id,
        details: { userId: request.user },
      });

      results.push({
        requestId: request._id,
        membershipId: newMembership._id,
        status: "approved",
      });
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.length} requests successfully.`,
      results,
      errors,
    });
  } catch (error) {
    console.error("❌ Error bulk approving membership requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Bulk Reject Membership Requests
 * POST /api/membership-requests/bulk-reject
 */
export const bulkRejectMembershipRequests = async (req, res) => {
  try {
    const { requestIds, reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Request IDs array is required." });
    }

    // Validate all request IDs
    const validRequestIds = requestIds
      .filter((id) => isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    if (validRequestIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid request IDs provided." });
    }

    // Fetch all requests
    const requests = await MembershipRequest.find({
      _id: { $in: validRequestIds },
    }).populate("organization");

    if (requests.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No membership requests found." });
    }

    // Check authorization for each request
    const results = [];
    const errors = [];

    for (const request of requests) {
      if (request.status !== "pending") {
        errors.push({
          requestId: request._id,
          message: "Request is not in pending status.",
        });
        continue;
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
        errors.push({
          requestId: request._id,
          message: "Not authorized to reject this request.",
        });
        continue;
      }

      // Update request status
      request.status = "rejected";
      request.reviewedBy = req.user.id;
      request.reviewedAt = new Date();
      request.reviewNotes = reviewNotes
        ? String(reviewNotes).trim().substring(0, 500)
        : "";
      await request.save();

      AuditService.logAction({
        actorId: req.user.id,
        action: "MEMBERSHIP_REQUEST_REJECTED",
        entity: "MembershipRequest",
        entityId: request._id,
        organizationId: request.organization._id,
        details: { userId: request.user, reviewNotes },
      });

      results.push({
        requestId: request._id,
        status: "rejected",
      });
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.length} requests successfully.`,
      results,
      errors,
    });
  } catch (error) {
    console.error("❌ Error bulk rejecting membership requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
