import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";
import {
  getDecisionLineageController,
  getOpenActionItems,
  getDecisions,
  submitMemoryFeedback,
  recalculateImportance,
  updateActionItemStatus,
} from "../controllers/knowledgeController.js";
import {
  runConsolidation,
  getConsolidationHistory,
} from "../controllers/consolidationController.js";

const router = express.Router();
router.use(apiLimiter);
router.use(userAuth);

router.get("/decisions/:id/lineage", getDecisionLineageController);
router.get("/action-items", getOpenActionItems);
router.patch("/action-items/:id", writeLimiter, requireAdmin, updateActionItemStatus);
router.get("/decisions/:id/lineage", requireOrgMembership, requirePermission("knowledge", "view"), getDecisionLineageController);
router.get("/action-items", requireOrgMembership, requirePermission("knowledge", "view"), getOpenActionItems);
router.patch("/action-items/:id", writeLimiter, requireOrgMembership, requirePermission("tasks", "edit"), updateActionItemStatus);
router.get(
  "/decisions",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getDecisions,
);
router.get(
  "/decisions/:id/lineage",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getDecisionLineageController,
);
router.get(
  "/action-items",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getOpenActionItems,
);
router.patch(
  "/action-items/:id",
  writeLimiter,
  requireOrgMembership,
  requirePermission("tasks", "edit"),
  updateActionItemStatus,
);
router.patch(
  "/:type/:id/feedback",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "edit"),
  submitMemoryFeedback,
);

router.post(
  "/importance/recalculate",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "edit"),
  recalculateImportance,
);
=======

// --- Memory Consolidation Engine ---
router.post(
  "/consolidate",
  writeLimiter,
  requireOrgMembership,
  requirePermission("knowledge", "consolidate"),
  runConsolidation,
);
router.get(
  "/consolidation/history",
  requireOrgMembership,
  requirePermission("knowledge", "view"),
  getConsolidationHistory,
);


export default router;
