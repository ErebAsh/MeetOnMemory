import { z } from "zod";
import mongoose from "mongoose";
import KeyMoment from "../models/keyMomentModel.js";
import Meeting from "../models/meetingModel.js";
import { getKeyMomentsRoom } from "../socket/keyMomentSocket.js";

const keyMomentSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  snippet: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(500).optional(),
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(0).optional(),
  timestamp: z.number().min(0).optional(),
  category: z
    .enum(["decision", "action_item", "insight", "question", "disagreement"])
    .optional()
    .default("insight"),
  note: z.string().optional().default(""),
});

const updateKeyMomentSchema = z.object({
  snippet: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(500).optional(),
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(0).optional(),
  timestamp: z.number().min(0).optional(),
  category: z
    .enum(["decision", "action_item", "insight", "question", "disagreement"])
    .optional(),
  note: z.string().optional(),
});

// @desc    Create a new key moment
// @route   POST /api/key-moments
// @access  Private
export const createKeyMoment = async (req, res) => {
  try {
    const rawData = req.body || {};
    const parsedData = keyMomentSchema.parse(rawData);
    const userId = req.user._id;
    const meetingId = parsedData.meetingId;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isParticipant = meeting.participants?.some(
      (p) => p.user?.toString() === userId.toString(),
    );
    if (!isOwner && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to create key moments for this meeting",
      });
    }

    const snippet = parsedData.snippet || parsedData.title;
    if (!snippet) {
      return res
        .status(400)
        .json({ success: false, message: "Snippet or title is required" });
    }

    const startTime =
      parsedData.startTime !== undefined
        ? parsedData.startTime
        : parsedData.timestamp !== undefined
          ? parsedData.timestamp
          : 0;

    const endTime =
      parsedData.endTime !== undefined ? parsedData.endTime : startTime + 10;

    if (endTime < startTime) {
      return res.status(400).json({
        success: false,
        message: "End time cannot be before start time",
      });
    }

    const newMoment = await KeyMoment.create({
      meetingId,
      userId,
      organization: meeting.organization || req.user.organization,
      snippet,
      startTime,
      endTime,
      category: parsedData.category || "insight",
      note: parsedData.note || "",
    });

    const populatedMoment = await KeyMoment.findById(newMoment._id).populate(
      "userId",
      "name email profilePicture",
    );

    const io = req.app?.get("io");
    if (io) {
      io.to(getKeyMomentsRoom(meetingId.toString())).emit(
        "keyMoment:created",
        populatedMoment,
      );
    }

    res.status(201).json({ success: true, keyMoment: populatedMoment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate key moment found for this user at this exact time",
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }
    console.error("Error creating key moment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Get all key moments for a specific meeting
// @route   GET /api/key-moments/meeting/:meetingId
// @access  Private
export const getKeyMomentsForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isParticipant = meeting.participants?.some(
      (p) => p.user?.toString() === userId.toString(),
    );
    if (!isOwner && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view key moments for this meeting",
      });
    }

    const moments = await KeyMoment.find({ meetingId })
      .populate("userId", "name email profilePicture")
      .sort({ startTime: 1 });
    res.status(200).json({ success: true, keyMoments: moments });
  } catch (error) {
    console.error("Error fetching key moments:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Update a key moment (snippet, title, timestamp, note, or category)
// @route   PATCH /api/key-moments/:id or PUT /api/key-moments/:id
// @access  Private
export const updateKeyMoment = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateKeyMomentSchema.parse(req.body);

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid key moment ID" });
    }
    const moment = await KeyMoment.findById(id);
    if (!moment) {
      return res
        .status(404)
        .json({ success: false, message: "Key moment not found" });
    }

    const isCreator =
      moment.userId?.toString() === req.user?._id?.toString() ||
      moment.userId?.toString() === req.user?.id?.toString();

    let isMeetingOwner = false;
    if (moment.meetingId) {
      const meeting = await Meeting.findById(moment.meetingId);
      if (meeting) {
        isMeetingOwner =
          meeting.uploadedBy?.toString() === req.user?._id?.toString();
      }
    }
    const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

    if (!isCreator && !isMeetingOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this key moment",
      });
    }

    if (validatedData.title && !validatedData.snippet) {
      validatedData.snippet = validatedData.title;
    }
    delete validatedData.title;

    if (
      validatedData.timestamp !== undefined &&
      validatedData.startTime === undefined
    ) {
      validatedData.startTime = validatedData.timestamp;
    }
    delete validatedData.timestamp;

    const newStart =
      validatedData.startTime !== undefined
        ? validatedData.startTime
        : moment.startTime;

    if (
      validatedData.startTime !== undefined &&
      validatedData.endTime === undefined
    ) {
      if (moment.endTime !== undefined && moment.endTime <= newStart) {
        validatedData.endTime = newStart + 10;
      }
    }

    const newEnd =
      validatedData.endTime !== undefined
        ? validatedData.endTime
        : moment.endTime;

    if (newEnd !== undefined && newStart !== undefined && newEnd < newStart) {
      return res.status(400).json({
        success: false,
        message: "End time cannot be before start time",
      });
    }

    Object.assign(moment, validatedData);
    await moment.save();
    const populatedMoment = await KeyMoment.findById(id).populate(
      "userId",
      "name email profilePicture",
    );

    const io = req.app?.get("io");
    if (io) {
      io.to(getKeyMomentsRoom(moment.meetingId.toString())).emit(
        "keyMoment:updated",
        populatedMoment,
      );
    }
    res.status(200).json({ success: true, keyMoment: populatedMoment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }
    console.error("Error updating key moment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Delete a key moment
// @route   DELETE /api/key-moments/:id
// @access  Private
export const deleteKeyMoment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid key moment ID" });
    }
    const moment = await KeyMoment.findById(id);
    if (!moment) {
      return res
        .status(404)
        .json({ success: false, message: "Key moment not found" });
    }

    const isCreator =
      moment.userId?.toString() === req.user?._id?.toString() ||
      moment.userId?.toString() === req.user?.id?.toString();

    let isMeetingOwner = false;
    if (moment.meetingId) {
      const meeting = await Meeting.findById(moment.meetingId);
      if (meeting) {
        isMeetingOwner =
          meeting.uploadedBy?.toString() === req.user?._id?.toString();
      }
    }
    const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

    if (!isCreator && !isMeetingOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this key moment",
      });
    }

    const meetingId = moment.meetingId;
    await moment.deleteOne();
    const io = req.app?.get("io");
    if (io) {
      io.to(getKeyMomentsRoom(meetingId.toString())).emit(
        "keyMoment:deleted",
        id,
      );
    }

    res
      .status(200)
      .json({ success: true, message: "Key moment deleted successfully", id });
  } catch (error) {
    console.error("Error deleting key moment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Export key moments for a meeting / session as CSV
// @route   GET /api/key-moments/export or GET /api/key-moments/meeting/:meetingId/export
// @access  Private
export const exportKeyMoments = async (req, res) => {
  try {
    const meetingId =
      req.query.meetingId || req.query.sessionId || req.params.meetingId;
    const userId = req.user._id;

    if (!meetingId || !mongoose.isValidObjectId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid meeting ID is required" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const isOwner = meeting.uploadedBy?.toString() === userId.toString();
    const isParticipant = meeting.participants?.some(
      (p) => p.user?.toString() === userId.toString(),
    );
    if (!isOwner && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to export key moments for this meeting",
      });
    }

    const moments = await KeyMoment.find({ meetingId })
      .populate("userId", "name email")
      .sort({ startTime: 1 });

    const formatCsvTime = (seconds) => {
      if (isNaN(seconds) || seconds < 0) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");
      return `${mins}:${secs}`;
    };

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const stringVal = String(val).replace(/"/g, '""');
      return `"${stringVal}"`;
    };

    let csv = "Timestamp,Category,Key Moment Title,Note,Author\n";
    moments.forEach((m) => {
      const timeStr = formatCsvTime(m.startTime);
      const category = m.category || "";
      const snippet = m.snippet || "";
      const note = m.note || "";
      const author = m.userId?.name || m.userId?.email || "Unknown";
      csv += `${escapeCsv(timeStr)},${escapeCsv(category)},${escapeCsv(snippet)},${escapeCsv(note)},${escapeCsv(author)}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="session-${meetingId}-moments.csv"`,
    );
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting key moments:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to compile moment summary.",
      error: error.message,
    });
  }
};

export const exportMoments = exportKeyMoments;
export const updateMoment = updateKeyMoment;
export const deleteMoment = deleteKeyMoment;
