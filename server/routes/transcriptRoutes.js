/**
 * transcriptRoutes.js
 * Routes for transcript management and export
 */

import express from "express";
import {
  getTranscriptByMeeting,
  searchTranscript,
  exportTranscriptAsText,
  exportTranscriptAsPDF,
  finalizeTranscript,
} from "../controllers/transcriptController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { requireOrgAccess, requirePermission } from "../middleware/rbac.js";
import Meeting from "../models/meetingModel.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Get transcript by meeting ID
router.get(
  "/meeting/:meetingId",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getTranscriptByMeeting
);

// Search within transcript
router.post(
  "/meeting/:meetingId/search",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  searchTranscript
);

// Export transcript as text
router.get(
  "/meeting/:meetingId/export/text",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "export"),
  exportTranscriptAsText
);

// Export transcript as PDF
router.get(
  "/meeting/:meetingId/export/pdf",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "export"),
  exportTranscriptAsPDF
);

// Finalize transcript and index in Pinecone
router.post(
  "/meeting/:meetingId/finalize",
  userAuth,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  finalizeTranscript
);

export default router;
