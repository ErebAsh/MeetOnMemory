import express from "express";
import {
  getMeetingAnalytics,
  getMeetingAttendanceAnalytics,
  getMeetingTranscriptAnalytics,
  getMeetingActionItemsAnalytics,
  getMeetingEngagementAnalytics,
  getMeetingExportAnalytics,
  getOrganizationMeetingAnalytics,
} from "../controllers/analyticsController.js";
import { authenticateUser, requireOrganization } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication middleware
router.use(authenticateUser);
router.use(requireOrganization);

/**
 * @route   GET /api/analytics/meetings/:id
 * @desc    Get comprehensive analytics for a meeting
 * @access  Private
 */
router.get("/meetings/:id", getMeetingAnalytics);

/**
 * @route   GET /api/analytics/meetings/:id/attendance
 * @desc    Get attendance analytics for a meeting
 * @access  Private
 */
router.get("/meetings/:id/attendance", getMeetingAttendanceAnalytics);

/**
 * @route   GET /api/analytics/meetings/:id/transcript
 * @desc    Get transcript analytics for a meeting
 * @access  Private
 */
router.get("/meetings/:id/transcript", getMeetingTranscriptAnalytics);

/**
 * @route   GET /api/analytics/meetings/:id/action-items
 * @desc    Get action items analytics for a meeting
 * @access  Private
 */
router.get("/meetings/:id/action-items", getMeetingActionItemsAnalytics);

/**
 * @route   GET /api/analytics/meetings/:id/engagement
 * @desc    Get engagement analytics for a meeting
 * @access  Private
 */
router.get("/meetings/:id/engagement", getMeetingEngagementAnalytics);

/**
 * @route   GET /api/analytics/meetings/:id/export
 * @desc    Export meeting analytics
 * @access  Private
 */
router.get("/meetings/:id/export", getMeetingExportAnalytics);

/**
 * @route   GET /api/analytics/organization
 * @desc    Get organization-wide meeting analytics
 * @access  Private
 */
router.get("/organization", getOrganizationMeetingAnalytics);

export default router;
