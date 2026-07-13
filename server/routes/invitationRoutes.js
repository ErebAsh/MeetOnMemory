// server/routes/invitationRoutes.js
import express from "express";
import {
  createInvitation,
  getOrganizationInvitations,
  getUserInvitations,
  acceptInvitation,
  rejectInvitation,
  revokeInvitation,
  getInvitationByToken,
} from "../controllers/invitationController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requireAdmin } from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes except getInvitationByToken require authentication
router.post("/", userAuth, requireAdmin, createInvitation);
router.get("/organization/:organizationId", userAuth, getOrganizationInvitations);
router.get("/user", userAuth, getUserInvitations);
router.post("/:token/accept", userAuth, acceptInvitation);
router.post("/:token/reject", userAuth, rejectInvitation);
router.delete("/:id", userAuth, requireAdmin, revokeInvitation);
router.get("/:token", getInvitationByToken);

export default router;
