import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
/**
 * @desc Extracts and structures all relevant meeting data for template rendering.
 * Flattens nested objects and formats dates for Handlebars compatibility.
 */
class DataExtractor {
  /**
   * Gathers all data needed for a meeting export.
   * @param {string} meetingId
   * @returns {Promise<Object>} Structured data object for templates.
   */
  static async extractMeetingData(meetingId) {
    const meeting = await Meeting.findById(meetingId)
      .populate("organizer", "name email")
      .populate("participants", "name email avatar");

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    // Fetch associated action items using canonical actionItemModel
    const actionItems = await ActionItem.find({
      $or: [{ sourceMeetingId: meetingId }, { meetingId }],
    })
      .populate("assignee", "name")
      .sort({ priority: -1, dueDate: 1 });

    // Structure the data for Handlebars
    return {
      meeting: {
        id: meeting._id,
        title: meeting.title,
        date: meeting.date,
        duration: meeting.duration,
        summary: meeting.summary || "No summary available.",
        transcript: meeting.transcript || "",

        organizer: {
          name: meeting.organizer?.name || "Unknown",
          email: meeting.organizer?.email || "",
        },

        attendees: meeting.participants.map((p) => ({
          name: p.name,
          email: p.email,
          avatar: p.avatar,
        })),

        actionItems: actionItems.map((item) => ({
          title: item.title || item.text,
          description: item.description,
          assignee: item.assignee?.name || item.owner || "Unassigned",
          deadline: item.deadline || item.dueDate,
          priority: item.priority,
          status: item.status,
        })),

        // Populate decisions from the authoritative Decision model
        decisions: await this.extractDecisionsForMeeting(meetingId),
      },
      // Metadata for the export itself
      exportMeta: {
        generatedAt: new Date(),
        generatedBy: "MeetOnMemory System",
        platform: "MeetOnMemory",
      },
    };
  }

  /**
   * Filters data based on template section toggles.
   * @param {Object} data - Full extracted data.
   * @param {Object} sections - Template section toggles { showAttendees, showActionItems, etc. }
   * @returns {Object} Filtered data.
   */
  static applySectionFilters(data, sections) {
    const filtered = { ...data };

    if (!sections.showAttendees) {
      filtered.meeting.attendees = [];
    }
    if (!sections.showActionItems) {
      filtered.meeting.actionItems = [];
    }
    if (!sections.showTranscript) {
      filtered.meeting.transcript = "";
    }
    if (!sections.showDecisions) {
      filtered.meeting.decisions = [];
    }
    if (!sections.showSummary) {
      filtered.meeting.summary = "";
    }

    return filtered;
  }

  /**
   * Extracts decisions for a specific meeting from the Decision model.
   * Returns only the decision text for template compatibility.
   * @param {string} meetingId
   * @returns {Promise<Array>} Array of decision text strings.
   */
  static async extractDecisionsForMeeting(meetingId) {
    try {
      const decisions = await Decision.find({
        sourceMeetingId: meetingId,
      })
        .select("text status")
        .sort({ createdAt: -1 });

      return decisions.map((d) => d.text);
    } catch (error) {
      console.warn(
        "Error extracting decisions for meeting export:",
        error.message,
      );
      return [];
    }
  }
}

export default DataExtractor;
