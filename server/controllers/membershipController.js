// server/controllers/membershipController.js
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";

/**
 * ✅ Get User Memberships
 * GET /api/memberships
 */
export const getUserMemberships = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const memberships = await Membership.find({
      user: req.user.id,
      status: "active",
    })
      .populate("organization", "name slug description logo visibility")
      .sort({ joinedAt: -1 });

    res.status(200).json({ success: true, memberships });
  } catch (error) {
    console.error("❌ Error fetching user memberships:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get Organization Memberships
 * GET /api/memberships/organization/:organizationId
 */
export const getOrganizationMemberships = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Check if user is a member
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: organizationId,
      status: "active",
    });

    if (!membership) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not a member of this organization.",
        });
    }

    const memberships = await Membership.find({
      organization: organizationId,
      status: "active",
    })
      .populate("user", "name email profilePic isAccountVerified")
      .sort({ joinedAt: -1 });

    res.status(200).json({ success: true, memberships });
  } catch (error) {
    console.error("❌ Error fetching organization memberships:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Update Membership Role
 * PATCH /api/memberships/:id/role
 */
export const updateMembershipRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!role || !["admin", "member"].includes(role)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid role. Must be 'admin' or 'member'.",
        });
    }

    const membership = await Membership.findById(id).populate("organization");

    if (!membership) {
      return res
        .status(404)
        .json({ success: false, message: "Membership not found." });
    }

    // Check if requester is admin or owner of the organization
    const requesterMembership = await Membership.findOne({
      user: req.user.id,
      organization: membership.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      membership.organization.owner.toString() === req.user.id.toString();

    if (!requesterMembership && !isOwner) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to update membership role.",
        });
    }

    // Prevent removing the last admin
    if (membership.role === "admin" && role === "member") {
      const adminCount = await Membership.countDocuments({
        organization: membership.organization._id,
        role: "admin",
        status: "active",
      });

      if (adminCount <= 1) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot remove the last admin." });
      }
    }

    membership.role = role;
    await membership.save();

    res.status(200).json({
      success: true,
      message: "Membership role updated successfully.",
      membership,
    });
  } catch (error) {
    console.error("❌ Error updating membership role:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Remove Membership
 * DELETE /api/memberships/:id
 */
export const removeMembership = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const membership = await Membership.findById(id).populate("organization");

    if (!membership) {
      return res
        .status(404)
        .json({ success: false, message: "Membership not found." });
    }

    // User can remove themselves
    // Admins can remove other members
    const isSelf = membership.user.toString() === req.user.id.toString();
    const requesterMembership = await Membership.findOne({
      user: req.user.id,
      organization: membership.organization._id,
      role: "admin",
      status: "active",
    });
    const isOwner =
      membership.organization.owner.toString() === req.user.id.toString();

    if (!isSelf && !requesterMembership && !isOwner) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to remove this membership.",
        });
    }

    // Prevent removing the last admin
    if (membership.role === "admin") {
      const adminCount = await Membership.countDocuments({
        organization: membership.organization._id,
        role: "admin",
        status: "active",
      });

      if (adminCount <= 1) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot remove the last admin." });
      }
    }

    // Update status to removed instead of deleting
    membership.status = "removed";
    await membership.save();

    // Update user model for backward compatibility if it was their primary org
    const targetUserId = isSelf ? req.user.id : membership.user;
    const removedOrgId =
      membership.organization._id || membership.organization;

    const targetUser = await userModel.findById(targetUserId);
    if (
      targetUser &&
      targetUser.organization &&
      targetUser.organization.toString() === removedOrgId.toString()
    ) {
      await userModel.findByIdAndUpdate(targetUserId, {
        organization: null,
        role: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Membership removed successfully.",
    });
  } catch (error) {
    console.error("❌ Error removing membership:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Leave Organization
 * POST /api/memberships/leave/:organizationId
 */
export const leaveOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const membership = await Membership.findOne({
      user: req.user.id,
      organization: organizationId,
      status: "active",
    }).populate("organization");

    if (!membership) {
      return res
        .status(404)
        .json({ success: false, message: "Membership not found." });
    }

    // Prevent owner from leaving (they should transfer ownership first)
    if (membership.organization.owner.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Owner cannot leave organization. Transfer ownership first.",
      });
    }

    // Update status to removed
    membership.status = "removed";
    await membership.save();

    // Update user model for backward compatibility
    await userModel.findByIdAndUpdate(req.user.id, {
      organization: null,
      role: null,
    });

    res.status(200).json({
      success: true,
      message: "Left organization successfully.",
    });
  } catch (error) {
    console.error("❌ Error leaving organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
