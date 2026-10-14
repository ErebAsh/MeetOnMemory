/**
 * Tests for icebreakerApi.js (Issue #2622).
 *
 * Verifies that every call uses the /api/icebreakers prefix so the requests
 * reach the Express router which mounts icebreakerRoutes under that path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from "../apiClient";
import icebreakerApi from "../icebreakerApi";

describe("icebreakerApi (#2622) — /api prefix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generate posts to /api/icebreakers/generate with meetingId", async () => {
    api.post.mockResolvedValue({ data: { success: true, question: "Q" } });
    await icebreakerApi.generate("meeting-1");
    expect(api.post).toHaveBeenCalledWith("/api/icebreakers/generate", {
      meetingId: "meeting-1",
    });
  });

  it("select posts to /api/icebreakers/select with meetingId and question", async () => {
    api.post.mockResolvedValue({
      data: { success: true, question: "Why ice?" },
    });
    await icebreakerApi.select("meeting-2", "Why ice?");
    expect(api.post).toHaveBeenCalledWith("/api/icebreakers/select", {
      meetingId: "meeting-2",
      question: "Why ice?",
    });
  });

  it("getForMeeting GETs /api/icebreakers/meeting/:meetingId", async () => {
    api.get.mockResolvedValue({ data: { success: true, question: "Q" } });
    await icebreakerApi.getForMeeting("meeting-3");
    expect(api.get).toHaveBeenCalledWith("/api/icebreakers/meeting/meeting-3");
  });

  it("never produces a /api/api double-prefix", async () => {
    api.post.mockResolvedValue({ data: {} });
    api.get.mockResolvedValue({ data: {} });

    await icebreakerApi.generate("m");
    await icebreakerApi.select("m", "Q");
    await icebreakerApi.getForMeeting("m");

    const allCalls = [...api.post.mock.calls, ...api.get.mock.calls];
    for (const [path] of allCalls) {
      expect(path).not.toContain("/api/api/");
      expect(path.startsWith("/api/icebreakers")).toBe(true);
    }
  });

  it("generate returns the resolved response data", async () => {
    const mockResponse = { data: { success: true, question: "Fun question?" } };
    api.post.mockResolvedValue(mockResponse);
    const result = await icebreakerApi.generate("m1");
    expect(result).toBe(mockResponse);
  });
});
