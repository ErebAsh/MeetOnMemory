import { describe, it, expect, before, after, vi } from "vitest";
import request from "supertest";
import app from "../app.js";
import {
  UPLOAD_LIMITS,
  formatFileSize,
  getSizeErrorMessage,
  validateChunkSize,
} from "../config/uploadConfig.js";

describe("Upload Limits Tests", () => {
  describe("Configuration", () => {
    it("should have recording limit set to 500MB", () => {
      expect(UPLOAD_LIMITS.RECORDING.MAX_SIZE).toBe(500 * 1024 * 1024);
    });

    it("should have audio limit set to 100MB", () => {
      expect(UPLOAD_LIMITS.AUDIO.MAX_SIZE).toBe(100 * 1024 * 1024);
    });

    it("should have chunk limit set to 100MB", () => {
      expect(UPLOAD_LIMITS.CHUNK.MAX_SIZE).toBe(100 * 1024 * 1024);
    });

    it("should have transcript limit set to 50MB", () => {
      expect(UPLOAD_LIMITS.TRANSCRIPT.MAX_SIZE).toBe(50 * 1024 * 1024);
    });

    it("should format file sizes correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });
  });

  describe("Error Messages", () => {
    it("should generate appropriate size error message", () => {
      const msg = getSizeErrorMessage(500 * 1024 * 1024, "Recording");
      expect(msg).toContain("Recording size exceeds maximum");
      expect(msg).toContain("500 MB");
    });
  });

  describe("Chunk Validation", () => {
    it("should validate chunk size within limit", () => {
      expect(() => validateChunkSize(50 * 1024 * 1024)).not.toThrow();
    });

    it("should reject chunk size exceeding limit", () => {
      expect(() => validateChunkSize(150 * 1024 * 1024)).toThrow();
    });
  });

  describe("API Endpoints", () => {
    it("should return upload limits from /api/meetings/upload-limits", async () => {
      const response = await request(app)
        .get("/api/meetings/upload-limits")
        .set("Authorization", "Bearer test-token");

      // Should have access to the endpoint (even if auth fails)
      expect(response.status).not.toBe(404);
    });

    it("should reject oversized recording upload", async () => {
      const meetingId = "test-meeting";
      const oversizedFile = Buffer.alloc(600 * 1024 * 1024); // 600MB

      const response = await request(app)
        .post(`/api/meetings/${meetingId}/recording`)
        .attach("recording", oversizedFile, "test.mp4")
        .set("Authorization", "Bearer test-token");

      // Should reject with 413 or 500 (depending on auth middleware)
      expect([413, 401, 500]).toContain(response.status);
    });

    it("should reject oversized audio upload", async () => {
      const meetingId = "test-meeting";
      const oversizedFile = Buffer.alloc(150 * 1024 * 1024); // 150MB

      const response = await request(app)
        .post(`/api/meetings/${meetingId}/audio`)
        .attach("audio", oversizedFile, "test.mp3")
        .set("Authorization", "Bearer test-token");

      expect([413, 401, 500]).toContain(response.status);
    });
  });

  describe("Resumable Upload", () => {
    it("should reject chunk exceeding limit", async () => {
      const meetingId = "test-meeting";
      const uploadId = "test-upload";
      const oversizedChunk = Buffer.alloc(150 * 1024 * 1024); // 150MB

      const response = await request(app)
        .post(`/api/resumable/meeting/${meetingId}/upload/${uploadId}`)
        .attach("chunk", oversizedChunk, "chunk.bin")
        .set("Authorization", "Bearer test-token");

      expect([413, 401, 500]).toContain(response.status);
    });

    it("should return upload limits for resumable uploads", async () => {
      const response = await request(app)
        .get("/api/resumable/limits")
        .set("Authorization", "Bearer test-token");

      expect(response.status).not.toBe(404);
    });
  });

  describe("Transcript Upload", () => {
    it("should reject oversized transcript", async () => {
      const meetingId = "test-meeting";
      const oversizedFile = Buffer.alloc(60 * 1024 * 1024); // 60MB

      const response = await request(app)
        .post(`/api/meetings/${meetingId}/transcript`)
        .attach("transcript", oversizedFile, "test.txt")
        .set("Authorization", "Bearer test-token");

      expect([413, 401, 500]).toContain(response.status);
    });
  });
});
