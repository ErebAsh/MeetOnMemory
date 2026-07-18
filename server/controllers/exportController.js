import Meeting from "../models/meetingModel.js";
import ExportService from "../services/ExportService.js";

export const exportMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query;

    const meeting = await Meeting.findById(id);

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const title =
      meeting.structuredMoM?.title || meeting.title || "Meeting Minutes";
    const filenameBase = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    if (format === "pdf") {
      const doc = ExportService.generateMeetingPDF(meeting);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}_mom.pdf"`,
      );
      doc.pipe(res);
    } else if (format === "docx") {
      const buffer = await ExportService.generateMeetingDOCX(meeting);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}_mom.docx"`,
      );
      res.send(buffer);
    } else if (format === "md") {
      const md = ExportService.generateMeetingMD(meeting);
      res.setHeader("Content-Type", "text/markdown");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}_mom.md"`,
      );
      res.send(md);
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid format requested" });
    }
  } catch (error) {
    console.error("Export error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Export failed",
        error: error.message,
      });
    } else {
      res.end();
    }
  }
};
