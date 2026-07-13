/**
 * MeetingService.js
 *
 * Contains ALL business logic for meeting operations that was previously
 * mixed into meetingController.js. Controllers now delegate every data-access
 * or complex operation to this service and only handle HTTP concerns
 * (request parsing, response shaping).
 *
 * Error signalling: services throw custom AppError subclasses (see
 * utils/errors.js); controllers pass these to next(err) so the global
 * error handler converts them to the right HTTP response.
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";

const validatePath = (filePath) => {
  if (!filePath) throw new Error("Path is required");
  const resolved = path.resolve(filePath);
  const uploadsDir = path.resolve("uploads");
  if (!resolved.startsWith(uploadsDir)) {
    throw new Error("Directory traversal detected: Access denied");
  }
  return resolved;
};

import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import { indexMeeting } from "../utils/embeddingUtils.js";
import {
  processStructuredMoM,
  detectResolutions,
} from "./knowledgeGraphService.js";
import { checkMeetingDecisionsAgainstPolicies } from "./policyComplianceService.js";
import { createAndPushNotification } from "./notificationService.js";
import eventBus from "./eventBus.js";
import * as calendarService from "./calendarService.js";
import { aiQueue } from "./queueService.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../utils/errors.js";

// ── Config ─────────────────────────────────────────────────────
const USE_WHISPER = false;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// ── Validation helper ──────────────────────────────────────────
// Exported so controllers can reuse it for URL param checks before
// even reaching the service layer.
export const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

// ═══════════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Poll AssemblyAI until the transcription job finishes.
 * Returns the transcript text string.
 */
const _pollAssemblyAI = async (transcriptId, intervalMs = 2500) => {
  while (true) {
    const checkRes = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { authorization: ASSEMBLYAI_API_KEY } },
    );
    if (checkRes.data.status === "completed") {
      return checkRes.data.text || "";
    }
    if (checkRes.data.status === "error") {
      throw new Error(
        checkRes.data.error || "AssemblyAI transcription error",
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
};

/**
 * Upload a local audio file to AssemblyAI and kick off transcription.
 * Returns the transcription job id.
 */
const _startAssemblyAIJob = async (filePath) => {
  const uploadRes = await axios.post(
    "https://api.assemblyai.com/v2/upload",
    fs.readFileSync(validatePath(filePath)),
    {
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        "Transfer-Encoding": "chunked",
      },
    },
  );

  const audioUrl = uploadRes.data.upload_url;

  const transcriptRes = await axios.post(
    "https://api.assemblyai.com/v2/transcript",
    { audio_url: audioUrl },
    { headers: { authorization: ASSEMBLYAI_API_KEY } },
  );

  return transcriptRes.data.id;
};

/**
 * Full transcription pipeline: upload → poll → return text.
 */
const _transcribeFile = async (filePath) => {
  if (USE_WHISPER) {
    throw new Error("Whisper path not enabled in this build.");
  }
  const jobId = await _startAssemblyAIJob(filePath);
  return _pollAssemblyAI(jobId);
};

/**
 * Call Gemini (primary) → HuggingFace (fallback) to generate a structured
 * MoM JSON object from a meeting transcript.
 */
const _generateMoMWithAI = async (textToSummarize, date, title) => {
  const prompt = `
You are an advanced AI meeting assistant responsible for preparing *formal, well-structured Minutes of Meeting (MoM)* 
from the transcript provided below.

The MoM should be factual, concise, and formatted for professional use in organizations, universities, or institutions.  
Avoid repetition, filler words, and unnecessary phrases. Capture key insights, outcomes, and responsibilities accurately.

🎯 Your goal is to return a clean JSON object with the following fields:
{
  "title": "A clear, professional meeting title (e.g., 'AI Integration Strategy Discussion')",
  "date": "${date}",
  "summary": "A concise 4–6 sentence paragraph summarizing the meeting objectives, key points discussed, and overall conclusions. Use formal tone.",
  "agenda": ["main agenda point 1", "main agenda point 2", "main agenda point 3"],
  "key_discussions": [
    "Summarize core discussion points or debates in neutral and objective language.",
    "Mention who contributed if identifiable (optional)."
  ],
  "decisions": [
    "List final decisions or outcomes agreed upon during the meeting, if any."
  ],
  "action_items": [
    {"task": "Describe the specific task or next step", "owner": "Person responsible (if mentioned)", "due_date": "Deadline or expected date, if mentioned", "status": "Status if mentioned (e.g., 'pending', 'in progress', 'completed')"}
  ],
  "questions_raised": [
    "List important unanswered questions or follow-up discussions that emerged during the meeting."
  ],
  "keywords": [
    "Extract 5-10 relevant keywords and topics discussed during the meeting."
  ],
  "attendees": ["List attendees if mentioned or infer from transcript"],
  "notes": "Include any follow-up requirements, risks, or additional remarks worth noting."
}

Transcript:
${textToSummarize}

🧠 Instructions:
- Return ONLY valid JSON (no Markdown, no commentary, no backticks).
- Write in clear, formal English.
- Ensure every array key is present — use [] or "" for missing info.
- Avoid hallucinating or adding extra information.
- Maintain factual tone based on transcript content only.
- If user provided a title: ${title || "none"}, incorporate or refine it if appropriate.
`;

  // ── Primary: Gemini ──────────────────────────────────────────
  try {
    console.log(`📡 Using Gemini model: ${GEMINI_MODEL}`);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const outputText = result.response.text();

    let structured;
    try {
      structured = JSON.parse(outputText);
    } catch {
      const match = outputText.match(/\{[\s\S]*\}/);
      structured = match ? JSON.parse(match[0]) : { rawText: outputText };
    }
    console.log("✅ Gemini response received");
    return structured;
  } catch (gemErr) {
    console.error("❌ Gemini API error, falling back to HuggingFace:", gemErr.message);
  }

  // ── Fallback: HuggingFace ────────────────────────────────────
  try {
    const hfUrl =
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
    const hfResp = await axios.post(
      hfUrl,
      { inputs: textToSummarize.substring(0, 1024) },
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      },
    );

    const hfText =
      Array.isArray(hfResp.data) && hfResp.data[0]?.summary_text
        ? hfResp.data[0].summary_text
        : hfResp.data?.generated_text || JSON.stringify(hfResp.data);

    console.log("✅ HuggingFace fallback completed");
    return {
      title: title || `Meeting on ${date}`,
      date,
      summary: hfText,
      agenda: [],
      key_discussions: [],
      decisions: [],
      action_items: [],
      questions_raised: [],
      keywords: [],
      attendees: [],
      notes: "Generated using fallback summarization model",
    };
  } catch (hfErr) {
    console.error("❌ HuggingFace also failed:", hfErr.message);
    throw new Error("Both Gemini and HuggingFace summarization failed");
  }
};

/**
 * Normalize raw AI output into a consistently shaped MoM object.
 */
const _normalizeMoM = (structured, title, date) => ({
  title: structured.title || title || `Meeting on ${date}`,
  date: structured.date || date,
  summary: structured.summary || structured.rawText || "",
  agenda: structured.agenda || [],
  key_discussions: structured.key_discussions || [],
  decisions: structured.decisions || [],
  action_items: structured.action_items || structured.actions || [],
  questions_raised: structured.questions_raised || [],
  keywords: structured.keywords || [],
  attendees: structured.attendees || [],
  notes: structured.notes || "",
});

/**
 * Convert a structured MoM object into human-readable plain text.
 */
const _buildHumanReadableMoM = (mom) => {
  let text = "";
  text += `📘 Overview:\n${mom.summary}\n\n`;
  text += `📅 Title: ${mom.title}\n`;
  text += `Date: ${new Date(mom.date).toLocaleDateString()}\n\n`;
  text += `📝 Summary:\n${mom.summary}\n\n`;

  if (mom.agenda.length) {
    text += "📋 Agenda:\n";
    mom.agenda.forEach((item, i) => (text += `${i + 1}. ${item}\n`));
    text += "\n";
  }
  if (mom.key_discussions.length) {
    text += "💬 Key Discussions:\n";
    mom.key_discussions.forEach((d, i) => (text += `${i + 1}. ${d}\n`));
    text += "\n";
  }
  if (mom.decisions.length) {
    text += "✅ Decisions:\n";
    mom.decisions.forEach((d, i) => (text += `${i + 1}. ${d}\n`));
    text += "\n";
  }
  if (mom.action_items.length) {
    text += "🎯 Action Items:\n";
    mom.action_items.forEach((a, i) => {
      const t =
        typeof a === "string"
          ? a
          : `${a.task || a.action || ""}${a.owner ? " — " + a.owner : ""}${
              a.due_date ? " (Due: " + a.due_date + ")" : ""
            }`;
      text += `${i + 1}. ${t}\n`;
    });
    text += "\n";
  }
  if (mom.attendees.length) {
    text += "👥 Attendees: " + mom.attendees.join(", ") + "\n\n";
  }
  if (mom.questions_raised.length) {
    text += "❓ Questions Raised:\n";
    mom.questions_raised.forEach((q, i) => (text += `${i + 1}. ${q}\n`));
    text += "\n";
  }
  if (mom.keywords.length) {
    text += "🏷 Keywords: " + mom.keywords.join(", ") + "\n\n";
  }
  if (mom.notes) {
    text += "🗒 Notes:\n" + mom.notes + "\n";
  }
  return text;
};

/**
 * Fire-and-forget knowledge graph & compliance processing.
 * Never throws — failure is logged and does not affect the API response.
 */
const _runKnowledgeGraph = (meetingDoc, mom) => {
  if (!meetingDoc) return;
  (async () => {
    try {
      await detectResolutions(meetingDoc, mom);
      const kgResults = await processStructuredMoM(meetingDoc, mom);
      try {
        await checkMeetingDecisionsAgainstPolicies(
          meetingDoc,
          kgResults?.decisions,
        );
      } catch (complianceErr) {
        console.error(
          "⚠️ Policy compliance check failed (non-fatal):",
          complianceErr.message,
        );
      }
    } catch (kgErr) {
      console.error(
        "⚠️ Knowledge graph processing failed (non-fatal):",
        kgErr.message,
      );
    }
  })();
};

// ═══════════════════════════════════════════════════════════════
// Public service methods
// ═══════════════════════════════════════════════════════════════

/**
 * 1. Create a scheduled meeting record.
 *
 * @param {string} uploaderId  - ObjectId string of the authenticated user
 * @param {string|null} orgId  - Organization ObjectId (may be null)
 * @param {object} data        - Validated fields from the request body
 * @param {object|null} io     - Socket.IO server instance (for notifications)
 * @returns {Promise<Meeting>}
 */
export const createMeeting = async (uploaderId, orgId, data, io) => {
  const meeting = await Meeting.create({
    uploadedBy: uploaderId,
    organization: orgId || null,
    title: data.title.trim(),
    description: data.description || "",
    meetingType: data.meetingType || "conference",
    date: data.date ? new Date(data.date) : new Date(),
    time: data.time || "",
    duration: data.duration || null,
    location: data.location || "",
    venue: data.venue || "",
    participants: data.participants || [],
    agendaItems: data.agendaItems || [],
    policyDetails: data.policyDetails || null,
    recordingType: data.recordingType || "upload",
    transcript: "",
    summary: "",
    structuredMoM: null,
    status: "uploaded",
  });

  // Index for semantic search (fire-and-forget)
  indexMeeting(meeting).catch((err) =>
    console.error("⚠️ indexMeeting error (continuing):", err.message),
  );

  // Notify other org members (fire-and-forget)
  if (orgId && io) {
    User.find({ organization: orgId, _id: { $ne: uploaderId } })
      .then(async (members) => {
        for (const member of members) {
          await createAndPushNotification(
            io,
            member._id,
            "New Meeting Scheduled",
            `A new meeting "${meeting.title}" has been scheduled.`,
            "meetings",
            `/meeting/${meeting._id}`,
            "View Details",
          );
        }
      })
      .catch((err) =>
        console.error("⚠️ Notification error (continuing):", err.message),
      );
  }

  // Google Calendar sync (fire-and-forget)
  User.findById(uploaderId)
    .then(async (user) => {
      if (user?.calendarSyncEnabled) {
        const eventId = await calendarService.createEvent(user, meeting);
        if (eventId) {
          meeting.googleEventId = eventId;
          await meeting.save();
        }
      }
    })
    .catch((err) =>
      console.error("⚠️ Google Calendar sync error (continuing):", err.message),
    );

  // Webhook event
  try {
    eventBus.emit("meeting.created", meeting);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit meeting.created event:", evtErr.message);
  }

  return meeting;
};

/**
 * 2. Upload a new audio file, transcribe it, and create a meeting record.
 *
 * @param {string} uploaderId
 * @param {string|null} orgId
 * @param {object} file  - Multer file object (file.path, file.originalname …)
 * @param {object} body  - Request body (title, date, meetingType)
 * @returns {Promise<{meeting: Meeting, transcript: string}>}
 */
export const uploadAndTranscribeMeeting = async (
  uploaderId,
  orgId,
  file,
  body,
) => {
  const filePath = file.path;
  console.log("🎙️ Starting transcription with AssemblyAI...");

  const transcriptText = await _transcribeFile(filePath);
  console.log("✅ Transcription completed");

  const meeting = await Meeting.create({
    uploadedBy: uploaderId,
    organization: orgId || null,
    title: body.title?.trim() || `Meeting - ${new Date().toLocaleDateString()}`,
    date: body.date ? new Date(body.date) : new Date(),
    meetingType: body.meetingType || "internal",
    fileUrl: file.path,
    transcript: transcriptText,
    summary: "",
    structuredMoM: null,
    status: "completed",
  });

  indexMeeting(meeting).catch((err) =>
    console.error("⚠️ indexMeeting error (continuing):", err.message),
  );

  // Cleanup temp file
  try {
    fs.unlinkSync(validatePath(filePath));
  } catch (e) {
    console.warn("⚠️ Could not delete temp file:", e.message);
  }

  return { meeting, transcript: transcriptText };
};

/**
 * 3. Attach an audio recording to an already-created meeting and transcribe it.
 *
 * @param {string} uploaderId
 * @param {string} meetingId  - Must be a valid ObjectId string
 * @param {object} file       - Multer file object
 * @returns {Promise<{meeting: Meeting, transcript: string}>}
 */
export const uploadAudioForExistingMeeting = async (
  uploaderId,
  meetingId,
  file,
) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found");

  if (meeting.uploadedBy.toString() !== uploaderId.toString()) {
    throw new ForbiddenError(
      "You don't have permission to update this meeting",
    );
  }

  const filePath = file.path;
  console.log("🎙️ Transcribing audio for existing meeting...");

  const transcriptText = await _transcribeFile(filePath);
  console.log("✅ Transcription completed");

  meeting.transcript = transcriptText;
  meeting.fileUrl = file.path;
  meeting.status = "completed";
  await meeting.save();

  indexMeeting(meeting).catch((err) =>
    console.error("⚠️ indexMeeting error (continuing):", err.message),
  );

  try {
    fs.unlinkSync(validatePath(filePath));
  } catch (e) {
    console.warn("⚠️ Could not delete temp file:", e.message);
  }

  return { meeting, transcript: transcriptText };
};

/**
 * 4. Generate (or queue) AI Minutes of Meeting for a transcript.
 *
 * When BullMQ/Redis is available the job is queued and the method returns
 * { queued: true }.  Otherwise it runs synchronously and returns the full
 * MoM data.
 *
 * @param {string} userId
 * @param {string|null} meetingId
 * @param {string} transcript
 * @param {string} date        - ISO or locale date string
 * @param {string|null} title
 * @param {object|null} io     - Socket.IO instance (for push notification)
 * @returns {Promise<{queued: boolean, mom?, momText?, meetingId?}>}
 */
export const generateMeetingMoM = async (
  userId,
  meetingId,
  transcript,
  date,
  title,
  io,
) => {
  if (meetingId && !isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  let textToSummarize = (transcript || "").trim();
  let meeting = null;

  if (meetingId && !textToSummarize) {
    meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new NotFoundError("Meeting not found");
    textToSummarize = (meeting.transcript || "").trim();
  }

  if (!textToSummarize) {
    throw new ValidationError("No transcript provided.");
  }

  // ── Queue-first (async path) ─────────────────────────────────
  if (aiQueue) {
    console.log(
      `🚀 Queueing MoM generation job for ${meetingId || "transcript-only"}...`,
    );
    await aiQueue.add("generate-mom", {
      meetingId,
      transcript: textToSummarize,
      date,
      title,
      userId,
    });
    return { queued: true };
  }

  // ── Synchronous path (Redis disabled) ───────────────────────
  console.log(`🧠 Generating MoM for ${meetingId || "transcript-only"}...`);

  const structured = await _generateMoMWithAI(textToSummarize, date, title);
  if (!structured) throw new Error("No summary generated");

  const mom = _normalizeMoM(structured, title, date);
  const momText = _buildHumanReadableMoM(mom);

  // Persist to database
  let meetingToUpdate = meeting;

  if (!meetingToUpdate && meetingId) {
    meetingToUpdate = await Meeting.findById(meetingId);
  }

  if (!meetingToUpdate && !meetingId) {
    // Transcript-only flow — create a new meeting record
    meetingToUpdate = await Meeting.create({
      uploadedBy: userId,
      title: mom.title,
      date: new Date(date),
      transcript: textToSummarize,
      summary: momText,
      structuredMoM: mom,
      status: "completed",
    });
    await indexMeeting(meetingToUpdate);
  } else if (meetingToUpdate) {
    meetingToUpdate.title = mom.title;
    meetingToUpdate.date = new Date(date);
    meetingToUpdate.summary = momText;
    meetingToUpdate.structuredMoM = mom;
    await meetingToUpdate.save();
  }

  console.log("✅ MoM saved to database");

  // Webhook events
  try {
    if (!meetingId) eventBus.emit("meeting.created", meetingToUpdate);
    eventBus.emit("mom.generated", meetingToUpdate);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit webhook events:", evtErr.message);
  }

  // Knowledge graph (fire-and-forget)
  _runKnowledgeGraph(meetingToUpdate, mom);

  // Push notification to the creator
  if (io && meetingToUpdate?.uploadedBy) {
    createAndPushNotification(
      io,
      meetingToUpdate.uploadedBy,
      "Minutes of Meeting Generated",
      `MoM for "${meetingToUpdate.title}" is ready.`,
      "ai_processing",
      `/meeting/${meetingToUpdate._id}`,
      "View MoM",
    ).catch((err) =>
      console.error("⚠️ Notification error (continuing):", err.message),
    );
  }

  return {
    queued: false,
    mom: structured,
    momText,
    meetingId: meetingToUpdate?._id || meetingId,
  };
};

/**
 * 5. Fetch all meetings visible to a user with optional date filtering and
 *    pagination.
 *
 * @param {string} userId
 * @param {string|null} orgId
 * @param {{ page?, limit?, startDate?, endDate? }} queryParams
 * @returns {Promise<{meetings: Meeting[], total: number, page: number, limit: number, totalPages: number}>}
 */
export const getAllMeetings = async (userId, orgId, queryParams = {}) => {
  const { page = 1, limit = 10, startDate, endDate } = queryParams;

  const queryOptions = [{ uploadedBy: userId }];
  if (orgId) {
    queryOptions.push({ organization: orgId });
  }

  const query = { $or: queryOptions };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [meetings, total] = await Promise.all([
    Meeting.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "title summary structuredMoM createdAt date meetingType status time duration recordingType organization",
      )
      .populate("organization", "name"),
    Meeting.countDocuments(query),
  ]);

  return {
    meetings,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

/**
 * 6. Fetch a single meeting by its ObjectId.
 *
 * @param {string} meetingId
 * @returns {Promise<Meeting>}
 */
export const getMeetingById = async (meetingId) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found");
  return meeting;
};

/**
 * 7. Update editable fields of an existing meeting.
 *
 * @param {string} userId
 * @param {string} meetingId
 * @param {object} data      - Fields to update (all optional)
 * @param {object|null} doc  - Pre-fetched document from requireOwner middleware
 * @returns {Promise<Meeting>}
 */
export const updateMeeting = async (userId, meetingId, data, doc = null) => {
  if (!doc && !isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting =
    doc || (await Meeting.findOne({ _id: meetingId, uploadedBy: userId }));
  if (!meeting) throw new NotFoundError("Meeting not found");

  const {
    title,
    description,
    meetingType,
    date,
    time,
    duration,
    location,
    venue,
    tags,
  } = data;

  if (title) meeting.title = title.trim();
  if (description !== undefined) meeting.description = description;
  if (meetingType) meeting.meetingType = meetingType;
  if (date) meeting.date = new Date(date);
  if (time !== undefined) meeting.time = time;
  if (duration !== undefined) meeting.duration = duration;
  if (location !== undefined) meeting.location = location;
  if (venue !== undefined) meeting.venue = venue;
  if (tags) meeting.tags = tags;

  await meeting.save();

  // Re-index (fire-and-forget)
  indexMeeting(meeting).catch((err) =>
    console.error("⚠️ indexMeeting error (continuing):", err.message),
  );

  // Google Calendar sync (fire-and-forget)
  if (meeting.googleEventId) {
    User.findById(userId)
      .then(async (user) => {
        if (user?.calendarSyncEnabled) {
          await calendarService.updateEvent(user, meeting);
        }
      })
      .catch((err) =>
        console.error("⚠️ Google Calendar update sync error:", err.message),
      );
  }

  return meeting;
};

/**
 * 8. Delete a meeting and optionally clean up its Google Calendar event.
 *
 * @param {object|null} doc      - Pre-fetched document from requireOwner middleware
 * @param {string} meetingId     - Used if `doc` is null
 * @returns {Promise<void>}
 */
export const deleteMeeting = async (doc, meetingId) => {
  let deleted;

  if (doc) {
    const googleEventId = doc.googleEventId;
    const uploadedBy = doc.uploadedBy;
    await doc.deleteOne();

    if (googleEventId) {
      User.findById(uploadedBy)
        .then(async (user) => {
          if (user?.calendarSyncEnabled) {
            await calendarService.deleteEvent(user, googleEventId);
          }
        })
        .catch((err) =>
          console.error("⚠️ Calendar delete sync error:", err.message),
        );
    }
    return;
  }

  // Fallback: no pre-fetched doc
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  deleted = await Meeting.findByIdAndDelete(meetingId);
  if (!deleted) throw new NotFoundError("Meeting not found");

  if (deleted.googleEventId) {
    User.findById(deleted.uploadedBy)
      .then(async (user) => {
        if (user?.calendarSyncEnabled) {
          await calendarService.deleteEvent(user, deleted.googleEventId);
        }
      })
      .catch((err) =>
        console.error("⚠️ Calendar delete sync error:", err.message),
      );
  }
};

/**
 * 9. Text or voice-based search across meeting records.
 *
 * If `audioUrl` is provided and no `query` text, the audio is first
 * transcribed via AssemblyAI to derive the search query.
 *
 * @param {{ query?: string, audioUrl?: string }} params
 * @returns {Promise<{query: string, count: number, results: Meeting[]}>}
 */
export const searchMeetings = async ({ query, audioUrl }) => {
  let searchQuery = (query || "").trim();

  if (audioUrl && !searchQuery) {
    console.log("🎧 Transcribing audioUrl for voice search...");
    const transcriptRes = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      { audio_url: audioUrl },
      { headers: { authorization: ASSEMBLYAI_API_KEY } },
    );
    searchQuery = await _pollAssemblyAI(transcriptRes.data.id, 2000);
    console.log("🔊 Voice transcribed to text:", searchQuery);
  }

  if (!searchQuery) {
    throw new ValidationError("No search query provided");
  }

  console.log(`🔍 Searching meetings for: "${searchQuery}"`);
  const results = await Meeting.find({
    $or: [
      { title: { $regex: searchQuery, $options: "i" } },
      { summary: { $regex: searchQuery, $options: "i" } },
      { transcript: { $regex: searchQuery, $options: "i" } },
    ],
  })
    .sort({ createdAt: -1 })
    .select("title summary transcript createdAt date meetingType");

  return { query: searchQuery, count: results.length, results };
};

/**
 * 10. Send real-time join-meeting notifications to specified participants.
 *
 * @param {object} io           - Socket.IO server instance
 * @param {string} uploaderId   - Caller's user ObjectId (excluded from notifications)
 * @param {string} roomId       - Live meeting room identifier
 * @param {Array}  participants - Array of {name, email?} objects
 * @param {string|null} orgId   - Organization scope for user lookup
 * @returns {Promise<{count: number}>}
 */
export const notifyLiveMeetingParticipants = async (
  io,
  uploaderId,
  roomId,
  participants,
  orgId,
) => {
  const searchNames = participants.map((p) => p.name).filter(Boolean);
  const searchEmails = participants
    .map((p) => p.email || p.name)
    .filter(Boolean);

  const dbUsers = await User.find({
    organization: orgId,
    $or: [{ email: { $in: searchEmails } }, { name: { $in: searchNames } }],
    _id: { $ne: uploaderId },
  });

  for (const user of dbUsers) {
    await createAndPushNotification(
      io,
      user._id,
      "Live Meeting Started",
      "You have been invited to join a live meeting.",
      "meetings",
      `/meeting-room/${roomId}`,
      "Join Now",
    );
  }

  return { count: dbUsers.length };
};
