import express from "express";
import multer from "multer";
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
} from "../controllers/meetingController.js";

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
  upload.single("file"),
  uploadMeeting,
);

// ✅ Summarize Transcript (send meetingId or transcript)
router.post("/summarize", userAuth, writeLimiter, summarizeMeeting);

// ✅ Fetch All Meetings (for Summaries Page)
router.get("/all", userAuth, getAllMeetings);

// ✅ Get Single Meeting Details (for Meeting Details Page)
router.get("/:id", userAuth, getMeetingById);

// ✅ Update Meeting (for Meeting Details Page - rename)
router.patch("/:id", userAuth, updateMeeting);

// ✅ Delete Meeting
router.delete("/delete/:id", userAuth, writeLimiter, deleteMeeting);

// ========== NEW ROUTES (for CreateMeeting.jsx) ==========

// ✅ Create/Schedule Meeting (from CreateMeeting Schedule section)
router.post("/create", userAuth, writeLimiter, createMeeting);

// ✅ Upload Audio for existing meeting (from CreateMeeting Upload section)
router.post(
  "/upload-audio",
  userAuth,
  uploadLimiter,
  upload.single("audio"),
  uploadAudioForMeeting,
);

// 🆕 ✅ Voice/Text Search Route (Frontend: Summaries.jsx or Live Search)
router.post("/search", userAuth, searchMeetingsByText);

// 🆕 ✅ Update Meeting Route (Frontend: Meeting Repository - rename, etc.)
router.put("/:id", userAuth, writeLimiter, updateMeeting);

export default router;
