import express from "express";
import multer from "multer";
import {
  startResumableUpload,
  uploadChunk,
  completeResumableUpload,
  getUploadStatus,
  cancelResumableUpload,
  getUploadLimits,
} from "../controllers/resumableUploadController.js";
import {
  UPLOAD_LIMITS,
  createMulterConfig,
  handleMulterError,
} from "../config/uploadConfig.js";
import { authenticateUser, requireOrganization } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication middleware
router.use(authenticateUser);
router.use(requireOrganization);

// Configure multer for chunk uploads
const chunkUploadConfig = createMulterConfig({
  destination: "chunks",
  maxSize: UPLOAD_LIMITS.CHUNK.MAX_SIZE,
  maxFiles: UPLOAD_LIMITS.CHUNK.MAX_FILES,
  fieldName: UPLOAD_LIMITS.CHUNK.FIELD_NAME,
});

const chunkUpload = multer(chunkUploadConfig);

/**
 * @route   GET /api/resumable/limits
 * @desc    Get upload limits for resumable uploads
 * @access  Private
 */
router.get("/limits", getUploadLimits);

/**
 * @route   POST /api/resumable/meeting/:meetingId/start
 * @desc    Start a new resumable upload session
 * @access  Private
 */
router.post("/meeting/:meetingId/start", startResumableUpload);

/**
 * @route   POST /api/resumable/meeting/:meetingId/upload/:uploadId
 * @desc    Upload a chunk
 * @access  Private
 * @limits  Max 100MB per chunk
 */
router.post(
  "/meeting/:meetingId/upload/:uploadId",
  chunkUpload.single("chunk"),
  uploadChunk,
  handleMulterError,
);

/**
 * @route   POST /api/resumable/meeting/:meetingId/complete/:uploadId
 * @desc    Complete resumable upload and assemble chunks
 * @access  Private
 */
router.post("/meeting/:meetingId/complete/:uploadId", completeResumableUpload);

/**
 * @route   GET /api/resumable/meeting/:meetingId/status/:uploadId
 * @desc    Get upload status
 * @access  Private
 */
router.get("/meeting/:meetingId/status/:uploadId", getUploadStatus);

/**
 * @route   DELETE /api/resumable/meeting/:meetingId/cancel/:uploadId
 * @desc    Cancel resumable upload
 * @access  Private
 */
router.delete("/meeting/:meetingId/cancel/:uploadId", cancelResumableUpload);

export default router;
