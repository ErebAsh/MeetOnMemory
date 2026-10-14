import express from "express";
import multer from "multer";
import {
  createMeeting,
  getMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  uploadRecording,
  getRecording,
  deleteRecording,
} from "../controllers/meetingController.js";
import {
  UPLOAD_LIMITS,
  ALLOWED_MIME_TYPES,
  createMulterConfig,
  handleMulterError,
  getUploadLimits,
} from "../config/uploadConfig.js";
import { authenticateUser, requireOrganization } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Apply authentication middleware
router.use(authenticateUser);
router.use(requireOrganization);

/**
 * @route   GET /api/meetings/upload-limits
 * @desc    Get upload limits for client
 * @access  Private
 */
router.get("/upload-limits", (req, res) => {
  const limits = getUploadLimits();
  res.json({
    success: true,
    data: limits,
  });
});

/**
 * @route   POST /api/meetings
 * @desc    Create a new meeting
 * @access  Private
 */
router.post("/", createMeeting);

/**
 * @route   GET /api/meetings
 * @desc    Get all meetings for organization
 * @access  Private
 */
router.get("/", getMeetings);

/**
 * @route   GET /api/meetings/:id
 * @desc    Get meeting by ID
 * @access  Private
 */
router.get("/:id", getMeeting);

/**
 * @route   PUT /api/meetings/:id
 * @desc    Update meeting
 * @access  Private
 */
router.put("/:id", updateMeeting);

/**
 * @route   DELETE /api/meetings/:id
 * @desc    Delete meeting
 * @access  Private
 */
router.delete("/:id", deleteMeeting);

// ============ RECORDING UPLOAD ============

// Configure multer for recording upload with file size limits
const recordingUploadConfig = createMulterConfig({
  destination: "recordings",
  maxSize: UPLOAD_LIMITS.RECORDING.MAX_SIZE,
  maxFiles: UPLOAD_LIMITS.RECORDING.MAX_FILES,
  allowedMimeTypes: ALLOWED_MIME_TYPES.RECORDING,
  fieldName: UPLOAD_LIMITS.RECORDING.FIELD_NAME,
});

const recordingUpload = multer(recordingUploadConfig);

/**
 * @route   POST /api/meetings/:id/recording
 * @desc    Upload recording for a meeting
 * @access  Private
 * @limits  Max 500MB, video/audio formats only
 */
router.post(
  "/:id/recording",
  (req, res, next) => {
    // Log upload attempt
    logger.info(`Recording upload attempt for meeting ${req.params.id}`);
    next();
  },
  recordingUpload.single("recording"),
  (req, res, next) => {
    // Log successful upload
    logger.info(`Recording uploaded for meeting ${req.params.id}`);
    next();
  },
  uploadRecording,
  handleMulterError,
);

/**
 * @route   GET /api/meetings/:id/recording
 * @desc    Get recording metadata
 * @access  Private
 */
router.get("/:id/recording", getRecording);

/**
 * @route   DELETE /api/meetings/:id/recording
 * @desc    Delete recording
 * @access  Private
 */
router.delete("/:id/recording", deleteRecording);

// ============ AUDIO UPLOAD (for transcription) ============

const audioUploadConfig = createMulterConfig({
  destination: "audio",
  maxSize: UPLOAD_LIMITS.AUDIO.MAX_SIZE,
  maxFiles: UPLOAD_LIMITS.AUDIO.MAX_FILES,
  allowedMimeTypes: ALLOWED_MIME_TYPES.AUDIO,
  fieldName: UPLOAD_LIMITS.AUDIO.FIELD_NAME,
});

const audioUpload = multer(audioUploadConfig);

/**
 * @route   POST /api/meetings/:id/audio
 * @desc    Upload audio for transcription
 * @access  Private
 * @limits  Max 100MB, audio formats only
 */
router.post(
  "/:id/audio",
  audioUpload.single("audio"),
  (req, res, next) => {
    // Forward to controller
    next();
  },
  // Placeholder - will be implemented in transcript controller
  (req, res) => {
    res.json({
      success: true,
      message: "Audio uploaded successfully",
      file: req.file,
    });
  },
  handleMulterError,
);

export default router;
