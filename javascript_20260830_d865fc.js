import Meeting from "../models/Meeting.js";
import Icebreaker from "../models/Icebreaker.js";
import ActionItem from "../models/ActionItem.js";
import Attendance from "../models/Attendance.js";
import logger from "../utils/logger.js";

/**
 * Get comprehensive analytics for a meeting
 */
export const getMeetingAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get meeting with authorization check
    const meeting = await Meeting.findById(id)
      .populate("organizationId", "name")
      .populate("createdBy", "name email");

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found",
      });
    }

    // Check access
    const isMember = meeting.participants?.some((p) => p.toString() === userId);
    const isCreator = meeting.createdBy._id.toString() === userId;
    const isAdmin = req.user.role === "admin";

    if (!isMember && !isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view analytics for this meeting",
      });
    }

    // Gather all analytics data
    const [
      attendanceStats,
      transcriptStats,
      actionItemsStats,
      engagementStats,
      icebreakerStats,
    ] = await Promise.all([
      getAttendanceAnalytics(id),
      getTranscriptAnalytics(id),
      getActionItemsAnalytics(id),
      getEngagementAnalytics(id),
      getIcebreakerAnalytics(id),
    ]);

    const analytics = {
      meeting: {
        id: meeting._id,
        title: meeting.title,
        status: meeting.status,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        duration: meeting.endTime
          ? Math.round(
              (new Date(meeting.endTime) - new Date(meeting.startTime)) / 60000,
            )
          : null,
      },
      attendance: attendanceStats,
      transcript: transcriptStats,
      actionItems: actionItemsStats,
      engagement: engagementStats,
      icebreakers: icebreakerStats,
      summary: {
        totalParticipants: meeting.participants?.length || 0,
        completionRate: attendanceStats?.completionRate || 0,
        actionItemsCompletion: actionItemsStats?.completionRate || 0,
        engagementScore: engagementStats?.score || 0,
        overallScore: calculateOverallScore({
          attendance: attendanceStats,
          actionItems: actionItemsStats,
          engagement: engagementStats,
        }),
      },
    };

    logger.info(`Analytics fetched for meeting ${id} by user ${userId}`);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error("Error fetching meeting analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch meeting analytics",
      details: error.message,
    });
  }
};

/**
 * Get attendance analytics for a meeting
 */
export const getMeetingAttendanceAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await getAttendanceAnalytics(id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error fetching attendance analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch attendance analytics",
    });
  }
};

/**
 * Get transcript analytics for a meeting
 */
export const getMeetingTranscriptAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await getTranscriptAnalytics(id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error fetching transcript analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch transcript analytics",
    });
  }
};

/**
 * Get action items analytics for a meeting
 */
export const getMeetingActionItemsAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await getActionItemsAnalytics(id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error fetching action items analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch action items analytics",
    });
  }
};

/**
 * Get engagement analytics for a meeting
 */
export const getMeetingEngagementAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await getEngagementAnalytics(id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error fetching engagement analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch engagement analytics",
    });
  }
};

/**
 * Export meeting analytics
 */
export const getMeetingExportAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = "json" } = req.query;

    const analytics = await getMeetingAnalyticsInternal(id);

    if (format === "csv") {
      // Convert to CSV
      const csvData = convertAnalyticsToCSV(analytics);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=meeting_analytics_${id}.csv`,
      );
      return res.send(csvData);
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error("Error exporting analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export analytics",
    });
  }
};

/**
 * Get organization-wide meeting analytics
 */
export const getOrganizationMeetingAnalytics = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { startDate, endDate } = req.query;

    const query = { organizationId };
    if (startDate) query.startTime = { $gte: new Date(startDate) };
    if (endDate) query.endTime = { $lte: new Date(endDate) };

    const meetings = await Meeting.find(query).select(
      "title status startTime endTime participants createdAt",
    );

    const totalMeetings = meetings.length;
    const completedMeetings = meetings.filter(
      (m) => m.status === "completed",
    ).length;
    const totalParticipants = meetings.reduce(
      (sum, m) => sum + (m.participants?.length || 0),
      0,
    );

    res.json({
      success: true,
      data: {
        totalMeetings,
        completedMeetings,
        completionRate:
          totalMeetings > 0
            ? Math.round((completedMeetings / totalMeetings) * 100)
            : 0,
        totalParticipants,
        averageParticipants:
          totalMeetings > 0 ? Math.round(totalParticipants / totalMeetings) : 0,
        meetings,
      },
    });
  } catch (error) {
    logger.error("Error fetching organization analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organization analytics",
    });
  }
};

// ============ Helper Functions ============

const getAttendanceAnalytics = async (meetingId) => {
  const attendance = await Attendance.findOne({ meetingId });
  if (!attendance) {
    return {
      total: 0,
      present: 0,
      absent: 0,
      excused: 0,
      completionRate: 0,
    };
  }

  const total =
    attendance.present.length +
    attendance.absent.length +
    attendance.excused.length;
  return {
    total,
    present: attendance.present.length,
    absent: attendance.absent.length,
    excused: attendance.excused.length,
    completionRate:
      total > 0 ? Math.round((attendance.present.length / total) * 100) : 0,
  };
};

const getTranscriptAnalytics = async (meetingId) => {
  const meeting = await Meeting.findById(meetingId).select(
    "transcript transcriptGeneratedAt",
  );
  if (!meeting || !meeting.transcript) {
    return {
      hasTranscript: false,
      wordCount: 0,
      length: 0,
    };
  }

  const transcript =
    typeof meeting.transcript === "string"
      ? meeting.transcript
      : meeting.transcript.encrypted
        ? "[Encrypted]"
        : "";

  return {
    hasTranscript: true,
    wordCount: transcript.split(/\s+/).filter((w) => w.length > 0).length || 0,
    length: transcript.length || 0,
    generatedAt: meeting.transcriptGeneratedAt,
    isEncrypted: meeting.isTranscriptEncrypted || false,
  };
};

const getActionItemsAnalytics = async (meetingId) => {
  const actionItems = await ActionItem.find({ meetingId });
  const total = actionItems.length;
  const completed = actionItems.filter(
    (ai) => ai.status === "completed",
  ).length;
  const inProgress = actionItems.filter(
    (ai) => ai.status === "in-progress",
  ).length;
  const pending = actionItems.filter((ai) => ai.status === "pending").length;

  return {
    total,
    completed,
    inProgress,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    byPriority: {
      high: actionItems.filter((ai) => ai.priority === "high").length,
      medium: actionItems.filter((ai) => ai.priority === "medium").length,
      low: actionItems.filter((ai) => ai.priority === "low").length,
    },
  };
};

const getEngagementAnalytics = async (meetingId) => {
  const icebreakers = await Icebreaker.find({ meetingId });
  const totalResponses = icebreakers.reduce(
    (sum, ib) => sum + (ib.responses?.length || 0),
    0,
  );
  const averageResponses =
    icebreakers.length > 0
      ? Math.round(totalResponses / icebreakers.length)
      : 0;

  return {
    totalIcebreakers: icebreakers.length,
    totalResponses,
    averageResponses,
    engagementRate:
      icebreakers.length > 0
        ? Math.round((totalResponses / (icebreakers.length * 5)) * 100)
        : 0,
    score: Math.min(
      100,
      Math.round((totalResponses / (icebreakers.length || 1)) * 20),
    ),
  };
};

const getIcebreakerAnalytics = async (meetingId) => {
  const icebreakers = await Icebreaker.find({ meetingId })
    .sort({ createdAt: -1 })
    .limit(5);

  return {
    total: icebreakers.length,
    recent: icebreakers.map((ib) => ({
      question: ib.question,
      type: ib.type,
      responseCount: ib.responses?.length || 0,
      createdAt: ib.createdAt,
    })),
  };
};

const calculateOverallScore = ({ attendance, actionItems, engagement }) => {
  const scores = [];
  if (attendance?.completionRate !== undefined)
    scores.push(attendance.completionRate);
  if (actionItems?.completionRate !== undefined)
    scores.push(actionItems.completionRate * 100);
  if (engagement?.score !== undefined) scores.push(engagement.score);
  return scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
};

const getMeetingAnalyticsInternal = async (meetingId) => {
  const [attendance, transcript, actionItems, engagement] = await Promise.all([
    getAttendanceAnalytics(meetingId),
    getTranscriptAnalytics(meetingId),
    getActionItemsAnalytics(meetingId),
    getEngagementAnalytics(meetingId),
  ]);

  return { attendance, transcript, actionItems, engagement };
};

const convertAnalyticsToCSV = (data) => {
  const rows = [
    ["Metric", "Value"],
    ["Total Participants", data.attendance.total || 0],
    ["Present", data.attendance.present || 0],
    ["Absent", data.attendance.absent || 0],
    ["Completion Rate", `${data.attendance.completionRate || 0}%`],
    ["Has Transcript", data.transcript.hasTranscript ? "Yes" : "No"],
    ["Word Count", data.transcript.wordCount || 0],
    ["Action Items Total", data.actionItems.total || 0],
    ["Action Items Completed", data.actionItems.completed || 0],
    [
      "Action Items Completion Rate",
      `${data.actionItems.completionRate || 0}%`,
    ],
    ["Engagement Score", `${data.engagement.score || 0}%`],
  ];
  return rows.map((row) => row.join(",")).join("\n");
};
