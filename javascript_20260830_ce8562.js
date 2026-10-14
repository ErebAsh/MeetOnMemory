import express from "express";
import {
  createGuestAccess,
  getGuestMeetingView,
  guestDecryptTranscript,
  revokeGuestAccess,
  getGuestAccessStatus,
} from "../controllers/guestAccessController.js";
import { authenticateUser, requireOrganization } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/guest/meeting/:meetingId
 * @desc    Create guest access for a meeting
 * @access  Private (authenticated users only)
 */
router.post(
  "/meeting/:meetingId",
  authenticateUser,
  requireOrganization,
  createGuestAccess,
);

/**
 * @route   GET /api/guest/view/:token
 * @desc    Get guest meeting view (public endpoint)
 * @access  Public (guest token provides access)
 */
router.get("/view/:token", getGuestMeetingView);

/**
 * @route   POST /api/guest/decrypt/:token
 * @desc    Decrypt transcript for guest
 * @access  Public (guest token provides access)
 */
router.post("/decrypt/:token", guestDecryptTranscript);

/**
 * @route   DELETE /api/guest/revoke/:token
 * @desc    Revoke guest access
 * @access  Private (authenticated users only)
 */
router.delete(
  "/revoke/:token",
  authenticateUser,
  requireOrganization,
  revokeGuestAccess,
);

/**
 * @route   GET /api/guest/status/:token
 * @desc    Get guest access status
 * @access  Public
 */
router.get("/status/:token", getGuestAccessStatus);

export default router;
