import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeamAvailability from "../TeamAvailability.jsx";
import teamAvailabilityApi from "../../services/teamAvailabilityApi";
import AppContent from "../../context/AppContent";
import { BrowserRouter } from "react-router-dom";

// Mock teamAvailabilityApi
vi.mock("../../services/teamAvailabilityApi.js", () => ({
  default: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    getHeatmapData: vi.fn(),
    findFreeSlots: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <nav>Navbar</nav>,
}));

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
    userRole: "admin",
  }),
}));

const mockContextValue = {
  userData: { id: "user_1", role: "admin" },
};

const renderWithContext = (ui) => {
  return render(
    <BrowserRouter>
      <AppContent.Provider value={mockContextValue}>{ui}</AppContent.Provider>
    </BrowserRouter>,
  );
};

describe("TeamAvailability App Shell and Navigation (#2276)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Team Availability shell, renders Navbar, tabs, and checks heatmap API interaction", async () => {
    teamAvailabilityApi.getHeatmapData.mockResolvedValue([
      {
        date: "2026-08-24",
        hours: [
          {
            hour: 9,
            density: 1,
            busyUsers: [{ name: "Alice", type: "meeting" }],
          },
        ],
      },
    ]);

    renderWithContext(<TeamAvailability />);

    // Check header and Navbar chrome presence
    expect(screen.getByText("Team Availability")).toBeInTheDocument();
    expect(screen.getByText("Back to calendar")).toBeInTheDocument();

    // Verify loading and render of Heatmap data
    await waitFor(() => {
      expect(teamAvailabilityApi.getHeatmapData).toHaveBeenCalled();
      expect(
        screen.getByText("Weekly Utilization Heatmap"),
      ).toBeInTheDocument();
      expect(screen.getByText("1 Busy")).toBeInTheDocument();
    });

    // Check Tab navigation clicks
    const findSlotTabBtn = screen.getByText("Find Free Slot");
    fireEvent.click(findSlotTabBtn);

    await waitFor(() => {
      expect(screen.getByText("Find Free Common Slots")).toBeInTheDocument();
    });
  });
});
