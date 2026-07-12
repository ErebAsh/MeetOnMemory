import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import { indexMeeting } from "../utils/embeddingUtils.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  processStructuredMoM,
  detectResolutions,
} from "../services/knowledgeGraphService.js";
import { checkMeetingDecisionsAgainstPolicies } from "../services/policyComplianceService.js";
import { createAndPushNotification } from "../services/notificationService.js";

// Validates any id pulled from req.body/req.params/req.query before it
// reaches a Mongoose query. Without this, a JSON body like
// { "meetingId": { "$gt": "" } } would pass a raw Mongo operator object
// straight into Meeting.findById(), letting an attacker bypass the
// intended id lookup (CodeQL: js/sql-injection — "Database query built
// from user-controlled sources"). isValid() also rejects non-ObjectId
// strings, so callers get a clean 400 instead of a Mongoose CastError.
const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

import * as calendarService from "../services/calendarService.js";
import { aiQueue } from "../services/queueService.js";
/**
 * Meeting Controller - Handles all meeting operations
 *
 * Features:
 * 1. Schedule meetings (from CreateMeeting Schedule section)
 * 2. Upload & transcribe audio (from both UploadMeeting page and CreateMeeting Upload section)
 * 3. Generate AI summaries/MOM using Gemini 2.0 Flash (fallback to HuggingFace)
 * 4. Fetch all meetings for dashboard
 * 5. Voice/Text search (new)
 */

// Config
const USE_WHISPER = false;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/* =========================================================
   1. CREATE MEETING (Schedule from CreateMeeting form)
   - Creates meeting record with comprehensive details
   - Used by: CreateMeeting.jsx "Schedule Meeting" section
   ========================================================= */
export const createMeeting = async (req, res) => {
  try {
    const uploaderId = req.user?.id || req.user?._id;
    if (!uploaderId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized. Login required." });
    }

    const {
      title,
      description,
      meetingType,
      date,
      time,
      duration,
      location,
      venue,
      participants,
      agendaItems,
      policyDetails,
      recordingType,
    } = req.body;

    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Meeting title is required" });
    }

    const meeting = await Meeting.create({
      uploadedBy: uploaderId,
      organization: req.user?.organization || null,
      title: title.trim(),
      description: description || "",
      meetingType: meetingType || "conference",
      date: date ? new Date(date) : new Date(),
      time: time || "",
      duration: duration || null,
      location: location || "",
      venue: venue || "",
      participants: participants || [],
      agendaItems: agendaItems || [],
      policyDetails: policyDetails || null,
      recordingType: recordingType || "upload",
      transcript: "",
      summary: "",
      structuredMoM: null,
      status: "uploaded",
    });

    // Index meeting for semantic search (non-blocking)
    try {
      await indexMeeting(meeting);
    } catch (idxErr) {
      console.error("⚠️ indexMeeting error (continuing):", idxErr.message);
    }

    // Notify organization members
    const io = req.app.get("io");
    if (meeting.organization && io) {
      try {
        const members = await User.find({
          organization: meeting.organization,
          _id: { $ne: uploaderId },
        });

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
      } catch (notifErr) {
        console.error("⚠️ Notification error (continuing):", notifErr.message);
      }
    }

    // Sync with Google Calendar if enabled
    try {
      const user = await User.findById(uploaderId);
      if (user && user.calendarSyncEnabled) {
        const eventId = await calendarService.createEvent(user, meeting);
        if (eventId) {
          meeting.googleEventId = eventId;
          await meeting.save();
        }
      }
    } catch (calErr) {
      console.error("⚠️ Google Calendar sync error (continuing):", calErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Meeting scheduled successfully",
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        meetingType: meeting.meetingType,
        date: meeting.date,
      },
    });
  } catch (error) {
    console.error("❌ createMeeting Error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create meeting",
    });
  }
};

/* =========================================================
   2. UPLOAD MEETING (Original - from UploadMeeting page)
   - Uploads audio file, transcribes using AssemblyAI
   - Returns meetingId + transcript for further processing
   - Used by: UploadMeeting.jsx (existing working page)
   ========================================================= */
export const uploadMeeting = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No audio file uploaded." });
    }
    const uploaderId = req.user?.id || req.user?._id;
    if (!uploaderId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized. Login required." });
    }

    const filePath = req.file.path;
    let transcriptText = "";

    console.log("🎙️ Starting transcription with AssemblyAI...");

    // Transcription using AssemblyAI
    if (!USE_WHISPER) {
      // Step 1: Upload file to AssemblyAI
      const uploadRes = await axios.post(
        "https://api.assemblyai.com/v2/upload",
        fs.readFileSync(filePath),
        {
          headers: {
            authorization: ASSEMBLYAI_API_KEY,
            "Transfer-Encoding": "chunked",
          },
        },
      );

      const audioUrl = uploadRes.data.upload_url;
      console.log("✅ File uploaded to AssemblyAI");

      // Step 2: Create transcription job
      const transcriptRes = await axios.post(
        "https://api.assemblyai.com/v2/transcript",
        { audio_url: audioUrl },
        { headers: { authorization: ASSEMBLYAI_API_KEY } },
      );

      const transcriptId = transcriptRes.data.id;
      console.log("⏳ Transcription job created, polling for completion...");

      // Step 3: Poll for completion
      let transcriptData;
      while (true) {
        const checkRes = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: { authorization: ASSEMBLYAI_API_KEY },
          },
        );
        if (checkRes.data.status === "completed") {
          transcriptData = checkRes.data;
          console.log("✅ Transcription completed");
          break;
        } else if (checkRes.data.status === "error") {
          throw new Error(
            checkRes.data.error || "AssemblyAI transcription error",
          );
        }
        // Wait 2.5 seconds before next poll
        await new Promise((r) => setTimeout(r, 2500));
      }
      transcriptText = transcriptData.text || "";
    } else {
      throw new Error("Whisper path not enabled in this build.");
    }

    // Create meeting record in database
    const meeting = await Meeting.create({
      uploadedBy: uploaderId,
      organization: req.user?.organization || null,
      title:
        req.body.title?.trim() ||
        `Meeting - ${new Date().toLocaleDateString()}`,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      meetingType: req.body.meetingType || "internal",
      fileUrl: req.file.path,
      transcript: transcriptText,
      summary: "",
      structuredMoM: null,
      status: "completed",
    });

    // Index meeting for semantic search (non-blocking)
    try {
      await indexMeeting(meeting);
    } catch (idxErr) {
      console.error("⚠️ indexMeeting error (continuing):", idxErr.message);
    }

    // Cleanup temp file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn("⚠️ Could not delete temp file:", e.message);
    }

    return res.status(200).json({
      success: true,
      message: "Meeting transcribed successfully",
      meetingId: meeting._id,
      transcript: transcriptText,
    });
  } catch (error) {
    console.error(
      "❌ uploadMeeting Error:",
      error?.response?.data || error?.message || error,
    );
    return res
      .status(500)
      .json({ success: false, message: error.message || "Upload failed" });
  }
};

/* =========================================================
   3. UPLOAD AUDIO FOR EXISTING MEETING
   - Uploads audio to an already created meeting
   - Used by: CreateMeeting.jsx "Upload Meeting" section
   ========================================================= */
export const uploadAudioForMeeting = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No audio file uploaded." });
    }

    const { meetingId } = req.body;
    if (!meetingId) {
      return res
        .status(400)
        .json({ success: false, message: "Meeting ID is required" });
    }
    if (!isValidObjectId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }

    const uploaderId = req.user?.id || req.user?._id;
    if (!uploaderId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized. Login required." });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (meeting.uploadedBy.toString() !== uploaderId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this meeting",
      });
    }

    const filePath = req.file.path;
    let transcriptText = "";

    console.log("🎙️ Transcribing audio for existing meeting...");

    // Transcription using AssemblyAI
    if (!USE_WHISPER) {
      const uploadRes = await axios.post(
        "https://api.assemblyai.com/v2/upload",
        fs.readFileSync(filePath),
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

      const transcriptId = transcriptRes.data.id;

      // Poll for completion
      let transcriptData;
      while (true) {
        const checkRes = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: { authorization: ASSEMBLYAI_API_KEY },
          },
        );
        if (checkRes.data.status === "completed") {
          transcriptData = checkRes.data;
          console.log("✅ Transcription completed");
          break;
        } else if (checkRes.data.status === "error") {
          throw new Error(
            checkRes.data.error || "AssemblyAI transcription error",
          );
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      transcriptText = transcriptData.text || "";
    }

    // Update meeting with transcript
    meeting.transcript = transcriptText;
    meeting.fileUrl = req.file.path;
    meeting.status = "completed";
    await meeting.save();

    // Re-index meeting
    try {
      await indexMeeting(meeting);
    } catch (idxErr) {
      console.error("⚠️ indexMeeting error (continuing):", idxErr.message);
    }

    // Cleanup temp file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn("⚠️ Could not delete temp file:", e.message);
    }

    return res.status(200).json({
      success: true,
      message: "Audio uploaded and transcribed successfully",
      meetingId: meeting._id,
      transcript: transcriptText,
    });
  } catch (error) {
    console.error("❌ uploadAudioForMeeting Error:", error?.message || error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Upload failed" });
  }
};

/* =========================================================
   4. SUMMARIZE MEETING (Generate AI MOM)
   - Accepts: { meetingId?, transcript?, date (required), title? }
   - Generates structured MoM JSON using Gemini 2.0 Flash
   - Falls back to HuggingFace if Gemini fails
   - Returns readable MoM text + structured JSON
   - Used by: Both UploadMeeting.jsx and CreateMeeting.jsx
   ========================================================= */
export const summarizeMeeting = async (req, res) => {
  try {
    const { meetingId, transcript, date, title } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (meetingId && !isValidObjectId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Meeting date is required.",
      });
    }

    let textToSummarize = (transcript || "").trim();

    // Fetch meeting transcript if only meetingId is provided
    let meeting = null;
    if (meetingId && !textToSummarize) {
      meeting = await Meeting.findById(meetingId);
      if (!meeting)
        return res
          .status(404)
          .json({ success: false, message: "Meeting not found" });
      textToSummarize = (meeting.transcript || "").trim();
    }

    if (!textToSummarize) {
      return res.status(400).json({
        success: false,
        message: "No transcript provided.",
      });
    }

    if (aiQueue) {
      console.log(`🚀 Queueing MoM generation job for ${meetingId || "transcript-only"}...`);
      await aiQueue.add("generate-mom", {
        meetingId,
        transcript: textToSummarize,
        date,
        title,
        userId
      });
      
      return res.status(202).json({
        success: true,
        message: "Minutes generation started in the background. Please wait...",
      });
    }

    // Fallback if redis is disabled (sync generation)
    console.log(`🧠 Generating MoM for ${meetingId || "transcript-only"}...`);

    // ======= Build Professional MoM Prompt =======
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

    // ======= Use Gemini 2.0 Flash for Summarization =======
    let structured = null;
    let humanReadable = "";

    try {
      console.log(`📡 Using Gemini model: ${GEMINI_MODEL}`);

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
      });

      const result = await model.generateContent(prompt);
      const outputText = result.response.text();

      // Try to parse JSON from response
      try {
        structured = JSON.parse(outputText);
      } catch (e) {
        // Extract JSON from markdown code blocks if present
        const match = outputText.match(/\{[\s\S]*\}/);
        structured = match ? JSON.parse(match[0]) : { rawText: outputText };
      }

      console.log("✅ Gemini response received");
    } catch (gemErr) {
      console.error(
        "❌ Gemini API error, falling back to HuggingFace:",
        gemErr.message,
      );

      // ======= Fallback: HuggingFace =======
      try {
        const hfUrl =
          "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";

        const hfResp = await axios.post(
          hfUrl,
          { inputs: textToSummarize.substring(0, 1024) }, // HuggingFace has input limits
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

        // Try to structure the HuggingFace response
        structured = {
          title: title || `Meeting on ${date}`,
          date: date,
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

        console.log("✅ HuggingFace fallback completed");
      } catch (hfErr) {
        console.error("❌ HuggingFace also failed:", hfErr.message);
        throw new Error("Both Gemini and HuggingFace summarization failed");
      }
    }

    // ======= Build Human-Readable MoM Text =======
    if (structured) {
      const mom = {
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
      };

      // Add Overview before Title
      humanReadable += `📘 Overview:\n${mom.summary}\n\n`;
      humanReadable += `📅 Title: ${mom.title}\n`;
      humanReadable += `Date: ${new Date(mom.date).toLocaleDateString()}\n\n`;
      humanReadable += `📝 Summary:\n${mom.summary}\n\n`;

      if (mom.agenda.length) {
        humanReadable += "📋 Agenda:\n";
        mom.agenda.forEach(
          (item, i) => (humanReadable += `${i + 1}. ${item}\n`),
        );
        humanReadable += "\n";
      }

      if (mom.key_discussions.length) {
        humanReadable += "💬 Key Discussions:\n";
        mom.key_discussions.forEach(
          (d, i) => (humanReadable += `${i + 1}. ${d}\n`),
        );
        humanReadable += "\n";
      }

      if (mom.decisions.length) {
        humanReadable += "✅ Decisions:\n";
        mom.decisions.forEach((d, i) => (humanReadable += `${i + 1}. ${d}\n`));
        humanReadable += "\n";
      }

      if (mom.action_items.length) {
        humanReadable += "🎯 Action Items:\n";
        mom.action_items.forEach((a, i) => {
          const text =
            typeof a === "string"
              ? a
              : `${a.task || a.action || ""}${a.owner ? " — " + a.owner : ""}${
                  a.due_date ? " (Due: " + a.due_date + ")" : ""
                }`;
          humanReadable += `${i + 1}. ${text}\n`;
        });
        humanReadable += "\n";
      }

      if (mom.attendees.length) {
        humanReadable += "👥 Attendees: " + mom.attendees.join(", ") + "\n\n";
      }
      if (mom.questions_raised.length) {
        humanReadable += "❓ Questions Raised:\n";
        mom.questions_raised.forEach(
          (q, i) => (humanReadable += `${i + 1}. ${q}\n`),
        );
        humanReadable += "\n";
      }
      if (mom.keywords.length) {
        humanReadable += "🏷 Keywords: " + mom.keywords.join(", ") + "\n\n";
      }
      if (mom.notes) {
        humanReadable += "🗒 Notes:\n" + mom.notes + "\n";
      }

      // ======= Save to Database =======
      let meetingToUpdate = meeting;

      if (!meetingToUpdate && meetingId) {
        meetingToUpdate = await Meeting.findById(meetingId);
      }

      if (!meetingToUpdate && !meetingId) {
        // User provided transcript only (no existing meeting)
        meetingToUpdate = await Meeting.create({
          uploadedBy: req.user?.id || req.user?._id,
          title: mom.title,
          date: new Date(date),
          transcript: textToSummarize,
          summary: humanReadable,
          structuredMoM: mom,
          status: "completed",
        });
        await indexMeeting(meetingToUpdate);
      } else if (meetingToUpdate) {
        // Update existing meeting
        meetingToUpdate.title = mom.title;
        meetingToUpdate.date = new Date(date);
        meetingToUpdate.summary = humanReadable;
        meetingToUpdate.structuredMoM = mom;
        await meetingToUpdate.save();
      }

      console.log("✅ MoM saved to database");
      // --- NEW: Knowledge graph processing ---
      if (meetingToUpdate) {
        try {
          await detectResolutions(meetingToUpdate, mom);
          const kgResults = await processStructuredMoM(meetingToUpdate, mom);

          // Policy compliance cross-reference — hooks in right after decisions
          // are extracted/embedded by the knowledge graph pass. Kept in its
          // own try/catch so a compliance-check failure never affects
          // knowledge-graph processing that already succeeded above.
          try {
            await checkMeetingDecisionsAgainstPolicies(
              meetingToUpdate,
              kgResults?.decisions,
            );
          } catch (complianceError) {
            console.error(
              "⚠️ Policy compliance check failed (non-fatal):",
              complianceError,
            );
          }
        } catch (kgError) {
          console.error(
            "⚠️ Knowledge graph processing failed (non-fatal):",
            kgError,
          );
        }

        // Push notification to the meeting creator
        const io = req.app.get("io");
        if (io && meetingToUpdate.uploadedBy) {
          try {
            await createAndPushNotification(
              io,
              meetingToUpdate.uploadedBy,
              "Minutes of Meeting Generated",
              `MoM for "${meetingToUpdate.title}" is ready.`,
              "ai_processing",
              `/meeting/${meetingToUpdate._id}`,
              "View MoM",
            );
          } catch (notifErr) {
            console.error(
              "⚠️ Notification error (continuing):",
              notifErr.message,
            );
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Minutes generated successfully",
        mom: structured,
        momText: humanReadable,
        meetingId: meetingToUpdate?._id || meetingId,
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "No summary generated" });
  } catch (err) {
    console.error("❌ summarizeMeeting Error:", err.message || err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};

/* =========================================================
   5. GET ALL MEETINGS (Dashboard)
   - Fetches all meetings for logged-in user
   - Used by: Dashboard/Summaries page
   ========================================================= */
export const getAllMeetings = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { page = 1, limit = 10, startDate, endDate } = req.query;

    const queryOptions = [{ uploadedBy: userId }];
    if (req.user?.organization) {
      queryOptions.push({ organization: req.user.organization });
    }

    const query = { $or: queryOptions };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const meetings = await Meeting.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "title summary structuredMoM createdAt date meetingType status time duration recordingType organization",
      )
      .populate("organization", "name");

    const totalMeetings = await Meeting.countDocuments(query);

    return res.status(200).json({ 
      success: true, 
      meetings,
      pagination: {
        total: totalMeetings,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalMeetings / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("❌ getAllMeetings Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch meetings" });
  }
};

export const deleteMeeting = async (req, res) => {
  try {
    const meeting = req.doc; // from requireOwnerOrAdmin middleware
    if (!meeting) {
      // Fallback if middleware isn't used
      if (!isValidObjectId(req.params.id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid meeting ID" });
      }
      const deleted = await Meeting.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, message: "Meeting not found" });
      }

      // Sync deletion with Google Calendar
      if (deleted.googleEventId) {
        const user = await User.findById(deleted.uploadedBy);
        if (user && user.calendarSyncEnabled) {
          await calendarService.deleteEvent(user, deleted.googleEventId);
        }
      }
    } else {
      const uploaderId = meeting.uploadedBy;
      const googleEventId = meeting.googleEventId;
      await meeting.deleteOne();

      // Sync deletion with Google Calendar
      if (googleEventId) {
        const user = await User.findById(uploaderId);
        if (user && user.calendarSyncEnabled) {
          await calendarService.deleteEvent(user, googleEventId);
        }
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("❌ deleteMeeting Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while deleting meeting" });
  }
};

/* =========================================================
   7. GET MEETING BY ID (Meeting Details Page)
   - Fetches a single meeting with all details
   - Used by: MeetingDetails.jsx
   ========================================================= */
export const getMeetingById = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    return res.status(200).json({ success: true, meeting });
  } catch (error) {
    console.error("❌ getMeetingById Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch meeting" });
  }
};

/* =========================================================
   8. UPDATE MEETING (Rename)
   - Updates meeting title or other fields
   - Used by: MeetingDetails.jsx
   ========================================================= */
export const updateMeeting = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.doc && !isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }

    // `req.doc` is provided by the `requireOwner` middleware
    const meeting =
      req.doc ||
      (await Meeting.findOne({ _id: req.params.id, uploadedBy: userId }));

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Update allowed fields
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
    } = req.body;

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

    // Re-index meeting for search
    try {
      await indexMeeting(meeting);
    } catch (idxErr) {
      console.error("⚠️ indexMeeting error (continuing):", idxErr.message);
    }

    // Sync update with Google Calendar
    if (meeting.googleEventId) {
      try {
        const user = await User.findById(userId);
        if (user && user.calendarSyncEnabled) {
          await calendarService.updateEvent(user, meeting);
        }
      } catch (calErr) {
        console.error("⚠️ Google Calendar update sync error:", calErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Meeting updated successfully",
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        description: meeting.description,
        meetingType: meeting.meetingType,
        date: meeting.date,
      },
    });
  } catch (error) {
    console.error("❌ updateMeeting Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update meeting" });
  }
};

/* =========================================================
   6. NEW: VOICE/TEXT SEARCH (searchMeetingsByText)
   8. NEW: VOICE/TEXT SEARCH (searchMeetingsByText)
   - Accepts either:
       { query: "text to search" }
     or
       { audioUrl: "https://...uploaded-audio.wav" } (AssemblyAI-uploaded URL)
   - If audioUrl provided, transcribe using AssemblyAI, then search
   - Searches title, summary, transcript fields
   ========================================================= */
export const searchMeetingsByText = async (req, res) => {
  try {
    let { query, audioUrl } = req.body;

    // If audioUrl provided and no query, transcribe it first using AssemblyAI
    if (audioUrl && (!query || query.trim() === "")) {
      console.log("🎧 Transcribing audioUrl for voice search...");

      // Create transcript job
      const transcriptRes = await axios.post(
        "https://api.assemblyai.com/v2/transcript",
        { audio_url: audioUrl },
        { headers: { authorization: ASSEMBLYAI_API_KEY } },
      );

      const transcriptId = transcriptRes.data.id;

      // Poll for completion
      let transcriptData = null;
      while (true) {
        const checkRes = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: { authorization: ASSEMBLYAI_API_KEY },
          },
        );
        if (checkRes.data.status === "completed") {
          transcriptData = checkRes.data;
          break;
        } else if (checkRes.data.status === "error") {
          throw new Error(
            checkRes.data.error || "AssemblyAI transcription error",
          );
        }
        // wait 2s before polling again
        await new Promise((r) => setTimeout(r, 2000));
      }

      query = transcriptData.text || "";
      console.log("🔊 Voice transcribed to text:", query);
    }

    if (!query || query.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "No search query provided" });
    }

    // Basic regex search across title, summary, transcript
    console.log(`🔍 Searching meetings for: "${query}"`);
    const results = await Meeting.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { summary: { $regex: query, $options: "i" } },
        { transcript: { $regex: query, $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .select("title summary transcript createdAt date meetingType");

    return res.status(200).json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("❌ searchMeetingsByText Error:", error?.message || error);
    return res
      .status(500)
      .json({ success: false, message: "Search failed", error: error.message });
  }
};

/**
 * ✅ Notify Live Meeting Participants
 * - Given a roomId and an array of participant names/emails,
 *   looks them up in the DB and pushes a real-time notification to join the live room.
 */
export const notifyLiveMeeting = async (req, res) => {
  try {
    const { roomId, participants } = req.body;
    const uploaderId = req.user?.id || req.user?._id;

    if (!roomId || !participants || !Array.isArray(participants)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request data" });
    }

    const io = req.app.get("io");
    if (!io) {
      return res
        .status(500)
        .json({ success: false, message: "Socket.IO not initialized" });
    }

    // Extract both name and email from participant objects
    const searchNames = participants.map((p) => p.name).filter(Boolean);
    const searchEmails = participants
      .map((p) => p.email || p.name)
      .filter(Boolean);

    console.log(
      "Searching for live meeting participants. Names:",
      searchNames,
      "Emails:",
      searchEmails,
    );

    const dbUsers = await User.find({
      organization: req.user.organization, // Scope to caller's organization
      $or: [{ email: { $in: searchEmails } }, { name: { $in: searchNames } }],
      _id: { $ne: uploaderId }, // Don't notify the creator
    });

    console.log(`Found ${dbUsers.length} users matching criteria.`);

    for (const user of dbUsers) {
      console.log(
        `Preparing to notify user (${user._id}) for live room ${roomId}`,
      );
      await createAndPushNotification(
        io,
        user._id,
        "Live Meeting Started",
        `You have been invited to join a live meeting.`,
        "meetings",
        `/meeting-room/${roomId}`,
        "Join Now",
      );
    }

    return res.status(200).json({
      success: true,
      message: "Participants notified",
      count: dbUsers.length,
    });
  } catch (error) {
    console.error("❌ Error notifying live meeting participants:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to notify participants" });
  }
};
