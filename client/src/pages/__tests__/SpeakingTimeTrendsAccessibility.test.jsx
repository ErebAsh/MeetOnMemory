import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import SpeakingTimeTrends from "../SpeakingTimeTrends.jsx";
import { speakingTimeApi } from "../../services";

vi.mock("../../services", () => ({
  speakingTimeApi: {
    getTrends: vi.fn(),
  },
}));

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
  }),
}));

describe("SpeakingTimeTrends Accessibility (#1610)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders chart and table with WAI-ARIA region roles and table scopes", async () => {
    speakingTimeApi.getTrends.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            meetingId: "m1",
            meetingTitle: "Sprint Planning",
            date: "2026-08-10T10:00:00.000Z",
            talkRatio: 35.5,
            totalDuration: 1800,
            overlapCount: 2,
          },
        ],
      },
    });

    render(
      <BrowserRouter>
        <SpeakingTimeTrends />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    });

    const regions = screen.getAllByRole("region");
    expect(regions.length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("region", { name: /talk ratio over time chart/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: /recent meetings speaking breakdown/i,
      }),
    ).toBeInTheDocument();

    const table = screen.getByRole("table", {
      name: /speaking time breakdown table/i,
    });
    expect(table).toBeInTheDocument();

    const columnHeaders = screen.getAllByRole("columnheader");
    expect(columnHeaders.length).toBe(5);
  });
});
