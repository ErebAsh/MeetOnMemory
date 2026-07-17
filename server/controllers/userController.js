import userModel from "../models/userModel.js";
import { dataExportQueue } from "../services/queueService.js";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const formatUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isAccountVerified: user.isAccountVerified,
    role: user.role,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    organization: user.organization,
    profilePic: user.profilePic || "",
    bio: user.bio || "",
    createdAt: user.createdAt,
  };
};

// @desc    Get user data
// @route   GET /api/user/get-user
// @access  Private
export const getUserData = async (req, res) => {
  try {
    // --- SAFETY CHECK ---
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    // Now this line is safe to run
    const user = await userModel
      .findById(req.user.id)
      .select("-password")
      .populate("organization", "name logo");

    if (user) {
      res.status(200).json({
        success: true,
        user: formatUserResponse(user),
      });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "User not found in database" });
    }
  } catch (error) {
    console.error("Error in getUserData:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update user profile
// @route   PUT /api/user/update
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const { name, profilePic, bio } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    // Validation
    if (!name || name.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required." });
    }

    if (profilePic && profilePic.trim() !== "") {
      let parsed;
      try {
        parsed = new URL(profilePic.trim());
      } catch {
        return res.status(400).json({
          success: false,
          message: "Profile picture must be a valid URL.",
        });
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({
          success: false,
          message: "Image URL must use http or https.",
        });
      }
    }

    const updatedUser = await userModel
      .findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            name: name.trim(),
            profilePic: profilePic ? profilePic.trim() : "",
            bio: bio ? bio.trim() : "",
          },
        },
        { new: true },
      )
      .populate("organization", "name logo");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Request data export
// @route   POST /api/user/request-data-export
// @access  Private
export const requestDataExport = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication error, user ID not found.",
      });
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (dataExportQueue) {
      await dataExportQueue.add("export", {
        userId: user._id.toString(),
        email: user.email,
      });
      
      return res.status(202).json({
        success: true,
        message: "Data export request accepted. You will receive an email when it is ready.",
      });
    } else {
      return res.status(503).json({
        success: false,
        message: "Background processing service is currently unavailable.",
      });
    }
  } catch (error) {
    console.error("Error in requestDataExport:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Download data export
// @route   GET /api/user/download-export/:token
// @access  Public (Token verification acts as auth)
export const downloadExport = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: "No token provided." });
    }

    const jwtSecret = process.env.JWT_SECRET || "fallback_secret";
    
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }

    const { fileName } = decoded;
    if (!fileName) {
      return res.status(400).json({ success: false, message: "Invalid token payload." });
    }

    const exportDir = path.join(__dirname, "..", "uploads", "exports");
    const filePath = path.join(exportDir, fileName);

    // Prevent directory traversal attacks
    if (!filePath.startsWith(exportDir)) {
      return res.status(403).json({ success: false, message: "Invalid file path." });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Export file not found or has been deleted." });
    }

    res.download(filePath, "data_export.zip", (err) => {
      if (err) {
        console.error("Error sending file:", err);
        // Don't send another response if headers are already sent
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Error downloading file." });
        }
      }
    });

  } catch (error) {
    console.error("Error in downloadExport:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
