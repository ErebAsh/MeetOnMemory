import fs from "fs";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";
import {
  UPLOAD_LIMITS,
  validateChunkSize,
  formatFileSize,
  ensureUploadDir,
  getSizeErrorMessage,
} from "../config/uploadConfig.js";
import logger from "../utils/logger.js";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

// Map to track active upload sessions
const uploadSessions = new Map();

/**
 * Initialize or get upload session
 */
const getUploadSession = (uploadId, meetingId) => {
  const sessionKey = `${uploadId}-${meetingId}`;
  if (!uploadSessions.has(sessionKey)) {
    const sessionDir = path.join(
      process.cwd(),
      "uploads",
      "chunks",
      meetingId,
      uploadId,
    );
    ensureUploadDir(sessionDir);

    uploadSessions.set(sessionKey, {
      uploadId,
      meetingId,
      sessionDir,
      totalChunks: 0,
      uploadedChunks: new Set(),
      totalSize: 0,
      filename: null,
      startedAt: new Date(),
      lastChunkAt: new Date(),
    });
  }
  return uploadSessions.get(sessionKey);
};

/**
 * Start a new resumable upload session
 */
export const startResumableUpload = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { filename, totalChunks, totalSize } = req.body;

    if (!meetingId || !filename || !totalChunks || !totalSize) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: meetingId, filename, totalChunks, totalSize",
      });
    }

    // Validate total size
    const maxSize = UPLOAD_LIMITS.CHUNK.MAX_SIZE * totalChunks;
    if (totalSize > maxSize) {
      return res.status(413).json({
        success: false,
        error: getSizeErrorMessage(maxSize, "Total upload"),
        code: "FILE_TOO_LARGE",
        maxSize: maxSize,
        maxSizeFormatted: formatFileSize(maxSize),
        totalSize: totalSize,
        totalSizeFormatted: formatFileSize(totalSize),
      });
    }

    // Generate unique upload ID
    const uploadId = crypto.randomBytes(16).toString("hex");
    const session = getUploadSession(uploadId, meetingId);
    session.filename = filename;
    session.totalChunks = totalChunks;
    session.totalSize = totalSize;

    logger.info(
      `Resumable upload started: ${uploadId} for meeting ${meetingId}`,
    );

    res.json({
      success: true,
      data: {
        uploadId,
        meetingId,
        filename,
        totalChunks,
        totalSize,
        maxSize: maxSize,
        maxSizeFormatted: formatFileSize(maxSize),
        uploadedChunks: [],
        chunkSize: UPLOAD_LIMITS.CHUNK.MAX_SIZE,
      },
    });
  } catch (error) {
    logger.error("Error starting resumable upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start upload session",
      details: error.message,
    });
  }
};

/**
 * Upload a chunk for resumable upload
 */
export const uploadChunk = async (req, res) => {
  try {
    const { meetingId, uploadId } = req.params;
    const { chunkIndex, totalChunks, filename } = req.body;
    const chunkFile = req.file;

    if (!uploadId || chunkIndex === undefined || !chunkFile) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: uploadId, chunkIndex, file",
      });
    }

    // Validate chunk size
    const chunkSize = chunkFile.size;
    validateChunkSize(chunkSize, UPLOAD_LIMITS.CHUNK.MAX_SIZE);

    // Get session
    const session = getUploadSession(uploadId, meetingId);

    // Validate chunk index
    const index = parseInt(chunkIndex);
    if (session.uploadedChunks.has(index)) {
      return res.status(409).json({
        success: false,
        error: `Chunk ${index} already uploaded`,
        code: "CHUNK_ALREADY_UPLOADED",
      });
    }

    // Save chunk
    const chunkPath = path.join(session.sessionDir, `chunk-${index}`);
    await writeFile(chunkPath, chunkFile.buffer);
    session.uploadedChunks.add(index);
    session.lastChunkAt = new Date();

    // Update session if total chunks provided
    if (totalChunks) {
      session.totalChunks = parseInt(totalChunks);
    }
    if (filename) {
      session.filename = filename;
    }

    logger.info(`Chunk ${index} uploaded for session ${uploadId}`);

    // Check if all chunks are uploaded
    const isComplete = session.uploadedChunks.size === session.totalChunks;

    res.json({
      success: true,
      data: {
        uploadId,
        chunkIndex: index,
        uploadedChunks: Array.from(session.uploadedChunks),
        totalChunks: session.totalChunks,
        isComplete,
        progress: Math.round(
          (session.uploadedChunks.size / session.totalChunks) * 100,
        ),
      },
    });
  } catch (error) {
    logger.error("Error uploading chunk:", error);

    if (error.message.includes("exceeds maximum allowed")) {
      return res.status(413).json({
        success: false,
        error: error.message,
        code: "CHUNK_TOO_LARGE",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to upload chunk",
      details: error.message,
    });
  }
};

/**
 * Complete resumable upload - assemble chunks
 */
export const completeResumableUpload = async (req, res) => {
  try {
    const { meetingId, uploadId } = req.params;

    const session = getUploadSession(uploadId, meetingId);

    // Verify all chunks uploaded
    if (session.uploadedChunks.size !== session.totalChunks) {
      return res.status(400).json({
        success: false,
        error: "Not all chunks uploaded",
        code: "INCOMPLETE_UPLOAD",
        uploaded: session.uploadedChunks.size,
        total: session.totalChunks,
        missing: session.totalChunks - session.uploadedChunks.size,
      });
    }

    // Assemble chunks
    const outputDir = path.join(
      process.cwd(),
      "uploads",
      "recordings",
      meetingId,
    );
    ensureUploadDir(outputDir);

    const outputPath = path.join(outputDir, session.filename);
    const writeStream = fs.createWriteStream(outputPath);

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.sessionDir, `chunk-${i}`);
      const chunkData = await readFile(chunkPath);
      writeStream.write(chunkData);
    }

    await new Promise((resolve, reject) => {
      writeStream.end((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Get file stats
    const stats = await stat(outputPath);

    // Clean up chunks
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.sessionDir, `chunk-${i}`);
      try {
        await unlink(chunkPath);
      } catch (err) {
        logger.warn(`Failed to delete chunk ${i}:`, err);
      }
    }

    // Clean up session dir
    try {
      await fs.promises.rmdir(session.sessionDir);
    } catch (err) {
      logger.warn(`Failed to delete session dir:`, err);
    }

    // Remove session
    uploadSessions.delete(`${uploadId}-${meetingId}`);

    logger.info(
      `Resumable upload completed: ${uploadId} for meeting ${meetingId}`,
    );

    res.json({
      success: true,
      data: {
        uploadId,
        meetingId,
        filename: session.filename,
        path: outputPath,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error completing resumable upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete upload",
      details: error.message,
    });
  }
};

/**
 * Get upload status
 */
export const getUploadStatus = async (req, res) => {
  try {
    const { meetingId, uploadId } = req.params;

    const session = getUploadSession(uploadId, meetingId);

    const data = {
      uploadId: session.uploadId,
      meetingId: session.meetingId,
      filename: session.filename,
      totalChunks: session.totalChunks,
      uploadedChunks: Array.from(session.uploadedChunks),
      progress: Math.round(
        (session.uploadedChunks.size / session.totalChunks) * 100,
      ),
      startedAt: session.startedAt,
      lastChunkAt: session.lastChunkAt,
      isComplete: session.uploadedChunks.size === session.totalChunks,
      totalSize: session.totalSize,
      totalSizeFormatted: formatFileSize(session.totalSize),
    };

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Error getting upload status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get upload status",
      details: error.message,
    });
  }
};

/**
 * Cancel resumable upload
 */
export const cancelResumableUpload = async (req, res) => {
  try {
    const { meetingId, uploadId } = req.params;

    const session = getUploadSession(uploadId, meetingId);

    // Delete all chunks
    for (const chunkIndex of session.uploadedChunks) {
      const chunkPath = path.join(session.sessionDir, `chunk-${chunkIndex}`);
      try {
        await unlink(chunkPath);
      } catch (err) {
        logger.warn(`Failed to delete chunk ${chunkIndex}:`, err);
      }
    }

    // Delete session dir
    try {
      await fs.promises.rmdir(session.sessionDir);
    } catch (err) {
      logger.warn(`Failed to delete session dir:`, err);
    }

    // Remove session
    uploadSessions.delete(`${uploadId}-${meetingId}`);

    logger.info(`Resumable upload cancelled: ${uploadId}`);

    res.json({
      success: true,
      message: "Upload cancelled successfully",
    });
  } catch (error) {
    logger.error("Error cancelling upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel upload",
      details: error.message,
    });
  }
};

/**
 * Get upload limits for client
 */
export const getUploadLimits = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        chunkSize: UPLOAD_LIMITS.CHUNK.MAX_SIZE,
        chunkSizeFormatted: formatFileSize(UPLOAD_LIMITS.CHUNK.MAX_SIZE),
        maxTotalSize: UPLOAD_LIMITS.RECORDING.MAX_SIZE,
        maxTotalSizeFormatted: formatFileSize(UPLOAD_LIMITS.RECORDING.MAX_SIZE),
        allowedTypes: ALLOWED_MIME_TYPES.RECORDING,
      },
    });
  } catch (error) {
    logger.error("Error getting upload limits:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get upload limits",
      details: error.message,
    });
  }
};
