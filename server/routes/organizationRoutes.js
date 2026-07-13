// server/routes/organizationRoutes.js
import express from "express";
import {
  createOrJoinOrganization,
  getAllOrganizations,
  joinOrganization,
  selectOrganization,
  getOrganizationMembers,
  getPublicOrganizationBySlug,
  browsePublicOrganizations,
  searchOrganizations,
} from "../controllers/organizationController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requireAdmin } from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Unified endpoint: handles both "create new" and "join existing" organizations
router.post("/create-or-join", userAuth, requireAdmin, createOrJoinOrganization);

// Member joins by selecting an existing org
router.post("/join", userAuth, joinOrganization);

// Select organization (for users with multiple orgs)
router.post("/select", userAuth, selectOrganization);

// Fetch all organizations (list) - usable for the join UI
router.get("/", userAuth, getAllOrganizations);

// Fetch organization members
router.get("/members", userAuth, getOrganizationMembers);

// Public organization profile by slug (no auth required)
router.get("/public/:slug", getPublicOrganizationBySlug);
// Browse public organizations with pagination and filters
router.get("/browse", userAuth, browsePublicOrganizations);

// Search organizations (public only)
router.get("/search", userAuth, searchOrganizations);

export default router;
