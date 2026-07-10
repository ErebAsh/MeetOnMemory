import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";
import { createRequire } from "module";
import Policy from "../models/policyModel.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config();

const UPLOAD_DIR = path.resolve("uploads/policies");
const UPLOAD_ROOT = UPLOAD_DIR;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Validates a file path to prevent directory traversal attacks (CWE-22).
 * Ensures that the resolved path is strictly within UPLOAD_ROOT.
 *
 * @param {string} filePath - Path to be validated
 * @returns {string} Fully resolved safe absolute path
 */
function validateUploadPath(filePath) {
  if (!filePath) {
    throw new Error("Path is empty or undefined");
  }
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(UPLOAD_ROOT, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal detected: Access denied");
  }
  return resolvedPath;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// ─────────────────────────────────────────────────────────────
// Helper — strip markdown code fences that Gemini sometimes adds
// ─────────────────────────────────────────────────────────────
const extractJson = (raw) => {
  if (!raw) return "{}";
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
};

// ─────────────────────────────────────────────────────────────
// Helper — Call Gemini to summarize and extract keywords
// ─────────────────────────────────────────────────────────────
const generatePolicySummary = async (fileName, textContent) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const prompt = `
You are an AI compliance analyst. Analyze the policy document content below and return a structured JSON like this:
{
  "summary": "2–3 paragraph concise summary describing the document's purpose, scope, and main clauses.",
  "key_changes": ["List of main changes or revisions if applicable, otherwise leave as empty array."],
  "keywords": ["Short tags describing policy topics (5–10 tags)"]
}

Policy File Name: ${fileName}

Policy Text Content:
${textContent?.slice(0, 6000)}

Return ONLY valid JSON (no commentary, no markdown fences). Use a professional, compliance-focused tone.
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 30000 },
    );

    const rawText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = extractJson(rawText);

    const parsed = JSON.parse(cleanedText);

    // Validate expected shape
    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "AI summary could not be generated for this document.",
      key_changes: Array.isArray(parsed.key_changes) ? parsed.key_changes : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch (error) {
    console.error("❌ Gemini summarization failed:", error.message);

    // Distinguish error types for better logging
    if (error.response?.status === 429) {
      console.warn("⚠️ Gemini rate limit exceeded.");
    } else if (error.response?.status === 400) {
      console.warn("⚠️ Gemini bad request — likely invalid prompt content.");
    } else if (error.code === "ECONNABORTED") {
      console.warn("⚠️ Gemini request timed out.");
    }

    return {
      summary:
        "AI summary generation failed. You can retry analysis from the policy detail view.",
      key_changes: [],
      keywords: [],
    };
  }
};

// ─────────────────────────────────────────────────────────────
// Helper — Extract text from uploaded file
// ─────────────────────────────────────────────────────────────
const extractTextFromFile = async (filePath, mimetype) => {
  try {
    const safePath = validateUploadPath(filePath);
    if (
      mimetype === "application/pdf" ||
      safePath.toLowerCase().endsWith(".pdf")
    ) {
      const pdfBuffer = fs.readFileSync(safePath);
      const data = await pdf(pdfBuffer);
      return data.text || "";
    }
    // For DOCX/TXT — fallback to raw read
    return fs.readFileSync(safePath, "utf8").toString();
  } catch (err) {
    console.warn("⚠️ Text extraction failed:", err.message);
    return "";
  }
};

// ─────────────────────────────────────────────────────────────
// 🟢 Upload & Process Policy
// ─────────────────────────────────────────────────────────────
export const uploadPolicy = async (req, res) => {
  let savedFilePath = null;

  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const fileName = req.file.originalname;
    const fileUrl = path.join(UPLOAD_DIR, req.file.filename);
    const safeFileUrl = validateUploadPath(fileUrl);
    const commitMsg = req.body.commitMsg?.trim() || "";
    const uploaderId = req.user._id; // guaranteed by userAuth middleware

    savedFilePath = safeFileUrl;

    // 1️⃣ Extract text
    const textContent = await extractTextFromFile(
      safeFileUrl,
      req.file.mimetype,
    );

    // 2️⃣ Generate AI summary + metadata
    console.log(`📡 Calling Gemini for AI summary — "${fileName}"...`);
    const aiData = await generatePolicySummary(fileName, textContent);
    console.log("✅ Gemini summary complete.");

    // 3️⃣ Versioning — update if file with same name already exists
    const existing = await Policy.findOne({ name: fileName });

    if (existing) {
      // Snapshot the current version before overwriting
      existing.previousVersions.push({
        name: existing.name,
        version: existing.version,
        fileUrl: existing.fileUrl,
        commitMsg: existing.commitMsg,
        summary: existing.summary,
        key_changes: existing.key_changes,
        keywords: existing.keywords,
        uploadedBy: existing.uploadedBy,
        organization: existing.organization,
        createdAt: existing.createdAt,
      });

      const nextVersion = (parseFloat(existing.version) + 0.1).toFixed(1);
      existing.version = nextVersion;
      existing.fileUrl = safeFileUrl;
      existing.summary = aiData.summary;
      existing.key_changes = aiData.key_changes;
      existing.keywords = aiData.keywords;
      existing.commitMsg = commitMsg;
      existing.lastEditedBy = uploaderId;
      existing.status = "ready";
      await existing.save();

      // Re-populate for response
      await existing.populate("uploadedBy", "name email");
      await existing.populate("lastEditedBy", "name email");

      return res.status(200).json({
        success: true,
        message: "Policy updated and analyzed by AI.",
        policyId: existing._id,
        policy: existing,
      });
    }

    // 4️⃣ Create new policy
    const policy = await Policy.create({
      name: fileName,
      version: "1.0",
      fileUrl: safeFileUrl,
      summary: aiData.summary,
      key_changes: aiData.key_changes,
      keywords: aiData.keywords,
      commitMsg,
      uploadedBy: uploaderId,
      lastEditedBy: uploaderId,
      organization: req.user.organization || null,
      status: "ready",
    });

    await policy.populate("uploadedBy", "name email");
    await policy.populate("lastEditedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Policy uploaded and analyzed successfully.",
      policyId: policy._id,
      policy,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);

    // Clean up the uploaded file if DB operation failed
    if (savedFilePath) {
      try {
        const safePath = validateUploadPath(savedFilePath);
        if (fs.existsSync(safePath)) {
          fs.unlinkSync(safePath);
        }
      } catch (_) {
        // ignore cleanup errors
      }
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid policy data: " + error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error during upload. Please try again.",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// 🤖 Re-analyze Policy (on-demand AI retry)
// ─────────────────────────────────────────────────────────────
export const analyzePolicy = async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    if (!policy) {
      return res
        .status(404)
        .json({ success: false, message: "Policy not found." });
    }

    const safeFileUrl = validateUploadPath(policy.fileUrl);

    if (!fs.existsSync(safeFileUrl)) {
      return res.status(404).json({
        success: false,
        message: "Policy file not found on disk. Cannot re-analyze.",
      });
    }

    // Mark as processing
    policy.status = "processing";
    await policy.save();

    // Extract text and analyze (non-blocking response pattern)
    const textContent = await extractTextFromFile(safeFileUrl, null);
    const aiData = await generatePolicySummary(policy.name, textContent);

    policy.summary = aiData.summary;
    policy.key_changes = aiData.key_changes;
    policy.keywords = aiData.keywords;
    policy.status = "ready";
    await policy.save();

    return res.status(200).json({
      success: true,
      message: "Policy re-analyzed successfully.",
      summary: aiData.summary,
      keywords: aiData.keywords,
    });
  } catch (error) {
    console.error("❌ Analyze policy error:", error);

    // Try to reset status to failed
    try {
      await Policy.findByIdAndUpdate(req.params.id, { status: "failed" });
    } catch (_) {
      // ignore
    }

    return res.status(500).json({
      success: false,
      message: "AI processing failed. Please try again later.",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// 🟢 Get All Policies
// ─────────────────────────────────────────────────────────────
export const getPolicies = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const queryOptions = [{ uploadedBy: userId }];
    if (req.user?.organization) {
      queryOptions.push({ organization: req.user.organization });
    }

    const policies = await Policy.find({ $or: queryOptions })
      .populate("uploadedBy", "name email")
      .populate("lastEditedBy", "name email")
      .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, policies });
  } catch (error) {
    console.error("❌ Fetch policies error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch policies. Please refresh and try again.",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// 🟢 Download Policy File
// ─────────────────────────────────────────────────────────────
export const downloadPolicy = async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    if (!policy) {
      return res
        .status(404)
        .json({ success: false, message: "Policy not found." });
    }

    const safeFileUrl = validateUploadPath(policy.fileUrl);

    if (!fs.existsSync(safeFileUrl)) {
      return res.status(404).json({
        success: false,
        message: "Policy file is no longer available on the server.",
      });
    }

    return res.download(safeFileUrl, policy.name);
  } catch (error) {
    console.error("❌ Download error:", error);
    return res.status(500).json({
      success: false,
      message: "Download failed. Please try again.",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// 🗑️ Delete Policy
// ─────────────────────────────────────────────────────────────
export const deletePolicy = async (req, res) => {
  try {
    const policy = req.doc || (await Policy.findById(req.params.id));
    if (!policy) {
      return res
        .status(404)
        .json({ success: false, message: "Policy not found." });
    }

    // Delete current file from disk
    try {
      const safeFileUrl = validateUploadPath(policy.fileUrl);
      if (fs.existsSync(safeFileUrl)) {
        fs.unlinkSync(safeFileUrl);
      }
    } catch (fsErr) {
      console.warn("⚠️ Could not delete policy file:", fsErr.message);
    }

    // Also remove previous version files from disk
    for (const v of policy.previousVersions || []) {
      if (v.fileUrl) {
        try {
          const safeVersionUrl = validateUploadPath(v.fileUrl);
          if (fs.existsSync(safeVersionUrl)) {
            fs.unlinkSync(safeVersionUrl);
          }
        } catch (_) {
          // non-fatal
        }
      }
    }

    await policy.deleteOne();
    return res.status(200).json({
      success: true,
      message: "Policy deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Delete policy error:", error);
    return res.status(500).json({
      success: false,
      message: "Delete failed. Please try again.",
    });
  }
};
