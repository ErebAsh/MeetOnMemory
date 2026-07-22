import express from "express";
import multer from "multer";
import Transcript from "../models/Transcript.js";
import Meeting from "../models/meetingModel.js";
import {
  requireOwnerOrAdmin,
  requireOrgAccess,
  requirePermission,
  requireOrgMembership,
} from "../middleware/rbac.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, uploadLimiter } from "../middleware/rateLimiter.js";
import {
  startRecording,
  stopRecording,
  uploadTranscriptAudio,
  getTranscript,
  retryTranscription,
  voiceSearch,
} from "../controllers/transcriptController.js";

const router = express.Router();
const upload = multer({ 
  dest: "uploads/transcripts/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// POST /api/meetings/:meetingId/recording/start
// Starts a recording session, returns Socket.IO room id
router.post(
  "/meetings/:meetingId/recording/start",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  startRecording
);

// POST /api/meetings/:meetingId/recording/stop
// Finalizes recording, triggers transcription + indexing
router.post(
  "/meetings/:meetingId/recording/stop",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  stopRecording
);

// POST /api/meetings/:meetingId/transcript/upload
// Multer-based audio chunk/file upload
router.post(
  "/meetings/:meetingId/transcript/upload",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  upload.single("audio"),
  uploadTranscriptAudio
);

// GET /api/meetings/:meetingId/transcript
// Fetch the stored transcript
router.get(
  "/meetings/:meetingId/transcript",
  userAuth,
  requireOrgMembership,
  requirePermission("meetings", "view"),
  getTranscript
);

// POST /api/meetings/:meetingId/transcript/retry
// Retry failed transcription
router.post(
  "/meetings/:meetingId/transcript/retry",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  retryTranscription
);

// GET /api/search/voice?query=...
// Voice-powered semantic search across transcripts/policies/meetings
router.get(
  "/search/voice",
  userAuth,
  requireOrgMembership,
  requirePermission("ai_search", "search"),
  voiceSearch
);

export default router;
