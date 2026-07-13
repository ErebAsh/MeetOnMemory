// server/routes/membershipRequestRoutes.js
import express from "express";
import {
  createMembershipRequest,
  getOrganizationMembershipRequests,
  getUserMembershipRequests,
  approveMembershipRequest,
  rejectMembershipRequest,
  cancelMembershipRequest,
} from "../controllers/membershipRequestController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  requirePermission,
  requireOrgMembership,
} from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(userAuth);

// Create request
router.post("/", writeLimiter, requirePermission("team_members", "invite"), createMembershipRequest);

// Get requests
router.get("/organization/:organizationId", requireOrgMembership, requirePermission("team_members", "view"), getOrganizationMembershipRequests);
router.get("/user", requirePermission("team_members", "view"), getUserMembershipRequests);

// Manage requests
router.patch("/:id/approve", writeLimiter, requirePermission("team_members", "invite"), approveMembershipRequest);
router.patch("/:id/reject", writeLimiter, requirePermission("team_members", "invite"), rejectMembershipRequest);
router.patch("/:id/cancel", writeLimiter, requirePermission("team_members", "invite"), cancelMembershipRequest);

export default router;
