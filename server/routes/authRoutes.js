import express from "express";
import {
  register,
  login,
  logout,
  sendVerifyOtp,
  verifyEmail,
  isAuthenticated,
  sendResetOtp,
  resetPassword,
  getUserData,
} from "../controllers/authControllers.js";

import userAuth from "../middleware/userAuth.js";
import {
  loginLimiter,
  registerLimiter,
  otpLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

// ✅ Auth routes with rate limiting
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

// ✅ Verification & password reset with rate limiting
router.post("/send-verify-otp", otpLimiter, userAuth, sendVerifyOtp);
router.post("/verify-email", otpLimiter, userAuth, verifyEmail);
router.post("/send-reset-otp", otpLimiter, sendResetOtp);
router.post("/reset-password", otpLimiter, resetPassword);

// ✅ Dashboard & auth status
router.get("/user-data", userAuth, getUserData);

// 🔥 FIXED: Add this route for frontend login check
router.get("/is-auth", userAuth, isAuthenticated);

// ✅ CSRF Token route for frontend
router.get("/csrf", (req, res) => {
  try {
    const csrfToken = req.csrfToken ? req.csrfToken() : null;
    res.json({ success: true, csrfToken });
  } catch (error) {
    // CSRF is bypassed in development, return success without token
    res.json({ success: true, csrfToken: null, message: "CSRF bypassed in development" });
  }
});

export default router;
