import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SpeakingTimeDashboard from "../SpeakingTimeDashboard.jsx";
import { speakingTimeApi } from "../../services";

vi.mock("../../services", () => ({
  speakingTimeApi: {
    getTrends: vi.fn(),
    getBreakdown: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../SpeakingCards", () => ({
  SpeakingMetricCard: ({ label, value, subtitle }) => (
    <div data-testid="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{subtitle}</small>
    </div>
  ),
  SpeakerCard: ({ member }) => (
    <div data-testid="speaker-card">{member.name}</div>
  ),
  BalanceScoreCard: ({ score, rating }) => (
    <div data-testid="balance-card">
      {score}:{rating}
    </div>
  ),
  PatternCard: ({ pattern }) => (
    <div data-testid="pattern-card">{pattern.name}</div>
  ),
  SpeakingRecommendationCard: ({ recommendation }) => (
    <div data-testid="recommendation-card">{recommendation.title}</div>
  ),
}));

vi.mock("../SpeakingCharts", () => ({
  SpeakingDistributionPie: ({ data }) => (
    <div data-testid="distribution-chart">
      {data.length} speakers
      {data.map((speaker) => (
        <span key={speaker.id || speaker.name}>{speaker.name}</span>
      ))}
    </div>
  ),
  BalanceTrendChart: ({ data }) => (
    <div data-testid="trend-chart">{data.length} trend points</div>
  ),
  PatternRadarChart: ({ patterns }) => (
    <div data-testid="pattern-chart">{patterns.length} patterns</div>
  ),
}));

const renderDashboard = () =>
  render(
    <BrowserRouter>
      <SpeakingTimeDashboard />
    </BrowserRouter>,
  );

describe("SpeakingTimeDashboard (#2441)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads trends and the latest meeting breakdown from speaking-time APIs", async () => {
    speakingTimeApi.getTrends.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            meetingId: "meeting-1",
            meetingTitle: "Previous meeting",
            date: "2026-08-20T10:00:00.000Z",
            totalDuration: 600,
            talkRatio: 42,
            utteranceCount: 12,
            overlapCount: 1,
          },
          {
            meetingId: "meeting-2",
            meetingTitle: "Latest meeting",
            date: "2026-08-27T10:00:00.000Z",
            totalDuration: 900,
            talkRatio: 38,
            utteranceCount: 18,
            overlapCount: 2,
          },
        ],
      },
    });
    speakingTimeApi.getBreakdown.mockResolvedValue({
      data: {
        success: true,
        data: {
          meetingSpan: 1800,
          totalDuration: 900,
          participants: [
            {
              identifier: "user-1",
              speakerName: "Alice",
              totalDuration: 500,
              utteranceCount: 10,
              longestUtterance: 90,
              overlapCount: 2,
              talkRatio: 27.8,
            },
            {
              identifier: "user-2",
              speakerName: "Bob",
              totalDuration: 400,
              utteranceCount: 8,
              longestUtterance: 80,
              overlapCount: 0,
              talkRatio: 22.2,
            },
          ],
        },
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(speakingTimeApi.getTrends).toHaveBeenCalledWith(12);
      expect(speakingTimeApi.getBreakdown).toHaveBeenCalledWith("meeting-2");
    });

    expect(screen.getByText("Speaking Time Analytics")).toBeInTheDocument();
    expect(screen.getByTestId("distribution-chart")).toHaveTextContent(
      "2 speakers",
    );
    expect(screen.getByTestId("trend-chart")).toHaveTextContent(
      "2 trend points",
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("does not use mock data when the API has no meetings", async () => {
    speakingTimeApi.getTrends.mockResolvedValue({
      data: { success: true, data: [] },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("No speaking-time data yet")).toBeInTheDocument();
    });

    expect(speakingTimeApi.getBreakdown).not.toHaveBeenCalled();
    expect(screen.queryByText("Sarah Chen")).not.toBeInTheDocument();
  });

  it("shows an API error and allows retrying", async () => {
    speakingTimeApi.getTrends
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              meetingId: "meeting-3",
              meetingTitle: "Recovered meeting",
              date: "2026-08-28T10:00:00.000Z",
              totalDuration: 300,
              talkRatio: 50,
              utteranceCount: 5,
              overlapCount: 0,
            },
          ],
        },
      });
    speakingTimeApi.getBreakdown.mockResolvedValue({
      data: {
        success: true,
        data: { meetingSpan: 600, totalDuration: 300, participants: [] },
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Network unavailable",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(speakingTimeApi.getTrends).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Recovered meeting/)).toBeInTheDocument();
    });
  });

  it("switches between dashboard tabs without making additional API requests", async () => {
    speakingTimeApi.getTrends.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            meetingId: "meeting-4",
            meetingTitle: "Tab test",
            date: "2026-08-28T10:00:00.000Z",
            totalDuration: 600,
            talkRatio: 50,
            utteranceCount: 10,
            overlapCount: 0,
          },
        ],
      },
    });
    speakingTimeApi.getBreakdown.mockResolvedValue({
      data: {
        success: true,
        data: {
          meetingSpan: 1200,
          totalDuration: 600,
          participants: [
            {
              identifier: "user-1",
              speakerName: "Alice",
              totalDuration: 300,
              utteranceCount: 5,
              longestUtterance: 60,
              overlapCount: 0,
              talkRatio: 25,
            },
          ],
        },
      },
    });

    renderDashboard();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: /patterns/i }));
    expect(screen.getByTestId("pattern-card")).toHaveTextContent("Alice");

    fireEvent.click(screen.getByRole("tab", { name: /improvements/i }));
    expect(screen.getByTestId("recommendation-card")).toBeInTheDocument();

    expect(speakingTimeApi.getTrends).toHaveBeenCalledTimes(1);
    expect(speakingTimeApi.getBreakdown).toHaveBeenCalledTimes(1);
  });
});
