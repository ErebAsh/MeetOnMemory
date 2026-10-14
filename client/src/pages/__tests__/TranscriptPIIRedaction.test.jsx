import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TranscriptViewer from "../TranscriptViewer.jsx";
import api from "../../services/apiClient.js";
import AppContent from "../../context/AppContent.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="app-navbar">App Navbar</div>,
}));

vi.mock("../../components/MeetingSentimentChart", () => ({
  default: () => <div data-testid="sentiment-chart">Sentiment Chart</div>,
}));

vi.mock("../../components/meeting-details/SpeakerAttribution", () => ({
  default: () => (
    <div data-testid="speaker-attribution">Speaker Attribution</div>
  ),
}));

vi.mock("../../components/meeting-details/TranscriptTimelineScrubber", () => ({
  default: () => <div data-testid="timeline-scrubber">Timeline Scrubber</div>,
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockUserDataAdmin = {
  _id: "admin-123",
  name: "Admin User",
  role: "admin",
  organization: "org-123",
};

const mockUserDataMember = {
  _id: "member-123",
  name: "Member User",
  role: "member",
  organization: "org-123",
};

const mockTranscriptRedacted = {
  _id: "transcript-123",
  meeting: {
    _id: "meeting-123",
    title: "Project Sync",
    date: new Date().toISOString(),
    isRedacted: true,
    uploadedBy: "admin-123",
    organization: "org-123",
  },
  duration: 120,
  segments: [
    {
      text: "Email is [REDACTED_EMAIL].",
      speaker: "Alice",
      startTime: 0,
      endTime: 5,
    },
  ],
};

const mockDecryptedOriginal = {
  success: true,
  original: {
    transcript: "Email is user@example.com.",
    summary: "Alice's email is user@example.com.",
    aiNotes: "",
    transcriptSegments: JSON.stringify([
      {
        text: "Email is user@example.com.",
        speaker: "Alice",
        startTime: 0,
        endTime: 5,
      },
    ]),
  },
};

describe("TranscriptViewer PII Redaction UI Integration (#2557)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render redacted badge when meeting is flagged as redacted", async () => {
    api.get.mockResolvedValue({ data: mockTranscriptRedacted });

    render(
      <AppContent.Provider value={{ userData: mockUserDataMember }}>
        <MemoryRouter initialEntries={["/meeting/meeting-123/transcript"]}>
          <Routes>
            <Route
              path="/meeting/:meetingId/transcript"
              element={<TranscriptViewer />}
            />
          </Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );

    // Verify redacted badge is rendered
    await waitFor(() => {
      expect(screen.getByTestId("redacted-badge")).toBeInTheDocument();
      expect(screen.getByText("PII Masked/Scrubbed")).toBeInTheDocument();
    });

    // Verify standard members do NOT see the Reveal Original button
    expect(screen.queryByTestId("reveal-original-btn")).not.toBeInTheDocument();
  });

  it("should show Reveal Original button for Admin and update content on click confirmation", async () => {
    api.get.mockImplementation((url) => {
      if (url.includes("/raw")) {
        return Promise.resolve({ data: mockDecryptedOriginal });
      }
      return Promise.resolve({ data: mockTranscriptRedacted });
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <AppContent.Provider value={{ userData: mockUserDataAdmin }}>
        <MemoryRouter initialEntries={["/meeting/meeting-123/transcript"]}>
          <Routes>
            <Route
              path="/meeting/:meetingId/transcript"
              element={<TranscriptViewer />}
            />
          </Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );

    // Reveal Original button should be shown for Admin
    await waitFor(() => {
      expect(screen.getByTestId("reveal-original-btn")).toBeInTheDocument();
    });

    // Click Reveal Original
    const revealBtn = screen.getByTestId("reveal-original-btn");
    fireEvent.click(revealBtn);

    // Verify confirm was triggered and raw endpoint was requested
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/api/meetings/meeting-123/raw");
      // Segment text should update to reveal the raw unredacted email
      expect(
        screen.getByText("Email is user@example.com."),
      ).toBeInTheDocument();
    });
  });
});
