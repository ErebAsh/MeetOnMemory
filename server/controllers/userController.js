import userModel from "../models/userModel.js";

// Helper to format user response consistently
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
      .populate("organization", "name");

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
      .populate("organization", "name");

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
