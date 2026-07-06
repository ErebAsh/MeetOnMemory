import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import userModel from "../models/userModel.js";
import transporter from "../config/nodeMailer.js";
import {
  EMAIL_VERIFY_TEMPLATE,
  PASSWORD_RESET_TEMPLATE,
} from "../config/emailTemplates.js";

// --------------------------- HELPERS ---------------------------
const sendBackgroundEmail = (mailOptions, flowName) => {
  transporter.sendMail(mailOptions).catch((err) => {
    console.error(`Background email transmission failed [${flowName}]:`, err);
  });
};

const validateFields = (fields, res) => {
  const missing = Object.entries(fields).filter(([_, val]) => !val);
  if (missing.length > 0) {
    res.json({ success: false, message: "Missing details" });
    return false;
  }
  return true;
};

const normalizeEmail = (email) => String(email).trim().toLowerCase();

// --------------------------- REGISTER ---------------------------
export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!validateFields({ name, email, password }, res)) return;

  try {
    const cleanEmail = normalizeEmail(email);
    const existingUser = await userModel.findOne({ email: cleanEmail }).select('_id').lean();
    if (existingUser)
      return res.json({ success: false, message: "User already exists" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new userModel({ name, email: cleanEmail, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendBackgroundEmail({
      from: process.env.SENDER_EMAIL,
      to: cleanEmail,
      subject: "Welcome to MeetOnMemory!",
      text: `Welcome to MeetOnMemory, ${name}! Your account has been successfully created.`,
    }, "Register");

    return res.json({ success: true, message: "Registration successful" });
  } catch (error) {
    console.error("Register error:", error);
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- LOGIN ---------------------------
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!validateFields({ email, password }, res)) return;

  try {
    const cleanEmail = normalizeEmail(email);
    const user = await userModel.findOne({ email: cleanEmail }).lean();
    if (!user) return res.json({ success: false, message: "Invalid Email" });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "Invalid Password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- LOGOUT ---------------------------
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- SEND VERIFY OTP ---------------------------
export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req;
    const user = await userModel.findById(userId);
    
    if (!user) return res.json({ success: false, message: "Authentication failed" });
    if (user.isAccountVerified)
      return res.json({ success: false, message: "Account already verified" });

    const otp = randomInt(100000, 1000000).toString();
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Account Verification OTP",
      html: EMAIL_VERIFY_TEMPLATE.replace("{{otp}}", otp).replace("{{email}}", user.email),
    });

    res.json({ success: true, message: "Verification OTP sent on email" });
  } catch (error) {
    console.error("SendVerifyOtp error:", error);
    res.json({ success: false, message: "Failed to send verification OTP" });
  }
};

// --------------------------- VERIFY EMAIL ---------------------------
export const verifyEmail = async (req, res) => {
  const { otp } = req.body;
  const { userId } = req;
  if (!validateFields({ userId, otp }, res)) return;

  try {
    const user = await userModel.findById(userId);
    if (!user) return res.json({ success: false, message: "Verification session invalid" });
    if (user.verifyOtp === "" || user.verifyOtp !== otp)
      return res.json({ success: false, message: "Invalid OTP" });
    if (user.verifyOtpExpireAt < Date.now())
      return res.json({ success: false, message: "OTP expired" });

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;
    await user.save();

    return res.json({ success: true, message: "Email verified successfully!" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- CHECK AUTH ---------------------------
export const isAuthenticated = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- SEND PASSWORD RESET OTP ---------------------------
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!validateFields({ email }, res)) return;

  try {
    const cleanEmail = normalizeEmail(email);
    const user = await userModel.findOne({ email: cleanEmail });
    
    if (!user) {
      return res.json({ success: true, message: "OTP sent to your email" });
    }

    const otp = randomInt(100000, 1000000).toString();
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Password Reset OTP",
      html: PASSWORD_RESET_TEMPLATE.replace("{{otp}}", otp).replace("{{email}}", user.email),
    });

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("SendResetOtp error:", error);
    res.json({ success: false, message: "Failed to process password reset request" });
  }
};

// --------------------------- RESET PASSWORD ---------------------------
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!validateFields({ email, otp, newPassword }, res)) return;

  try {
    const cleanEmail = normalizeEmail(email);
    const user = await userModel.findOne({ email: cleanEmail });
    
    if (!user) return res.json({ success: false, message: "Invalid request or expired token" });
    if (user.resetOtp === "" || user.resetOtp !== otp)
      return res.json({ success: false, message: "Invalid OTP" });
    if (user.resetOtpExpireAt < Date.now())
      return res.json({ success: false, message: "OTP expired" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;
    await user.save();

    return res.json({ success: true, message: "Password has been reset successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- GET USER DATA (For Dashboard) ---------------------------
export const getUserData = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user.id)
      .populate("organization", "name")
      .lean();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};