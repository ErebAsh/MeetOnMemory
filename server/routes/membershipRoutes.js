// server/routes/membershipRoutes.js
import express from "express";
import {
  getUserMemberships,
  getOrganizationMemberships,
  updateMembershipRole,
  removeMembership,
  leaveOrganization,
} from "../controllers/membershipController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requireAdmin } from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(userAuth);

// User memberships
router.get("/", getUserMemberships);

// Organization memberships
router.get("/organization/:organizationId", getOrganizationMemberships);

// Membership management (admin only)
router.patch("/:id/role", requireAdmin, updateMembershipRole);
router.delete("/:id", requireAdmin, removeMembership);

// Leave organization
router.post("/leave/:organizationId", leaveOrganization);

export default router;
