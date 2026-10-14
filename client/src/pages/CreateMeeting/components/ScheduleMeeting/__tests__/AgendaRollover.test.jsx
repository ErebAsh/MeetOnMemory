import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScheduleMeeting from "../ScheduleMeeting.jsx";
import { meetingApi, agendaRolloverApi } from "../../../../../services";

vi.mock("../../../../../services", () => ({
  meetingApi: {
    getAllMeetings: vi.fn(),
  },
  agendaRolloverApi: {
    previewRollover: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockMeetings = [
  { _id: "meeting-1", title: "Project Sync", date: "2026-08-28T10:00:00.000Z" },
  {
    _id: "meeting-2",
    title: "Planning Session",
    date: "2026-08-29T10:00:00.000Z",
  },
];

const mockPreviewItems = {
  success: true,
  data: {
    agendaItems: [
      {
        text: "Incomplete Item 1",
        description: "Desc 1",
        duration: 10,
        sourceAgendaItemId: "item-101",
        pacing: { recommendation: 15, count: 2 },
      },
    ],
  },
};

const mockHookProps = {
  scheduleData: {
    title: "",
    description: "",
    meetingType: "conference",
    date: "",
    time: "",
    duration: "",
    location: "",
    tags: [],
  },
  setScheduleData: vi.fn(),
  participants: [],
  newParticipant: { name: "", email: "" },
  setNewParticipant: vi.fn(),
  agendaItems: [],
  newAgenda: "",
  setNewAgenda: vi.fn(),
  attachments: [],
  loading: false,
  templates: [],
  selectedTemplateId: "",
  handleTemplateSelect: vi.fn(),
  handleScheduleChange: vi.fn(),
  addParticipant: vi.fn(),
  removeParticipant: vi.fn(),
  addAgendaItem: vi.fn(),
  removeAgendaItem: vi.fn(),
  reorderAgendaItem: vi.fn(),
  handleAttachmentUpload: vi.fn(),
  removeAttachment: vi.fn(),
  handleScheduleSubmit: vi.fn(),
  aiSummaryTemplates: [],
  selectedAiSummaryTemplateId: "",
  setSelectedAiSummaryTemplateId: vi.fn(),
  setAgendaItems: vi.fn(),
  customFields: { fields: [], isValid: true },
  setCustomFields: vi.fn(),
  userData: { organization: "org-1" },
};

describe("ScheduleMeeting Agenda Rollover (#2591)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApi.getAllMeetings.mockResolvedValue({
      data: { success: true, meetings: mockMeetings },
    });
    agendaRolloverApi.previewRollover.mockResolvedValue(mockPreviewItems);
  });

  it("should toggle the rollover section checkbox", async () => {
    render(<ScheduleMeeting hookProps={mockHookProps} />);

    const checkbox = screen.getByLabelText(
      /rollover unfinished agenda items from previous meeting/i,
    );
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // The Select Previous Meeting dropdown should now be visible
    expect(
      screen.getByLabelText(/select previous meeting/i),
    ).toBeInTheDocument();
  });

  it("should fetch and render preview items with pacing suggestions upon selecting a source meeting", async () => {
    render(<ScheduleMeeting hookProps={mockHookProps} />);

    // Toggle checkbox
    fireEvent.click(
      screen.getByLabelText(
        /rollover unfinished agenda items from previous meeting/i,
      ),
    );

    // Select meeting-1
    const select = screen.getByLabelText(/select previous meeting/i);
    await screen.findByText(/Project Sync/i);
    fireEvent.change(select, { target: { value: "meeting-1" } });

    await waitFor(() => {
      expect(agendaRolloverApi.previewRollover).toHaveBeenCalledWith(
        "meeting-1",
      );
    });

    // Check preview items render correctly
    expect(screen.getByText("Incomplete Item 1")).toBeInTheDocument();
    expect(
      screen.getByText(/pacing recommendation: 15 min/i),
    ).toBeInTheDocument();
  });

  it("should copy selected preview items to the main agenda form state", async () => {
    render(<ScheduleMeeting hookProps={mockHookProps} />);

    // Toggle checkbox
    fireEvent.click(
      screen.getByLabelText(
        /rollover unfinished agenda items from previous meeting/i,
      ),
    );

    // Select meeting-1
    const select = screen.getByLabelText(/select previous meeting/i);
    await screen.findByText(/Project Sync/i);
    fireEvent.change(select, { target: { value: "meeting-1" } });

    await waitFor(() => {
      expect(agendaRolloverApi.previewRollover).toHaveBeenCalled();
    });

    // Click Apply Selected Topics button
    const applyButton = screen.getByRole("button", {
      name: /apply selected topics to agenda/i,
    });
    fireEvent.click(applyButton);

    expect(mockHookProps.setAgendaItems).toHaveBeenCalledWith([
      expect.objectContaining({
        text: "Incomplete Item 1",
        duration: 10,
        rolledOver: true,
      }),
    ]);
  });
});
