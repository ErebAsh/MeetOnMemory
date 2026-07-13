import express from "express";
import multer from "multer";
import Meeting from "../models/meetingModel.js";
import {
  requireOwnerOrAdmin,
  requireOwner,
  requireOrgAccess,
  requirePermission,
  requireOrgMembership,
} from "../middleware/rbac.js";
import userAuth from "../middleware/userAuth.js";
import {
  apiLimiter,
  writeLimiter,
  uploadLimiter,
} from "../middleware/rateLimiter.js";
import {
  createMeeting, // NEW: Schedule meetings from CreateMeeting form
  uploadMeeting, // EXISTING: Upload audio and transcribe
  uploadAudioForMeeting, // NEW: Upload audio for existing meeting
  summarizeMeeting, // EXISTING: Generate AI summary/MOM
  getAllMeetings,
  getMeetingById, // NEW: Get single meeting details
  updateMeeting, // NEW: Update meeting (rename)
  deleteMeeting, // EXISTING: Delete meeting
  searchMeetingsByText, // 🆕 NEW: Voice/Text Search
  notifyLiveMeeting, // NEW: Notify participants of a live meeting
} from "../controllers/meetingController.js";
import { exportMeeting } from "../controllers/exportController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temporary upload directory

// Apply rate limiting to all routes
router.use(apiLimiter);

// ========== EXISTING ROUTES (Working) ==========

// ✅ Upload & Transcribe Meeting (from UploadMeetings page)
router.post(
  "/upload",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  upload.single("file"),
  uploadMeeting,
);

// ✅ Summarize Transcript (send meetingId or transcript)
router.post("/summarize", userAuth, writeLimiter, requirePermission("meetings", "transcribe"), summarizeMeeting);

// ✅ Fetch All Meetings (for Summaries Page)
router.get("/all", userAuth, requireOrgMembership, requirePermission("meetings", "view"), getAllMeetings);

// ✅ Get Single Meeting Details (for Meeting Details Page)
router.get("/:id", userAuth, requireOrgAccess(Meeting), requirePermission("meetings", "view"), getMeetingById);

// ✅ Update Meeting (for Meeting Details Page - rename)
router.patch("/:id", userAuth, requireOwner(Meeting), requirePermission("meetings", "edit"), updateMeeting);

// ✅ Export Meeting
router.get("/:id/export", userAuth, requireOrgAccess(Meeting), requirePermission("meetings", "export"), exportMeeting);

// ✅ Delete Meeting
router.delete(
  "/delete/:id",
  userAuth,
  writeLimiter,
  requireOwnerOrAdmin(Meeting),
  requirePermission("meetings", "delete"),
  deleteMeeting,
);

// ========== NEW ROUTES (for CreateMeeting.jsx) ==========

// ✅ Create/Schedule Meeting (from CreateMeeting Schedule section)
router.post("/create", userAuth, writeLimiter, requireOrgMembership, requirePermission("meetings", "create"), createMeeting);

// ✅ Upload Audio for existing meeting (from CreateMeeting Upload section)
router.post(
  "/upload-audio",
  userAuth,
  uploadLimiter,
  requireOrgMembership,
  requirePermission("meetings", "create"),
  upload.single("audio"),
  uploadAudioForMeeting,
);

// 🆕 ✅ Voice/Text Search Route (Frontend: Summaries.jsx or Live Search)
router.post("/search", userAuth, requirePermission("meetings", "view"), searchMeetingsByText);

// 🆕 ✅ Update Meeting Route (Frontend: Meeting Repository - rename, etc.)
router.put(
  "/:id",
  userAuth,
  writeLimiter,
  requireOwner(Meeting),
  requirePermission("meetings", "edit"),
  updateMeeting,
);

// ✅ Notify Live Meeting Participants (from CreateMeeting Live section)
router.post("/notify-live", userAuth, writeLimiter, requirePermission("meetings", "create"), notifyLiveMeeting);

export default router;
