// server/tests/dataExtractor.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import DataExtractor from "../services/dataExtractor.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";

vi.mock("../models/meetingModel.js");
vi.mock("../models/actionItemModel.js");
vi.mock("../models/decisionModel.js");

describe("DataExtractor decisions export (#2641)", () => {
  const meetingId = "507f1f77bcf86cd799439011";
  const organizerId = "507f1f77bcf86cd799439044";
  const participantId = "507f1f77bcf86cd799439055";

  const meetingFixture = {
    _id: meetingId,
    title: "Q3 Planning",
    date: new Date("2026-08-30"),
    duration: 60,
    summary: "Planned Q3 roadmap",
    transcript: "Meeting transcript content",
    organizer: {
      _id: organizerId,
      name: "Alice Smith",
      email: "alice@example.com",
    },
    participants: [
      {
        _id: participantId,
        name: "Bob Jones",
        email: "bob@example.com",
        avatar: "avatar-url",
      },
    ],
  };

  const decisionsFixture = [
    {
      _id: "decision-1",
      text: "Launch feature X in Q3",
      status: "open",
      createdAt: new Date("2026-08-30T10:00:00Z"),
    },
    {
      _id: "decision-2",
      text: "Allocate 20% resources to tech debt",
      status: "resolved",
      createdAt: new Date("2026-08-30T10:05:00Z"),
    },
  ];

  const actionItemsFixture = [
    {
      _id: "ai-1",
      text: "Update documentation",
      title: "Update documentation",
      description: "Complete API docs",
      assignee: { _id: participantId, name: "Bob Jones" },
      owner: "Bob Jones",
      dueDate: new Date("2026-09-15"),
      deadline: new Date("2026-09-15"),
      priority: "high",
      status: "open",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    Meeting.findById.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(meetingFixture),
      }),
    });

    ActionItem.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(actionItemsFixture),
      }),
    });

    Decision.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(decisionsFixture),
      }),
    });
  });

  it("extracts real decisions from Decision model per meeting", async () => {
    const data = await DataExtractor.extractMeetingData(meetingId);

    expect(Decision.find).toHaveBeenCalledWith({
      sourceMeetingId: meetingId,
    });
    expect(data.meeting.decisions).toEqual([
      "Launch feature X in Q3",
      "Allocate 20% resources to tech debt",
    ]);
    expect(data.meeting.decisions.length).toBe(2);
  });

  it("returns empty array when no decisions exist for meeting", async () => {
    Decision.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      }),
    });

    const data = await DataExtractor.extractMeetingData(meetingId);

    expect(data.meeting.decisions).toEqual([]);
  });

  it("falls back to empty array and logs warning when Decision query fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    Decision.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockRejectedValue(new Error("DB connection failed")),
      }),
    });

    const data = await DataExtractor.extractMeetingData(meetingId);

    expect(data.meeting.decisions).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error extracting decisions"),
      expect.stringContaining("DB connection failed"),
    );

    warnSpy.mockRestore();
  });

  it("filters out decisions when showDecisions is false", async () => {
    const data = await DataExtractor.extractMeetingData(meetingId);

    const filtered = DataExtractor.applySectionFilters(data, {
      showDecisions: false,
    });

    expect(filtered.meeting.decisions).toEqual([]);
  });

  it("retains decisions when showDecisions is true", async () => {
    const data = await DataExtractor.extractMeetingData(meetingId);

    const filtered = DataExtractor.applySectionFilters(data, {
      showDecisions: true,
    });

    expect(filtered.meeting.decisions).toEqual([
      "Launch feature X in Q3",
      "Allocate 20% resources to tech debt",
    ]);
  });
});
