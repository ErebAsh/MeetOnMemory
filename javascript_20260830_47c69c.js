import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File size limits (in bytes)
export const UPLOAD_LIMITS = {
  // Meeting recording uploads
  RECORDING: {
    MAX_SIZE: 500 * 1024 * 1024, // 500MB
    MAX_FILES: 1,
    FIELD_NAME: "recording",
  },
  // Audio uploads (for transcription)
  AUDIO: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_FILES: 1,
    FIELD_NAME: "audio",
  },
  // Resumable chunk uploads
  CHUNK: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB per chunk
    MAX_FILES: 1,
    FIELD_NAME: "chunk",
  },
  // Transcript uploads
  TRANSCRIPT: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_FILES: 1,
    FIELD_NAME: "transcript",
  },
  // General file uploads
  GENERAL: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES: 5,
    FIELD_NAME: "files",
  },
};

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
  // Audio/Video recordings
  RECORDING: [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/aac",
    "audio/flac",
    "audio/opus",
  ],
  // Audio only
  AUDIO: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/aac",
    "audio/flac",
    "audio/ogg",
    "audio/webm",
    "audio/opus",
  ],
  // Transcript files
  TRANSCRIPT: [
    "text/plain",
    "text/csv",
    "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/msword", // .doc
    "application/pdf",
  ],
  // General files
  GENERAL: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
};

// Human-readable file size formatter
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// File size validation error messages
export const getSizeErrorMessage = (maxSize, type = "file") => {
  const maxSizeFormatted = formatFileSize(maxSize);
  return `${type} size exceeds maximum allowed size of ${maxSizeFormatted}. Please reduce the file size and try again.`;
};

// Ensure upload directory exists
export const ensureUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created upload directory: ${dirPath}`);
  }
};

// Create multer storage configuration
export const createStorage = (destination) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), "uploads", destination);
      ensureUploadDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    },
  });
};

// Generic multer configuration creator
export const createMulterConfig = ({
  destination = "uploads",
  maxSize = UPLOAD_LIMITS.GENERAL.MAX_SIZE,
  maxFiles = UPLOAD_LIMITS.GENERAL.MAX_FILES,
  allowedMimeTypes = ALLOWED_MIME_TYPES.GENERAL,
  fieldName = "file",
}) => {
  const storage = createStorage(destination);

  const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(", ")}`,
      );
      error.code = "FILE_TYPE_NOT_ALLOWED";
      cb(error, false);
    }
  };

  const limits = {
    fileSize: maxSize,
    files: maxFiles,
    fieldSize: maxSize,
  };

  return {
    storage,
    fileFilter,
    limits,
  };
};

// Helper to handle multer errors
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(413).json({
          success: false,
          error: getSizeErrorMessage(
            err.limit || UPLOAD_LIMITS.GENERAL.MAX_SIZE,
          ),
          code: "FILE_TOO_LARGE",
          maxSize: err.limit || UPLOAD_LIMITS.GENERAL.MAX_SIZE,
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          error: "Too many files uploaded",
          code: "TOO_MANY_FILES",
        });
      case "LIMIT_FIELD_KEY":
        return res.status(400).json({
          success: false,
          error: "Invalid field name",
          code: "INVALID_FIELD",
        });
      case "LIMIT_FIELD_VALUE":
        return res.status(400).json({
          success: false,
          error: "Field value too large",
          code: "FIELD_TOO_LARGE",
        });
      case "LIMIT_FIELD_COUNT":
        return res.status(400).json({
          success: false,
          error: "Too many fields",
          code: "TOO_MANY_FIELDS",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          error: "Unexpected file field",
          code: "UNEXPECTED_FILE",
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
          code: err.code,
        });
    }
  }

  if (err.code === "FILE_TYPE_NOT_ALLOWED") {
    return res.status(415).json({
      success: false,
      error: err.message,
      code: "FILE_TYPE_NOT_ALLOWED",
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    error: "Upload failed",
    details: err.message,
  });
};

// Validate file size before upload (for resumable uploads)
export const validateChunkSize = (
  chunkSize,
  maxSize = UPLOAD_LIMITS.CHUNK.MAX_SIZE,
) => {
  if (chunkSize > maxSize) {
    throw new Error(getSizeErrorMessage(maxSize, "Chunk"));
  }
  return true;
};

// Get current upload limits for client
export const getUploadLimits = () => {
  return {
    recording: {
      maxSize: UPLOAD_LIMITS.RECORDING.MAX_SIZE,
      maxSizeFormatted: formatFileSize(UPLOAD_LIMITS.RECORDING.MAX_SIZE),
      allowedTypes: ALLOWED_MIME_TYPES.RECORDING,
    },
    audio: {
      maxSize: UPLOAD_LIMITS.AUDIO.MAX_SIZE,
      maxSizeFormatted: formatFileSize(UPLOAD_LIMITS.AUDIO.MAX_SIZE),
      allowedTypes: ALLOWED_MIME_TYPES.AUDIO,
    },
    chunk: {
      maxSize: UPLOAD_LIMITS.CHUNK.MAX_SIZE,
      maxSizeFormatted: formatFileSize(UPLOAD_LIMITS.CHUNK.MAX_SIZE),
    },
    transcript: {
      maxSize: UPLOAD_LIMITS.TRANSCRIPT.MAX_SIZE,
      maxSizeFormatted: formatFileSize(UPLOAD_LIMITS.TRANSCRIPT.MAX_SIZE),
      allowedTypes: ALLOWED_MIME_TYPES.TRANSCRIPT,
    },
    general: {
      maxSize: UPLOAD_LIMITS.GENERAL.MAX_SIZE,
      maxSizeFormatted: formatFileSize(UPLOAD_LIMITS.GENERAL.MAX_SIZE),
      allowedTypes: ALLOWED_MIME_TYPES.GENERAL,
    },
  };
};

export default {
  UPLOAD_LIMITS,
  ALLOWED_MIME_TYPES,
  formatFileSize,
  getSizeErrorMessage,
  ensureUploadDir,
  createStorage,
  createMulterConfig,
  handleMulterError,
  validateChunkSize,
  getUploadLimits,
};
