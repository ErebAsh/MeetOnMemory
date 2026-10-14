import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import ScheduleMeeting from "../ScheduleMeeting/ScheduleMeeting";
import LiveMeeting from "../LiveMeeting/LiveMeeting";
import SessionCards from "../SessionCards/SessionCards";
import MeetingInformationForm from "../ScheduleMeeting/MeetingInformationForm";
import AppContent from "../../../../context/AppContent";

describe("CreateMeeting dark mode support", () => {
  it("renders ScheduleMeeting with dark mode classes", () => {
    const mockHookProps = {
      scheduleData: {
        title: "Test",
        meetingType: "internal",
        date: "2026-08-20",
        time: "10:00",
      },
      setScheduleData: vi.fn(),
      participants: [{ id: "1", name: "Alice", email: "alice@test.com" }],
      newParticipant: { name: "", email: "" },
      setNewParticipant: vi.fn(),
      agendaItems: [{ id: "a1", text: "Agenda 1" }],
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
      handleScheduleSubmit: vi.fn((e) => e.preventDefault()),
      recoverableDraft: null,
      lastSavedAt: null,
      draftStatus: "idle",
      restoreDraft: vi.fn(),
      discardDraft: vi.fn(),
      aiSummaryTemplates: [],
      selectedAiSummaryTemplateId: "",
      setSelectedAiSummaryTemplateId: vi.fn(),
      setAgendaItems: vi.fn(),
      customFields: null,
      setCustomFields: vi.fn(),
      userData: { organization: "org-1" },
    };

    const { container } = render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: { organization: "org-1" } }}>
          <ScheduleMeeting hookProps={mockHookProps} />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    const scheduleCard = container.querySelector(".dark\\:bg-slate-900");
    expect(scheduleCard).toBeTruthy();
    expect(screen.getByText("Schedule Meeting")).toHaveClass("dark:text-white");
  });

  it("renders LiveMeeting with dark mode classes", () => {
    const mockHookProps = {
      liveParticipants: [{ id: "1", name: "Bob", email: "bob@test.com" }],
      newLiveParticipant: { name: "", email: "" },
      setNewLiveParticipant: vi.fn(),
      showRecordingDialog: false,
      addLiveParticipant: vi.fn(),
      removeLiveParticipant: vi.fn(),
      handleStartLiveMeeting: vi.fn(),
      handleRecordingChoice: vi.fn(),
    };

    const { container } = render(<LiveMeeting hookProps={mockHookProps} />);
    const liveCard = container.querySelector(".dark\\:bg-slate-900");
    expect(liveCard).toBeTruthy();
    expect(screen.getByText("Start Live Meeting")).toHaveClass(
      "dark:text-white",
    );
  });

  it("renders SessionCards with dark mode classes", () => {
    const mockHookProps = {
      sessionData: {
        eventName: "Event 1",
        sessionTitle: "Session 1",
        speaker: "Dr. Who",
        speakerTitle: "Time Lord",
        speakerBio: "Bio",
      },
      slideFiles: [],
      videoFile: null,
      generatedSessions: [
        {
          eventName: "Event 1",
          sessionTitle: "Session 1",
          speaker: "Dr. Who",
          speakerTitle: "Time Lord",
          summary: "Summary text",
          keywords: ["AI", "Future"],
        },
      ],
      loading: false,
      handleSessionChange: vi.fn(),
      handleSlideUpload: vi.fn(),
      handleVideoUpload: vi.fn(),
      removeSlideFile: vi.fn(),
      handleSessionSubmit: vi.fn((e) => e.preventDefault()),
    };

    const { container } = render(
      <MemoryRouter>
        <SessionCards hookProps={mockHookProps} />
      </MemoryRouter>,
    );
    const sessionCard = container.querySelector(".dark\\:bg-slate-900");
    expect(sessionCard).toBeTruthy();
    expect(screen.getByText("Auto Session Card Generation")).toHaveClass(
      "dark:text-white",
    );
    expect(screen.getByText(/Saved & Generated Session Cards/i)).toHaveClass(
      "dark:text-white",
    );
  });

  it("renders MeetingInformationForm with dark inputs", () => {
    const mockProps = {
      scheduleData: {
        title: "Title",
        description: "Desc",
        date: "2026-08-20",
        time: "10:00",
        duration: 60,
        meetingType: "internal",
      },
      setScheduleData: vi.fn(),
      handleScheduleChange: vi.fn(),
    };

    const { container } = render(<MeetingInformationForm {...mockProps} />);
    const input = container.querySelector('input[name="title"]');
    expect(input).toHaveClass("dark:bg-gray-800");
    expect(input).toHaveClass("dark:text-gray-100");
  });
});
