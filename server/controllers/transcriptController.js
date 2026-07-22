import Transcript from "../models/Transcript.js";
import Meeting from "../models/meetingModel.js";
import { transcribeFileWithSegments } from "../services/TranscriptionService.js";
import { indexTranscript } from "../utils/embeddingUtils.js";
import fs from "fs";
import path from "path";
import { searchVectorStore } from "../utils/embeddingUtils.js";

/**
 * @desc  Start a recording session for a meeting
 * @route POST /api/meetings/:meetingId/recording/start
 * @access Private (requires auth + org membership)
 */
export const startRecording = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Check if there's already an active recording
    const existingTranscript = await Transcript.findOne({
      meetingId,
      status: "recording",
    });

    if (existingTranscript) {
      return res.status(400).json({
        success: false,
        message: "Recording already in progress for this meeting",
      });
    }

    // Create new transcript document
    const transcript = new Transcript({
      meetingId,
      organizationId: meeting.organization,
      status: "recording",
      language: "en",
      timestamps: {
        recordingStartedAt: new Date(),
      },
    });

    await transcript.save();

    // Return room ID for Socket.IO
    const roomId = `meeting:${meetingId}:transcript`;

    res.status(200).json({
      success: true,
      message: "Recording started",
      roomId,
      transcriptId: transcript._id,
    });
  } catch (error) {
    console.error("Error starting recording:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to start recording",
    });
  }
};

/**
 * @desc  Stop a recording session and trigger transcription
 * @route POST /api/meetings/:meetingId/recording/stop
 * @access Private (requires auth + org membership)
 */
export const stopRecording = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find active recording transcript
    const transcript = await Transcript.findOne({
      meetingId,
      status: "recording",
    });

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "No active recording found for this meeting",
      });
    }

    // Update transcript status to processing
    transcript.status = "processing";
    transcript.timestamps.recordingEndedAt = new Date();
    transcript.timestamps.processingStartedAt = new Date();
    await transcript.save();

    // Trigger transcription in background (non-blocking)
    processTranscription(transcript._id).catch((err) => {
      console.error("Background transcription failed:", err);
    });

    res.status(200).json({
      success: true,
      message: "Recording stopped, transcription started",
      transcriptId: transcript._id,
    });
  } catch (error) {
    console.error("Error stopping recording:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to stop recording",
    });
  }
};

/**
 * @desc  Upload audio chunk for transcript
 * @route POST /api/meetings/:meetingId/transcript/upload
 * @access Private (requires auth + org membership)
 */
export const uploadTranscriptAudio = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file provided",
      });
    }

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find active recording transcript
    const transcript = await Transcript.findOne({
      meetingId,
      status: "recording",
    });

    if (!transcript) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "No active recording found for this meeting",
      });
    }

    // Store the file path for later processing
    // In a real implementation, you might stream this to AssemblyAI in real-time
    // For now, we'll store it and process on stop
    transcript.audioFilePath = req.file.path;
    await transcript.save();

    res.status(200).json({
      success: true,
      message: "Audio uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading transcript audio:", error);
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload audio",
    });
  }
};

/**
 * @desc  Get transcript for a meeting
 * @route GET /api/meetings/:meetingId/transcript
 * @access Private (requires auth + org membership)
 */
export const getTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find transcript
    const transcript = await Transcript.findOne({ meetingId });

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "Transcript not found",
      });
    }

    res.status(200).json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error("Error getting transcript:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get transcript",
    });
  }
};

/**
 * @desc  Retry failed transcription
 * @route POST /api/meetings/:meetingId/transcript/retry
 * @access Private (requires auth + org membership)
 */
export const retryTranscription = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting exists and user has access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Check if user is owner or in same org
    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isInSameOrg =
      meeting.organization &&
      req.user.organization &&
      meeting.organization.toString() === req.user.organization.toString();

    if (!isOwner && !isInSameOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Find failed transcript
    const transcript = await Transcript.findOne({
      meetingId,
      status: "failed",
    });

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: "No failed transcript found for this meeting",
      });
    }

    // Reset status and retry
    transcript.status = "processing";
    transcript.timestamps.processingStartedAt = new Date();
    transcript.errorMessage = null;
    await transcript.save();

    // Trigger transcription in background
    processTranscription(transcript._id).catch((err) => {
      console.error("Background transcription retry failed:", err);
    });

    res.status(200).json({
      success: true,
      message: "Transcription retry started",
      transcriptId: transcript._id,
    });
  } catch (error) {
    console.error("Error retrying transcription:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retry transcription",
    });
  }
};

/**
 * @desc  Voice-powered semantic search
 * @route GET /api/search/voice?query=...
 * @access Private (requires auth + org membership)
 */
export const voiceSearch = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid search query (minimum 3 characters)",
      });
    }

    console.log(`🎙️ Voice Search for query: "${query}"`);

    // Perform vector search across all content types
    const results = await searchVectorStore(query);

    if (!results || results.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No relevant results found.",
        results: [],
      });
    }

    // Filter results to include only those from user's organization
    const filteredResults = results.filter((r) => {
      if (!r.organization) return true; // Allow results without org
      return r.organization === req.user.organization?.toString();
    });

    res.status(200).json({
      success: true,
      message: "Voice search successful",
      results: filteredResults,
    });
  } catch (error) {
    console.error("Error in voice search:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Voice search failed",
    });
  }
};

/**
 * Helper function to process transcription in background
 */
async function processTranscription(transcriptId) {
  try {
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
      console.error("Transcript not found for processing");
      return;
    }

    if (!transcript.audioFilePath || !fs.existsSync(transcript.audioFilePath)) {
      throw new Error("Audio file not found");
    }

    console.log(`🎙️ Processing transcription for transcript ${transcriptId}`);

    // Transcribe audio with segments
    const transcriptionResult = await transcribeFileWithSegments(
      transcript.audioFilePath
    );

    // Update transcript with results
    transcript.fullText = transcriptionResult.fullText;
    transcript.segments = transcriptionResult.segments;
    transcript.status = "completed";
    transcript.timestamps.completedAt = new Date();
    await transcript.save();

    // Clean up audio file
    if (fs.existsSync(transcript.audioFilePath)) {
      fs.unlinkSync(transcript.audioFilePath);
    }

    console.log(`✅ Transcription completed for transcript ${transcriptId}`);

    // Index transcript in Pinecone for search
    await indexTranscript(transcript);

    // Update meeting with transcript reference
    await Meeting.findByIdAndUpdate(transcript.meetingId, {
      transcript: transcriptionResult.fullText,
    });

    console.log(`✅ Transcript indexed and meeting updated`);
  } catch (error) {
    console.error("❌ Transcription processing failed:", error);

    // Update transcript status to failed
    const transcript = await Transcript.findById(transcriptId);
    if (transcript) {
      transcript.status = "failed";
      transcript.errorMessage = error.message;
      await transcript.save();
    }
  }
}
