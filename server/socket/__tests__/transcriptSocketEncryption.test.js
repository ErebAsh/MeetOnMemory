// server/socket/__tests__/transcriptSocketEncryption.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import transcriptSocketHandler from "../transcriptSocket.js";
import Meeting from "../../models/meetingModel.js";
import Transcript from "../../models/transcriptModel.js";

vi.mock("../../models/meetingModel.js");
vi.mock("../../models/transcriptModel.js");
vi.mock("../../utils/rbacPermissions.js", () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));
vi.mock("../../utils/transcriptEncryption.js", () => ({
  isMeetingTranscriptEncrypted: vi.fn((meeting) =>
    Boolean(meeting?.isTranscriptEncrypted),
  ),
}));

describe("Transcript Socket Encryption (#2646)", () => {
  let ioMock;
  let socketMock;
  let eventHandlers;

  beforeEach(() => {
    eventHandlers = {};
    socketMock = {
      id: "socket_123",
      userId: "user_123",
      userRole: "member",
      userOrganization: "org_123",
      rooms: new Set(["socket_123"]),
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
      join: vi.fn((room) => socketMock.rooms.add(room)),
      leave: vi.fn((room) => socketMock.rooms.delete(room)),
    };

    ioMock = {
      on: vi.fn((event, handler) => {
        if (event === "connection") {
          handler(socketMock);
        }
      }),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    vi.clearAllMocks();
    transcriptSocketHandler(ioMock);
  });

  describe("join-transcript-room with encryption", () => {
    it("emits plaintext segments/fullText for unencrypted meetings", async () => {
      const meetingId = "meeting_123";
      const roomId = `meeting:${meetingId}:transcript`;

      Meeting.findById.mockResolvedValue({
        _id: meetingId,
        isTranscriptEncrypted: false,
        uploadedBy: "user_123",
        organization: "org_123",
      });

      Transcript.findOne.mockResolvedValue({
        status: "completed",
        segments: [{ text: "Hello world", speaker: "user1" }],
        fullText: "Hello world",
      });

      await eventHandlers["join-transcript-room"]({ meetingId });

      expect(socketMock.emit).toHaveBeenCalledWith("transcript-status", {
        status: "completed",
        segments: [{ text: "Hello world", speaker: "user1" }],
        fullText: "Hello world",
      });
    });

    it("emits metadata-only for encrypted meetings (no plaintext segments)", async () => {
      const meetingId = "meeting_encrypted";
      const roomId = `meeting:${meetingId}:transcript`;

      Meeting.findById.mockResolvedValue({
        _id: meetingId,
        isTranscriptEncrypted: true,
        transcriptEncryptionVersion: 1,
        encryptedTranscript: {
          ciphertext: "abc123...",
          iv: "def456...",
        },
        uploadedBy: "user_123",
        organization: "org_123",
      });

      Transcript.findOne.mockResolvedValue({
        status: "completed",
        segments: [{ text: "ENCRYPTED", speaker: "encrypted_user" }],
        fullText: "ENCRYPTED CONTENT",
      });

      await eventHandlers["join-transcript-room"]({ meetingId });

      const emitCall = socketMock.emit.mock.calls.find(
        (call) => call[0] === "transcript-status",
      );

      expect(emitCall[1]).toEqual({
        status: "completed",
        isEncrypted: true,
        encryptedTranscript: {
          ciphertext: "abc123...",
          iv: "def456...",
        },
        transcriptEncryptionVersion: 1,
      });

      // Verify plaintext NOT included
      expect(emitCall[1].segments).toBeUndefined();
      expect(emitCall[1].fullText).toBeUndefined();
    });
  });

  describe("transcript-segment with encryption", () => {
    it("broadcasts plaintext segment for unencrypted meetings", async () => {
      const meetingId = "meeting_123";
      const roomId = `meeting:${meetingId}:transcript`;
      socketMock.rooms.add(roomId);

      Meeting.findById.mockResolvedValue({
        _id: meetingId,
        isTranscriptEncrypted: false,
      });

      const segment = { text: "Hello", speaker: "Alice", timestamp: 1000 };
      await eventHandlers["transcript-segment"]({ meetingId, segment });

      expect(socketMock.to).toHaveBeenCalledWith(roomId);
      expect(socketMock.to().emit).toHaveBeenCalledWith(
        "transcript-segment",
        segment,
      );
    });

    it("broadcasts encrypted marker only for encrypted meetings (no plaintext)", async () => {
      const meetingId = "meeting_encrypted";
      const roomId = `meeting:${meetingId}:transcript`;
      socketMock.rooms.add(roomId);

      Meeting.findById.mockResolvedValue({
        _id: meetingId,
        isTranscriptEncrypted: true,
      });

      const segment = {
        text: "PLAINTEXT LEAK",
        speaker: "Alice",
        timestamp: 1000,
      };
      await eventHandlers["transcript-segment"]({ meetingId, segment });

      expect(socketMock.to).toHaveBeenCalledWith(roomId);
      const emitCall = socketMock.to().emit.mock.calls[0];
      expect(emitCall[0]).toBe("transcript-segment");
      expect(emitCall[1]).toEqual({
        isEncrypted: true,
        timestamp: 1000,
      });

      // Verify plaintext NOT included
      expect(emitCall[1].text).toBeUndefined();
    });
  });

  describe("transcript-final with encryption", () => {
    it("broadcasts plaintext transcript for unencrypted meetings", async () => {
      const meetingId = "meeting_123";
      const roomId = `meeting:${meetingId}:transcript`;
      socketMock.rooms.add(roomId);

      Meeting.findById.mockResolvedValue({
        _id: meetingId,
        isTranscriptEncrypted: false,
      });

      const transcript = { fullText: "Complete transcript" };
      await eventHandlers["transcript-final"]({ meetingId, transcript });

      expect(ioMock.to).toHaveBeenCalledWith(roomId);
      expect(ioMock.to().emit).toHaveBeenCalledWith(
        "transcript-final",
        transcript,
      );
    });

    it("broadcasts encrypted metadata only for encrypted meetings (no plaintext)", async () => {
      const meetingId = "meeting_encrypted";
      const roomId = `meeting:${meetingId}:transcript`;
      socketMock.rooms.add(roomId);

      Meeting.findById.mockResolvedValue({
        _id: meetingId,
        isTranscriptEncrypted: true,
        transcriptEncryptionVersion: 1,
      });

      const transcript = { fullText: "PLAINTEXT LEAK" };
      await eventHandlers["transcript-final"]({ meetingId, transcript });

      expect(ioMock.to).toHaveBeenCalledWith(roomId);
      const emitCall = ioMock.to().emit.mock.calls[0];
      expect(emitCall[0]).toBe("transcript-final");
      expect(emitCall[1]).toEqual({
        isEncrypted: true,
        meetingId: meetingId,
        encryptionVersion: 1,
      });

      // Verify plaintext NOT included
      expect(emitCall[1].fullText).toBeUndefined();
    });
  });
});
