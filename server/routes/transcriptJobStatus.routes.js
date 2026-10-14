// server/routes/transcriptJobStatus.routes.js
/**
 * Transcript Job Status Routes
 * Exposes job status endpoints for tracking transcription progress.
 * Issue #2650: Queue recording transcription with durable job status.
 */

import express from "express";
import {
  transcriptionQueue,
  getQueueInstance,
} from "../services/queueService.js";
import userAuth from "../middleware/userAuth.js";
import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

const router = express.Router();

/**
 * @desc  Get transcription job status
 * @route GET /api/transcripts/:transcriptId/job-status
 * @access Private (requires auth + transcript access)
 */
router.get("/:transcriptId/job-status", userAuth, async (req, res) => {
  try {
    const { transcriptId } = req.params;
    const userId = req.user.id;

    if (!transcriptionQueue.isActive) {
      return sendError(
        res,
        503,
        "Transcription queue unavailable (Redis not configured)",
      );
    }

    // Verify transcript exists and user has access
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
      return sendError(res, 404, "Transcript not found");
    }

    const meeting = await Meeting.findById(transcript.meeting);
    if (!meeting) {
      return sendError(res, 404, "Associated meeting not found");
    }

    // Check access (user is owner or in same org)
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return sendError(
        res,
        403,
        "Forbidden: You don't have access to this transcript",
      );
    }

    // Get the most recent transcription job for this transcript.
    // Since there may be multiple attempts, we fetch jobs and filter by data.
    const queue = getQueueInstance("transcription-queue");
    if (!queue) {
      return sendSuccess(res, {
        status: transcript.status,
        jobId: null,
        message: "No active transcription job found",
        transcript: {
          _id: transcript._id,
          status: transcript.status,
          errorMessage: transcript.errorMessage || null,
        },
      });
    }

    const activeJobs = await queue.getJobs(
      ["active", "waiting", "delayed"],
      0,
      -1,
    );
    const completedJobs = await queue.getJobs(["completed", "failed"], 0, -1);
    const allJobs = [...activeJobs, ...completedJobs];

    // Find the most recent job for this transcript
    const relevantJobs = allJobs.filter(
      (job) => job.data?.transcriptId === transcriptId,
    );
    const latestJob = relevantJobs.sort((a, b) => b.id - a.id)[0];

    if (!latestJob) {
      // No queued job found; return current transcript status
      return sendSuccess(res, {
        status: transcript.status,
        jobId: null,
        message: "No active transcription job found",
        transcript: {
          _id: transcript._id,
          status: transcript.status,
          errorMessage: transcript.errorMessage || null,
        },
      });
    }

    const state = await latestJob.getState();
    const progress = latestJob.progress?.current || latestJob.progress || 0;

    return sendSuccess(res, {
      jobId: latestJob.id,
      state,
      progress,
      attempt: latestJob.attemptsMade || 0,
      maxAttempts: latestJob.opts?.attempts || 4,
      transcript: {
        _id: transcript._id,
        status: transcript.status,
        errorMessage: transcript.errorMessage || null,
      },
    });
  } catch (error) {
    console.error("Error fetching transcription job status:", error);
    sendError(res, 500, "Failed to fetch job status", {
      error: error.message,
    });
  }
});

export default router;
