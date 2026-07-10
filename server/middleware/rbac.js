// server/middleware/rbac.js
import mongoose from "mongoose";

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: Insufficient role" });
    }

    next();
  };
};

export const requireOrgMembership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!req.user.organization) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Organization membership required",
    });
  }

  next();
};

export const requireOwnerOrAdmin = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const docId = req.params.id;
      if (!docId) {
        return res
          .status(400)
          .json({ success: false, message: "Document ID required" });
      }
      if (!mongoose.Types.ObjectId.isValid(docId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Document ID format" });
      }

      const doc = await Model.findById(docId);
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, message: "Resource not found" });
      }

      const isOwner = doc.uploadedBy?.toString() === req.user._id.toString();
      const isAdminInSameOrg =
        req.user.role === "admin" &&
        doc.organization &&
        req.user.organization &&
        doc.organization.toString() === req.user.organization.toString();

      if (!isOwner && !isAdminInSameOrg) {
        return res.status(403).json({
          success: false,
          message:
            "Forbidden: You don't have permission to access or modify this resource",
        });
      }

      // Attach the fetched document to the request object so controllers don't need to fetch it again
      req.doc = doc;
      next();
    } catch (error) {
      console.error("requireOwnerOrAdmin error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during authorization check",
      });
    }
  };
};

export const requireOwner = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const docId = req.params.id;
      if (!docId) {
        return res
          .status(400)
          .json({ success: false, message: "Document ID required" });
      }
      if (!mongoose.Types.ObjectId.isValid(docId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Document ID format" });
      }

      const doc = await Model.findById(docId);
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, message: "Resource not found" });
      }

      const isOwner = doc.uploadedBy?.toString() === req.user._id.toString();

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Only the owner can modify this resource",
        });
      }

      req.doc = doc;
      next();
    } catch (error) {
      console.error("requireOwner error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during authorization check",
      });
    }
  };
};

export const requireOrgAccess = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const docId = req.params.id;
      if (!docId) {
        return res
          .status(400)
          .json({ success: false, message: "Document ID required" });
      }
      if (!mongoose.Types.ObjectId.isValid(docId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Document ID format" });
      }

      const doc = await Model.findById(docId);
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, message: "Resource not found" });
      }

      const isOwner = doc.uploadedBy?.toString() === req.user._id.toString();
      const isInSameOrg =
        doc.organization &&
        req.user.organization &&
        doc.organization.toString() === req.user.organization.toString();

      if (!isOwner && !isInSameOrg) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this resource",
        });
      }

      req.doc = doc;
      next();
    } catch (error) {
      console.error("requireOrgAccess error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during authorization check",
      });
    }
  };
};
