import fs from "fs";
import path from "path";
import { promisify } from "util";
import {
  UPLOAD_LIMITS,
  ALLOWED_MIME_TYPES,
  formatFileSize,
  getSizeErrorMessage,
  ensureUploadDir,
} from "../config/uploadConfig.js";
import logger from "../utils/logger.js";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

/**
 * Upload transcript file with size validation
 */
export const uploadTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // Validate file size
    const maxSize = UPLOAD_LIMITS.TRANSCRIPT.MAX_SIZE;
    if (file.size > maxSize) {
      // Delete uploaded file
      try {
        await unlink(file.path);
      } catch (err) {
        logger.warn("Failed to delete oversized file:", err);
      }

      return res.status(413).json({
        success: false,
        error: getSizeErrorMessage(maxSize, "Transcript"),
        code: "FILE_TOO_LARGE",
        maxSize: maxSize,
        maxSizeFormatted: formatFileSize(maxSize),
        fileSize: file.size,
        fileSizeFormatted: formatFileSize(file.size),
      });
    }

    // Validate file type
    const allowedTypes = ALLOWED_MIME_TYPES.TRANSCRIPT;
    if (!allowedTypes.includes(file.mimetype)) {
      // Delete uploaded file
      try {
        await unlink(file.path);
      } catch (err) {
        logger.warn("Failed to delete invalid file:", err);
      }

      return res.status(415).json({
        success: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
        code: "FILE_TYPE_NOT_ALLOWED",
      });
    }

    // Save transcript metadata
    const transcriptDir = path.join(
      process.cwd(),
      "uploads",
      "transcripts",
      meetingId,
    );
    ensureUploadDir(transcriptDir);

    const newPath = path.join(transcriptDir, file.filename);
    fs.renameSync(file.path, newPath);

    const fileStats = await stat(newPath);

    logger.info(
      `Transcript uploaded for meeting ${meetingId}: ${file.originalname}`,
    );

    res.json({
      success: true,
      data: {
        filename: file.originalname,
        path: newPath,
        size: fileStats.size,
        sizeFormatted: formatFileSize(fileStats.size),
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error uploading transcript:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload transcript",
      details: error.message,
    });
  }
};

/**
 * Get transcript content
 */
export const getTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { format = "json" } = req.query;

    const transcriptDir = path.join(
      process.cwd(),
      "uploads",
      "transcripts",
      meetingId,
    );

    if (!fs.existsSync(transcriptDir)) {
      return res.status(404).json({
        success: false,
        error: "No transcript found for this meeting",
      });
    }

    // Find latest transcript
    const files = fs.readdirSync(transcriptDir);
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No transcript file found",
      });
    }

    const latestFile = files[files.length - 1];
    const filePath = path.join(transcriptDir, latestFile);
    const content = await readFile(filePath, "utf-8");

    if (format === "text") {
      return res.json({
        success: true,
        data: {
          content,
          filename: latestFile,
          format: "text",
        },
      });
    }

    // Try to parse as JSON
    try {
      const jsonContent = JSON.parse(content);
      res.json({
        success: true,
        data: {
          content: jsonContent,
          filename: latestFile,
          format: "json",
        },
      });
    } catch {
      // Return as text if not JSON
      res.json({
        success: true,
        data: {
          content,
          filename: latestFile,
          format: "text",
        },
      });
    }
  } catch (error) {
    logger.error("Error getting transcript:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get transcript",
      details: error.message,
    });
  }
};

/**
 * Delete transcript
 */
export const deleteTranscript = async (req, res) => {
  try {
    const { meetingId, filename } = req.params;

    const transcriptDir = path.join(
      process.cwd(),
      "uploads",
      "transcripts",
      meetingId,
    );
    const filePath = path.join(transcriptDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Transcript file not found",
      });
    }

    await unlink(filePath);
    logger.info(`Transcript deleted for meeting ${meetingId}: ${filename}`);

    res.json({
      success: true,
      message: "Transcript deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting transcript:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete transcript",
      details: error.message,
    });
  }
};

/**
 * Get transcript upload limits
 */
export const getTranscriptLimits = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        maxSize: UPLOAD_LIMITS.TRANSCRIPT.MAX_SIZE,
        maxSizeFormatted: formatFileSize(UPLOAD_LIMITS.TRANSCRIPT.MAX_SIZE),
        allowedTypes: ALLOWED_MIME_TYPES.TRANSCRIPT,
      },
    });
  } catch (error) {
    logger.error("Error getting transcript limits:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get transcript limits",
      details: error.message,
    });
  }
};
