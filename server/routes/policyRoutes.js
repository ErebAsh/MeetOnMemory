import express from "express";
import multer from "multer";
import path from "path";
import userAuth from "../middleware/userAuth.js";
import {
  uploadPolicy,
  getPolicies,
  downloadPolicy,
  deletePolicy,
  analyzePolicy,
} from "../controllers/policyController.js";

const router = express.Router();

// ──────────────────────────────────────────────
// Multer Config — disk storage with validation
// ──────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/policies/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Unsupported file type: ${path.extname(file.originalname) || file.mimetype}. Only PDF, DOCX, and TXT files are allowed.`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Multer error handler helper
const handleMulterUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum allowed size is 20 MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.field || err.message || "File upload error.",
      });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

// Public (read-only)
router.get("/", getPolicies);

// Protected — require authentication
router.post("/upload", userAuth, handleMulterUpload, uploadPolicy);
router.post("/:id/analyze", userAuth, analyzePolicy);
router.get("/download/:id", userAuth, downloadPolicy);
router.delete("/:id", userAuth, deletePolicy);

export default router;
