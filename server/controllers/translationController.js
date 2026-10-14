import { translateContent } from "../services/translationService.js";
import {
  translateSegment,
  getUserPreferences,
  updateUserPreferences,
  submitCorrection,
  getMeetingTranslations,
  exportTranscript,
  getSupportedLanguages,
  getQualityMetrics,
} from "../services/realtimeTranslationService.js";
import TranslationCache from "../models/translationCacheModel.js";
import Meeting from "../models/meetingModel.js";
import mongoose from "mongoose";
import {
  sentimentAnalysisQueue,
  transcriptionQueue,
} from "../services/queueService.js";
/**
 * Translation Controller
 * Handles HTTP requests for both legacy bulk translation and real-time
 * multi-language synchronized translation endpoints.
 */

/**
 * Resolves a meeting and confirms the caller may act on it.
 *
 * Every handler in this file is meeting-scoped, and the real-time handlers
 * each carried their own copy of this check. The two legacy handlers carried
 * none: `requestTranslation` would translate any meeting's transcript for any
 * signed-in caller, and `clearTranslationCache` would delete any meeting's
 * cached translations (Issue #1563). Routing all of them through one helper
 * means a new handler cannot quietly skip the check.
 *
 * Writes the error response itself and returns null, so callers read as:
 *
 *   const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
 *   if (!meeting) return;
 *
 * @param {string} meetingId
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<object|null>} the meeting, or null if a response was sent
 */
const resolveAuthorizedMeeting = async (meetingId, req, res) => {
  if (!meetingId || !mongoose.isValidObjectId(meetingId)) {
    res.status(400).json({ message: "Invalid meeting ID" });
    return null;
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    res.status(404).json({ message: "Meeting not found" });
    return null;
  }

  const callerOrg = req.user?.organization
    ? req.user.organization.toString()
    : null;
  const meetingOrg = meeting.organization
    ? meeting.organization.toString()
    : null;

  if (!callerOrg || !meetingOrg || callerOrg !== meetingOrg) {
    res.status(403).json({ message: "Forbidden: Not part of organization" });
    return null;
  }

  return meeting;
};

// ==========================================
// LEGACY / POST-MEETING TRANSLATION ENDPOINTS
// ==========================================

// @desc    Request a bulk translation (Legacy)
// @route   POST /api/translation/request
// @access  Private
export const requestTranslation = async (req, res) => {
  try {
    const { meetingId, sourceType, targetLanguage } = req.body;

    if (!meetingId || !sourceType || !targetLanguage) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (!["transcript", "summary", "action_items"].includes(sourceType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sourceType" });
    }

    // This endpoint returns the meeting's transcript, summary or action items.
    // Without this check any signed-in user could read any meeting by ID.
    const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
    if (!meeting) return;

    const translatedContent = await translateContent(
      meetingId,
      sourceType,
      targetLanguage,
    );

    res.status(200).json({ success: true, translatedContent });
  } catch (error) {
    console.error("Error requesting translation:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

// @desc    Clear translation cache for a meeting (Legacy)
// @route   DELETE /api/translation/cache/:meetingId
// @access  Private
export const clearTranslationCache = async (req, res) => {
  try {
    const { meetingId } = req.params;

    // deleteMany on a caller-supplied meeting ID is destructive and was
    // previously reachable for any meeting in any organization.
    const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
    if (!meeting) return;

    await TranslationCache.deleteMany({ meeting: meetingId });
    res.status(200).json({ success: true, message: "Cache cleared" });
  } catch (error) {
    console.error("Error clearing translation cache:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==========================================
// REAL-TIME TRANSLATION ENDPOINTS
// ==========================================

/**
 * @desc Translate text segment in real-time
 * @route POST /api/translation/translate
 * @access Private
 */
export const translate = async (req, res) => {
  try {
    const {
      meetingId,
      segmentId,
      sourceText,
      sourceLanguage,
      targetLanguage,
      context,
    } = req.body;

    if (
      !meetingId ||
      !segmentId ||
      !sourceText ||
      !sourceLanguage ||
      !targetLanguage
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
    if (!meeting) return;

    const translation = await translateSegment(
      meetingId,
      segmentId,
      sourceText,
      sourceLanguage,
      targetLanguage,
      context,
    );

    res.status(200).json(translation);
  } catch (error) {
    console.error("Error translating:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get supported languages
 * @route GET /api/translation/languages
 * @access Private
 */
export const getLanguages = async (req, res) => {
  try {
    const languages = getSupportedLanguages();
    res.status(200).json({ languages });
  } catch (error) {
    console.error("Error fetching languages:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get user language preferences
 * @route GET /api/translation/preferences
 * @access Private
 */
export const getPreferences = async (req, res) => {
  try {
    const preferences = await getUserPreferences(req.user._id);
    res.status(200).json(preferences);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Update user language preferences
 * @route PUT /api/translation/preferences
 * @access Private
 */
export const updatePreferences = async (req, res) => {
  try {
    const updates = req.body;
    const preferences = await updateUserPreferences(req.user._id, updates);
    res.status(200).json(preferences);
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Submit manual correction
 * @route POST /api/translation/correct
 * @access Private
 */
export const correct = async (req, res) => {
  try {
    const { meetingId, segmentId, language, correctedText } = req.body;

    if (!meetingId || !segmentId || !language || !correctedText) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
    if (!meeting) return;

    const result = await submitCorrection(
      meetingId,
      segmentId,
      language,
      correctedText,
      req.user._id,
    );

    res.status(200).json({ message: "Correction submitted", result });
  } catch (error) {
    console.error("Error submitting correction:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get translation cache for meeting
 * @route GET /api/translation/cache/:meetingId
 * @access Private
 */
export const getCache = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
    if (!meeting) return;

    const translations = await getMeetingTranslations(meetingId);
    res.status(200).json({ translations });
  } catch (error) {
    console.error("Error fetching cache:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Export transcripts
 * @route POST /api/translation/export/:meetingId
 * @access Private
 */
export const exportTranscripts = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { format = "json", languages = ["en"] } = req.body;

    const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
    if (!meeting) return;

    const exportData = await exportTranscript(meetingId, format, languages);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transcript-${meetingId}.json`,
      );
      res.status(200).json(exportData);
    } else if (format === "srt") {
      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transcript-${meetingId}.srt`,
      );
      res.status(200).send(exportData.content);
    } else {
      res.status(400).json({ message: "Invalid format. Use 'json' or 'srt'" });
    }
  } catch (error) {
    console.error("Error exporting transcripts:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get quality metrics for segment
 * @route GET /api/translation/quality/:segmentId?meetingId=...
 * @access Private
 *
 * `segmentId` is unique only within a meeting — the cache is keyed on
 * `{ meeting, segmentId }` — so the meeting has to be named and authorized
 * before the lookup, otherwise the segment of any meeting is readable.
 */
export const getQuality = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { meetingId } = req.query;

    if (!segmentId) {
      return res.status(400).json({ message: "Missing segment ID" });
    }

    const meeting = await resolveAuthorizedMeeting(meetingId, req, res);
    if (!meeting) return;

    const metrics = await getQualityMetrics(segmentId, meetingId);
    res.status(200).json(metrics);
  } catch (error) {
    console.error("Error fetching quality metrics:", error);
    if (error.message === "Segment not found") {
      return res.status(404).json({ message: "Segment not found" });
    }
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
