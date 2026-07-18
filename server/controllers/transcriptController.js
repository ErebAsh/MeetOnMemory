/**
 * transcriptController.js
 * Handles transcript CRUD operations and export functionality
 */

import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import { indexMeeting } from "../utils/embeddingUtils.js";
import { indexTranscriptChunks } from "../utils/transcriptEmbeddingUtils.js";

/**
 * Get transcript by meeting ID
 */
export const getTranscriptByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const transcript = await Transcript.findOne({ meeting: meetingId }).populate(
      "meeting",
      "title date participants"
    );

    if (!transcript) {
      return res.status(404).json({ message: "Transcript not found" });
    }

    res.json(transcript);
  } catch (error) {
    console.error("Error fetching transcript:", error);
    res.status(500).json({ message: "Failed to fetch transcript" });
  }
};

/**
 * Search within a transcript
 */
export const searchTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { query } = req.body;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const transcript = await Transcript.findOne({ meeting: meetingId });

    if (!transcript) {
      return res.status(404).json({ message: "Transcript not found" });
    }

    const searchTerms = query.toLowerCase().split(" ");
    const matchingSegments = transcript.segments.filter((segment) =>
      searchTerms.some((term) => segment.text.toLowerCase().includes(term))
    );

    res.json({
      query,
      matches: matchingSegments,
      totalMatches: matchingSegments.length,
    });
  } catch (error) {
    console.error("Error searching transcript:", error);
    res.status(500).json({ message: "Failed to search transcript" });
  }
};

/**
 * Export transcript as text
 */
export const exportTranscriptAsText = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const transcript = await Transcript.findOne({ meeting: meetingId }).populate(
      "meeting",
      "title date"
    );

    if (!transcript) {
      return res.status(404).json({ message: "Transcript not found" });
    }

    const meeting = transcript.meeting;
    const textContent = [
      `Meeting: ${meeting.title}`,
      `Date: ${meeting.date?.toLocaleDateString() || "N/A"}`,
      `Duration: ${Math.floor(transcript.duration / 60)}:${Math.floor(transcript.duration % 60).toString().padStart(2, "0")}`,
      "",
      "TRANSCRIPT",
      "=" .repeat(50),
      "",
    ];

    transcript.segments.forEach((segment) => {
      const timestamp = formatTimestamp(segment.startTime);
      textContent.push(`[${timestamp}] ${segment.speaker}:`);
      textContent.push(segment.text);
      textContent.push("");
    });

    const filename = `transcript-${meetingId}.txt`;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(textContent.join("\n"));
  } catch (error) {
    console.error("Error exporting transcript as text:", error);
    res.status(500).json({ message: "Failed to export transcript" });
  }
};

/**
 * Export transcript as PDF
 */
export const exportTranscriptAsPDF = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const PDFDocument = await import("pdfkit");
    const doc = new PDFDocument.default();

    const transcript = await Transcript.findOne({ meeting: meetingId }).populate(
      "meeting",
      "title date"
    );

    if (!transcript) {
      return res.status(404).json({ message: "Transcript not found" });
    }

    const meeting = transcript.meeting;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transcript-${meetingId}.pdf"`
    );

    doc.pipe(res);

    // Title
    doc.fontSize(20).text("Meeting Transcript", { align: "center" });
    doc.moveDown();

    // Meeting info
    doc.fontSize(12).text(`Meeting: ${meeting.title}`);
    doc.text(`Date: ${meeting.date?.toLocaleDateString() || "N/A"}`);
    doc.text(
      `Duration: ${Math.floor(transcript.duration / 60)}:${Math.floor(transcript.duration % 60).toString().padStart(2, "0")}`
    );
    doc.moveDown();

    // Transcript content
    doc.fontSize(10);
    transcript.segments.forEach((segment) => {
      const timestamp = formatTimestamp(segment.startTime);
      doc.text(`[${timestamp}] ${segment.speaker}:`, { continued: true });
      doc.text(segment.text);
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error("Error exporting transcript as PDF:", error);
    res.status(500).json({ message: "Failed to export transcript as PDF" });
  }
};

/**
 * Finalize transcript and index in Pinecone
 */
export const finalizeTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const transcript = await Transcript.findOne({ meeting: meetingId });

    if (!transcript) {
      return res.status(404).json({ message: "Transcript not found" });
    }

    // Update transcript status
    transcript.status = "completed";
    await transcript.save();

    // Update meeting with full transcript
    const meeting = await Meeting.findById(meetingId);
    if (meeting) {
      meeting.transcript = transcript.fullText;
      await meeting.save();

      // Index meeting in Pinecone
      await indexMeeting(meeting);

      // Index transcript chunks for granular search
      await indexTranscriptChunks(transcript, meeting);
    }

    res.json({ message: "Transcript finalized and indexed successfully" });
  } catch (error) {
    console.error("Error finalizing transcript:", error);
    res.status(500).json({ message: "Failed to finalize transcript" });
  }
};

/**
 * Helper function to format timestamp in MM:SS format
 */
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
