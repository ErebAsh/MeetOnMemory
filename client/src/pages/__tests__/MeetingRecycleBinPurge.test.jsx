import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingRecycleBin from "../MeetingRecycleBin.jsx";
import { meetingApi } from "../../services/meetingApi.js";
import AppContent from "../../context/AppContent.js";
import { RBACProvider } from "../../context/RBACContext.jsx";
import { BrowserRouter } from "react-router-dom";

// Mock services/apis
vi.mock("../../services/meetingApi.js", () => ({
  meetingApi: {
    getDeletedMeetings: vi.fn(),
    getPurgePreview: vi.fn(),
    purgeTrash: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar" />,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const renderWithContext = (ui, { userRole = "admin" } = {}) => {
  const contextValue = {
    userData: { id: "user_1", role: userRole },
  };

  return render(
    <BrowserRouter>
      <AppContent.Provider value={contextValue}>
        <RBACProvider>{ui}</RBACProvider>
      </AppContent.Provider>
    </BrowserRouter>,
  );
};

describe("MeetingRecycleBin Bulk Purge and Preview Modal (#2274)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows purge button, displays preview counts/samples, requires typing PURGE to confirm", async () => {
    // 1. Mock trash list response
    meetingApi.getDeletedMeetings.mockResolvedValue({
      data: {
        success: true,
        meetings: [
          {
            _id: "m1",
            title: "Old Meeting in Trash",
            deletedAt: new Date().toISOString(),
            meetingType: "conference",
          },
        ],
        pagination: { page: 1, totalPages: 1 },
      },
    });

    // 2. Mock preview response
    meetingApi.getPurgePreview.mockResolvedValue({
      data: {
        success: true,
        data: {
          policy: {
            enabled: true,
            retentionPeriodDays: 30,
            gracePeriodDays: 7,
          },
          trash: {
            totalCount: 1,
            countsByType: { conference: 1 },
            samples: [
              {
                title: "Old Meeting in Trash",
                meetingType: "conference",
                deletedAt: new Date().toISOString(),
              },
            ],
          },
          sweep: {
            totalCount: 2,
            countsByType: { internal: 2 },
            samples: [
              {
                title: "Ancient internal sync",
                meetingType: "internal",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        },
      },
    });

    // 3. Mock purge action
    meetingApi.purgeTrash.mockResolvedValue({
      data: { success: true, deletedCount: 1 },
    });

    renderWithContext(<MeetingRecycleBin />);

    // Wait for page to load and render the purge button
    await waitFor(() => {
      expect(screen.getByText("Purge Recycle Bin")).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText("Purge Recycle Bin"));

    // Verify modal is loading and then renders preview stats
    await waitFor(() => {
      expect(screen.getByText("Purge Recycle Bin Preview")).toBeInTheDocument();
      expect(
        screen.getByText("Total Trash Meetings to Permanently Purge:"),
      ).toBeInTheDocument();
      expect(screen.getByText("conference: 1")).toBeInTheDocument();
      expect(
        screen.getByText("Total Expired Meetings to Hard Delete:"),
      ).toBeInTheDocument();
      expect(screen.getByText("internal: 2")).toBeInTheDocument();
    });

    const purgeSubmitButtons = screen.getAllByRole("button", {
      name: "Purge Recycle Bin",
    });
    const purgeSubmitBtn = purgeSubmitButtons[purgeSubmitButtons.length - 1];
    expect(purgeSubmitBtn).toBeDisabled();

    // Type incorrect value
    const input = screen.getByPlaceholderText(
      'Type "PURGE" to verify bulk delete',
    );
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(purgeSubmitBtn).toBeDisabled();

    // Type correct value
    fireEvent.change(input, { target: { value: "PURGE" } });
    expect(purgeSubmitBtn).toBeEnabled();

    // Submit bulk purge
    fireEvent.click(purgeSubmitBtn);

    await waitFor(() => {
      expect(meetingApi.purgeTrash).toHaveBeenCalled();
    });
  });
});
