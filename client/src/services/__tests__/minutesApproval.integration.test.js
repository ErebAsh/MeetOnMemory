import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../apiClient";
import * as minutesApprovalApi from "../minutesApprovalApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("Minutes Approval Client Service Integration Tests (#2666)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Contract Assertions", () => {
    it("should call GET /meetings/:meetingId/minutes-approval when fetching status", async () => {
      const mockResponse = {
        data: {
          success: true,
          status: "pending",
          data: { meetingId: "m-123" },
        },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      const res = await minutesApprovalApi.getApprovalStatus("m-123");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/meetings/m-123/minutes-approval",
      );
      expect(res).toEqual(mockResponse);
    });

    it("should call POST /meetings/:meetingId/minutes-approval/submit with payload when submitting minutes", async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { meetingId: "m-123", status: "pending" },
        },
      };
      apiClient.post.mockResolvedValueOnce(mockResponse);

      const res = await minutesApprovalApi.submitApproval(
        "m-123",
        "Key discussion notes and decisions",
        ["user-1", "user-2"],
      );

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-123/minutes-approval/submit",
        {
          snapshotSummary: "Key discussion notes and decisions",
          approvers: ["user-1", "user-2"],
        },
      );
      expect(res).toEqual(mockResponse);
    });

    it("should call PUT /meetings/:meetingId/minutes-approval/respond with payload when responding", async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { meetingId: "m-123", status: "approved" },
        },
      };
      apiClient.put.mockResolvedValueOnce(mockResponse);

      const res = await minutesApprovalApi.respondApproval(
        "m-123",
        "approved",
        "Looks good to me",
      );

      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/meetings/m-123/minutes-approval/respond",
        {
          status: "approved",
          comment: "Looks good to me",
        },
      );
      expect(res).toEqual(mockResponse);
    });
  });

  describe("Negative Error Handling Contracts", () => {
    it("handles 401 unauthenticated response", async () => {
      const authError = new Error("Session expired. Please log in again.");
      authError.response = { status: 401, data: { error: "Unauthorized" } };
      apiClient.get.mockRejectedValueOnce(authError);

      await expect(
        minutesApprovalApi.getApprovalStatus("m-123"),
      ).rejects.toThrow("Session expired");
    });

    it("handles 404 no minutes submitted error on respond", async () => {
      const notFoundError = new Error("The requested resource was not found.");
      notFoundError.response = {
        status: 404,
        data: { error: "No minutes have been submitted for this meeting" },
      };
      apiClient.put.mockRejectedValueOnce(notFoundError);

      await expect(
        minutesApprovalApi.respondApproval(
          "m-nonexistent",
          "approved",
          "comment",
        ),
      ).rejects.toThrow("resource was not found");
    });

    it("handles 400 validation error when submitting empty approvers", async () => {
      const valError = new Error("approvers must be a non-empty array");
      valError.response = {
        status: 400,
        data: { error: "approvers must be a non-empty array" },
      };
      apiClient.post.mockRejectedValueOnce(valError);

      await expect(
        minutesApprovalApi.submitApproval("m-123", "Summary", []),
      ).rejects.toThrow("approvers must be a non-empty array");
    });
  });
});
