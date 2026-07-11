// server/routes/organizationRoutes.js
import express from "express";
import {
  createOrJoinOrganization,
  getAllOrganizations,
  joinOrganization,
  selectOrganization,
  getOrganizationMembers,
} from "../controllers/organizationController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Unified endpoint: handles both "create new" and "join existing" organizations
router.post("/create-or-join", userAuth, createOrJoinOrganization);

// Member joins by selecting an existing org
router.post("/join", userAuth, joinOrganization);

// Select organization (for users with multiple orgs)
router.post("/select", userAuth, selectOrganization);

// Fetch all organizations (list) - usable for the join UI
router.get("/", userAuth, getAllOrganizations);

// Fetch organization members
router.get("/members", userAuth, getOrganizationMembers);

export default router;
