import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import {
  getConfig,
  updateConfig,
  getPreview,
  applyCarryForward,
  getMeetingPreview,
  applyMeetingCarryForward,
  getHistory,
} from "../controllers/carryForwardController.js";

const router = express.Router();

const auth = [userAuth, requireOrgMembership];

// --- Original Routes (Relative to mount point: /api/meeting-series) ---
router.get(
  "/:seriesId/carry-forward/config",
  ...auth,
  requirePermission("meetings", "view"),
  getConfig,
);

router.put(
  "/:seriesId/carry-forward/config",
  ...auth,
  requirePermission("meetings", "edit"),
  updateConfig,
);

router.get(
  "/:seriesId/carry-forward/preview",
  ...auth,
  requirePermission("meetings", "view"),
  getPreview,
);

router.post(
  "/:seriesId/carry-forward/apply",
  ...auth,
  requirePermission("meetings", "edit"),
  applyCarryForward,
);

// --- New Routes (Relative to mount point: /api) ---
router.get(
  "/meetings/:meetingId/carry-forward/preview",
  ...auth,
  requirePermission("meetings", "view"),
  getMeetingPreview,
);

router.post(
  "/meetings/:meetingId/carry-forward/apply",
  ...auth,
  requirePermission("meetings", "edit"),
  applyMeetingCarryForward,
);

router.get(
  "/series/:seriesId/carry-forward/history",
  ...auth,
  requirePermission("meetings", "view"),
  getHistory,
);

export default router;
