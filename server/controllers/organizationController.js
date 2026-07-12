// server/controllers/organizationController.js
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import { createAndPushNotification } from "../services/notificationService.js";
import mongoose from "mongoose";

/**
 * Escape special regex characters to prevent ReDoS attacks
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * ✅ Create or Join Organization
 * - If org exists → join as Member
 * - If not → create new org as Admin
 * - Returns updated user with populated org
 */
export const createOrJoinOrganization = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate authentication
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // Validate org name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide an organization name.",
      });
    }

    const userId = req.user.id;
    const orgName = name.trim();

    // Check if organization already exists (case-insensitive match)
    let organization = await Organization.findOne({
      name: { $regex: `^${orgName}$`, $options: "i" },
    });

    let message = "";

    if (organization) {
      // --- Join existing organization ---
      const alreadyMember = organization.members.some(
        (m) => m.toString() === userId.toString(),
      );

      if (!alreadyMember) {
        organization.members.push(userId);
        await organization.save();
      }

      await userModel.findByIdAndUpdate(userId, {
        role: "member",
        organization: organization._id,
        hasCompletedOnboarding: true,
      });

      message = "Joined existing organization successfully.";

      // Notify the organization admin
      const io = req.app.get("io");
      if (
        io &&
        organization.createdBy &&
        organization.createdBy.toString() !== userId.toString()
      ) {
        try {
          await createAndPushNotification(
            io,
            organization.createdBy,
            "New Member Joined",
            `A new user has joined your organization: ${organization.name}.`,
            "organizations",
            "/team-members",
            "View Team",
          );
        } catch (notifErr) {
          console.error("⚠️ Notification error:", notifErr.message);
        }
      }
    } else {
      // --- Create new organization ---
      organization = await Organization.create({
        name: orgName,
        createdBy: userId,
        members: [userId],
      });

      await userModel.findByIdAndUpdate(userId, {
        role: "admin",
        organization: organization._id,
        hasCompletedOnboarding: true,
      });

      message = "Organization created successfully!";
    }

    // Fetch updated user data (with organization populated)
    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name");

    // Defensive checks in case something is missing
    const roleStr =
      updatedUser?.role && typeof updatedUser.role === "string"
        ? updatedUser.role.charAt(0).toUpperCase() + updatedUser.role.slice(1)
        : updatedUser?.role || null;

    const orgDoc = updatedUser?.organization
      ? {
          ...updatedUser.organization._doc,
          name:
            typeof updatedUser.organization.name === "string"
              ? updatedUser.organization.name
              : "",
        }
      : null;

    res.status(200).json({
      success: true,
      message,
      userData: {
        ...updatedUser._doc,
        role: roleStr,
        organization: orgDoc,
      },
    });
  } catch (error) {
    console.error("❌ Error creating/joining organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get All Organizations (For listing)
 * Returns: { success: true, organizations: [...] }
 */
export const getAllOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find({}, "name _id").sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, organizations });
  } catch (error) {
    console.error("❌ Error fetching organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Join organization by ID (member flow)
 * Body: { organizationId: "<org id>" }
 */
export const joinOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "organizationId is required." });
    }

    // Validate organizationId is a valid MongoDB ObjectId to prevent NoSQL injection
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID format." });
    }

    const userId = req.user.id;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    const alreadyMember = organization.members.some(
      (m) => m.toString() === userId.toString(),
    );

    if (!alreadyMember) {
      organization.members.push(userId);
      await organization.save();
    }

    // Update user to be a member of this organization
    await userModel.findByIdAndUpdate(userId, {
      role: "member",
      organization: organization._id,
      hasCompletedOnboarding: true,
    });

    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name");

    // Notify the organization admin
    const io = req.app.get("io");
    if (
      io &&
      organization.createdBy &&
      organization.createdBy.toString() !== userId.toString()
    ) {
      try {
        await createAndPushNotification(
          io,
          organization.createdBy,
          "New Member Joined",
          `A new user has joined your organization: ${organization.name}.`,
          "organizations",
          "/team-members",
          "View Team",
        );
      } catch (notifErr) {
        console.error("⚠️ Notification error:", notifErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Joined organization successfully.",
      userData: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error joining organization by ID:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Select organization (for users with multiple orgs)
 * Body: { organizationId: "<org id>" }
 */
export const selectOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "organizationId is required." });
    }

    // Validate organizationId is a valid MongoDB ObjectId to prevent NoSQL injection
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID format." });
    }

    const userId = req.user.id;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    const isMember = organization.members.some(
      (m) => m.toString() === userId.toString(),
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ success: false, message: "You are not a member of this organization." });
    }

    // Update user's selected organization
    await userModel.findByIdAndUpdate(userId, {
      organization: organization._id,
      hasCompletedOnboarding: true,
    });

    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name");

    res.status(200).json({
      success: true,
      message: "Organization selected successfully.",
      userData: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error selecting organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get organization members
 * Returns: { success: true, members: [...] }
 */
export const getOrganizationMembers = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const user = await userModel.findById(req.user.id);
    if (!user || !user.organization) {
      return res.status(400).json({
        success: false,
        message: "User is not part of an organization.",
      });
    }

    const organization = await Organization.findById(
      user.organization,
    ).populate({
      path: "members",
      select: "name email role createdAt isAccountVerified",
    });

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    res.status(200).json({
      success: true,
      members: organization.members,
      organizationName: organization.name,
    });
  } catch (error) {
    console.error("❌ Error fetching organization members:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Browse public organizations with pagination and filters
 * Query params: page, limit, search, sortBy, filter
 * Returns: { success: true, organizations: [...], pagination: {...} }
 */
export const browsePublicOrganizations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "createdAt";
    const filter = req.query.filter || "all";

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 50.",
      });
    }

    // Build base query - only public organizations
    const baseQuery = { visibility: "public" };

    // Add search filter if provided
    let searchQuery = { ...baseQuery };
    if (search && search.trim()) {
      const escapedSearch = escapeRegex(search.trim());
      const searchRegex = new RegExp(escapedSearch, "i");
      searchQuery = {
        ...baseQuery,
        $or: [
          { name: searchRegex },
          { slug: searchRegex },
          { description: searchRegex },
        ],
      };
    }

    // Build sort object
    let sortObj = {};
    switch (sortBy) {
      case "name":
        sortObj = { name: 1 };
        break;
      case "members":
        sortObj = { "members.length": -1 };
        break;
      case "createdAt":
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    // Apply additional filters
    let finalQuery = { ...searchQuery };
    if (filter === "recent") {
      // Filter organizations created in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      finalQuery = { ...searchQuery, createdAt: { $gte: thirtyDaysAgo } };
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [organizations, total] = await Promise.all([
      Organization.find(finalQuery)
        .select("name slug description logo visibility createdAt members metadata")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      Organization.countDocuments(finalQuery),
    ]);

    // Calculate member counts for each organization
    const organizationsWithCounts = organizations.map((org) => ({
      ...org,
      memberCount: org.members ? org.members.length : 0,
    }));

    res.status(200).json({
      success: true,
      organizations: organizationsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error browsing public organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Search organizations (public only)
 * Query params: q (search query), page, limit
 * Returns: { success: true, organizations: [...], pagination: {...} }
 */
export const searchOrganizations = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required.",
      });
    }

    if (q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters.",
      });
    }

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",
      });
    }

    const escapedQuery = escapeRegex(q.trim());
    const searchRegex = new RegExp(escapedQuery, "i");
    const skip = (page - 1) * limit;

    // Search in public organizations only
    const query = {
      visibility: "public",
      $or: [
        { name: searchRegex },
        { slug: searchRegex },
        { description: searchRegex },
      ],
    };

    const [organizations, total] = await Promise.all([
      Organization.find(query)
        .select("name slug description logo visibility createdAt members metadata")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Organization.countDocuments(query),
    ]);

    // Calculate member counts
    const organizationsWithCounts = organizations.map((org) => ({
      ...org,
      memberCount: org.members ? org.members.length : 0,
    }));

    res.status(200).json({
      success: true,
      organizations: organizationsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error searching organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
