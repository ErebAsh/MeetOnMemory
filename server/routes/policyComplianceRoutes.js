import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  getDecisionCompliance,
  getPolicyRelatedDecisions,
  getComplianceFlags,
  updateFlagStatus,
} from "../controllers/policyComplianceController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);
router.use(requireOrgMembership); // compliance data only exists within an organization

router.get("/decisions/:decisionId", getDecisionCompliance);
router.get("/policies/:policyId/related-decisions", getPolicyRelatedDecisions);
router.get("/flags", getComplianceFlags);
router.patch("/flags/:id", writeLimiter, updateFlagStatus);

export default router;
