import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import { isMeetingTranscriptEncrypted } from "../utils/transcriptEncryption.js";
export default (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected to transcript socket:", socket.id);

    // Join transcript room for a meeting
    socket.on("join-transcript-room", async ({ meetingId }) => {
      try {
        // RBAC: Check if user has permission to view meetings
        if (
          !socket.userRole ||
          !hasPermission(socket.userRole, "meetings", "view")
        ) {
          socket.emit("transcript-error", {
            message: "Forbidden: Insufficient permissions",
          });
          return;
        }

        // RBAC: Check if user has access to this specific meeting
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
          socket.emit("transcript-error", { message: "Meeting not found" });
          return;
        }

        const isOwner =
          meeting.uploadedBy?.toString() === socket.userId?.toString();
        const isInSameOrg =
          meeting.organization &&
          socket.userOrganization &&
          meeting.organization.toString() ===
            socket.userOrganization.toString();

        if (!isOwner && !isInSameOrg) {
          socket.emit("transcript-error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        const roomId = `meeting:${meetingId}:transcript`;
        socket.join(roomId);

        // Send current transcript status
        // Redact plaintext content if meeting is encrypted (E2EE)
        const transcript = await Transcript.findOne({ meeting: meetingId });
        if (transcript) {
          const isEncrypted = isMeetingTranscriptEncrypted(meeting);

          if (isEncrypted) {
            // Emit metadata only for encrypted meetings
            socket.emit("transcript-status", {
              status: transcript.status,
              isEncrypted: true,
              encryptedTranscript: meeting.encryptedTranscript || null,
              transcriptEncryptionVersion:
                meeting.transcriptEncryptionVersion || null,
            });
          } else {
            // Emit full plaintext content for unencrypted meetings
            socket.emit("transcript-status", {
              status: transcript.status,
              segments: transcript.segments,
              fullText: transcript.fullText,
            });
          }
        }
        console.log(`User ${socket.id} joined transcript room: ${roomId}`);
      } catch (error) {
        console.error("Error joining transcript room:", error);
        socket.emit("transcript-error", {
          message: "Failed to join transcript room",
        });
      }
    });

    // Leave transcript room
    socket.on("leave-transcript-room", ({ meetingId }) => {
      const roomId = `meeting:${meetingId}:transcript`;
      socket.leave(roomId);
      console.log(`User ${socket.id} left transcript room: ${roomId}`);
    });

    // Broadcast partial transcript segment (real-time)
    // Redact plaintext content if meeting is encrypted (E2EE)
    socket.on("transcript-segment", async ({ meetingId, segment }) => {
      if (!meetingId) {
        socket.emit("transcript-error", { message: "Meeting ID required" });
        return;
      }
      const roomId = `meeting:${meetingId}:transcript`;
      if (!socket.rooms || !socket.rooms.has(roomId)) {
        socket.emit("transcript-error", {
          message: "Forbidden: You have not joined this transcript room",
        });
        return;
      }

      try {
        const meeting = await Meeting.findById(meetingId);
        if (meeting && isMeetingTranscriptEncrypted(meeting)) {
          // Encrypted meeting: emit empty segment with encryption flag
          socket.to(roomId).emit("transcript-segment", {
            isEncrypted: true,
            timestamp: segment?.timestamp || null,
          });
        } else {
          // Plaintext meeting: emit full segment content
          socket.to(roomId).emit("transcript-segment", segment);
        }
      } catch (error) {
        console.error("Error checking meeting encryption:", error);
        socket.emit("transcript-error", {
          message: "Failed to broadcast transcript segment",
        });
      }
    });
    // Broadcast final transcript
    // Redact plaintext content if meeting is encrypted (E2EE)
    socket.on("transcript-final", async ({ meetingId, transcript }) => {
      if (!meetingId) {
        socket.emit("transcript-error", { message: "Meeting ID required" });
        return;
      }
      const roomId = `meeting:${meetingId}:transcript`;
      if (!socket.rooms || !socket.rooms.has(roomId)) {
        socket.emit("transcript-error", {
          message: "Forbidden: You have not joined this transcript room",
        });
        return;
      }

      try {
        const meeting = await Meeting.findById(meetingId);
        if (meeting && isMeetingTranscriptEncrypted(meeting)) {
          // Encrypted meeting: emit metadata-only update
          io.to(roomId).emit("transcript-final", {
            isEncrypted: true,
            meetingId: meetingId,
            encryptionVersion: meeting.transcriptEncryptionVersion || null,
          });
        } else {
          // Plaintext meeting: emit full transcript
          io.to(roomId).emit("transcript-final", transcript);
        }
      } catch (error) {
        console.error("Error checking meeting encryption:", error);
        socket.emit("transcript-error", {
          message: "Failed to broadcast final transcript",
        });
      }
    });
    // Disconnect handling
    socket.on("disconnect", () => {
      console.log("🔴 User disconnected from transcript socket:", socket.id);
    });
  });
};
