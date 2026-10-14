import Meeting from "../models/Meeting.js";
import Organization from "../models/Organization.js";
import GuestAccess from "../models/GuestAccess.js";
import {
  getGuestTranscriptAccess,
  getGuestEncryptedEnvelope,
  isE2EEEnabled,
  decryptTranscript,
  isEncrypted,
  generateEncryptedPreview,
} from "../utils/transcriptEncryption.js";
import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

/**
 * Validate guest access token
 */
const validateGuestToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.GUEST_ACCESS_SECRET || process.env.JWT_SECRET,
    );
    return decoded;
  } catch (error) {
    logger.error("Invalid guest token:", error);
    return null;
  }
};

/**
 * Create guest access for a meeting
 */
export const createGuestAccess = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { expiresIn, accessLevel } = req.body;
    const userId = req.user.id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found",
      });
    }

    // Check if user has permission to create guest access
    if (meeting.createdBy.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to create guest access",
      });
    }

    // Generate guest token
    const token = jwt.sign(
      {
        meetingId,
        accessLevel: accessLevel || "view",
        createdBy: userId,
        createdAt: Date.now(),
      },
      process.env.GUEST_ACCESS_SECRET || process.env.JWT_SECRET,
      { expiresIn: expiresIn || "7d" },
    );

    // Create guest access record
    const guestAccess = new GuestAccess({
      meetingId,
      createdBy: userId,
      token,
      accessLevel: accessLevel || "view",
      expiresAt: new Date(
        Date.now() +
          (expiresIn ? parseExpiry(expiresIn) : 7 * 24 * 60 * 60 * 1000),
      ),
      metadata: {
        createdAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    await guestAccess.save();

    // Generate shareable link
    const shareableLink = `${process.env.CLIENT_URL}/guest/${token}`;

    logger.info(
      `Guest access created for meeting ${meetingId} by user ${userId}`,
    );

    res.json({
      success: true,
      data: {
        token,
        shareableLink,
        expiresAt: guestAccess.expiresAt,
        accessLevel: guestAccess.accessLevel,
      },
    });
  } catch (error) {
    logger.error("Create guest access error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create guest access",
      details: error.message,
    });
  }
};

/**
 * Get guest meeting view
 */
export const getGuestMeetingView = async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token
    const decoded = validateGuestToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired guest token",
        code: "INVALID_TOKEN",
      });
    }

    // Check if guest access is still valid
    const guestAccess = await GuestAccess.findOne({ token });
    if (!guestAccess) {
      return res.status(404).json({
        success: false,
        error: "Guest access not found",
        code: "ACCESS_NOT_FOUND",
      });
    }

    if (guestAccess.expiresAt && new Date() > guestAccess.expiresAt) {
      return res.status(401).json({
        success: false,
        error: "Guest access has expired",
        code: "ACCESS_EXPIRED",
      });
    }

    // Get meeting
    const meeting = await Meeting.findById(guestAccess.meetingId)
      .populate("createdBy", "name email")
      .populate("participants", "name email");

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found",
        code: "MEETING_NOT_FOUND",
      });
    }

    // Get organization to check E2EE status
    const organization = await Organization.findById(meeting.organizationId);

    // Get transcript access based on encryption
    const transcriptAccess = getGuestTranscriptAccess(meeting, organization);

    // Build response based on access level
    const response = {
      success: true,
      data: {
        meeting: {
          id: meeting._id,
          title: meeting.title,
          description: meeting.description,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          status: meeting.status,
          createdBy: {
            name: meeting.createdBy?.name,
            email: meeting.createdBy?.email,
          },
          participants:
            meeting.participants?.map((p) => ({
              name: p.name,
              email: p.email,
            })) || [],
        },
        access: {
          level: guestAccess.accessLevel,
          expiresAt: guestAccess.expiresAt,
        },
      },
    };

    // Add transcript based on encryption status
    if (meeting.transcript && guestAccess.accessLevel === "view") {
      const isE2EE = isE2EEEnabled(organization);
      const isTranscriptEncrypted = meeting.isTranscriptEncrypted || false;

      // Case 1: E2EE enabled or transcript encrypted - return encrypted envelope
      if (isE2EE || isTranscriptEncrypted) {
        const envelope = getGuestEncryptedEnvelope(meeting, organization);
        response.data.transcript = {
          encrypted: true,
          envelope,
          requiresDecryption: true,
          // If we have the encryption secret, provide encrypted data for client-side decryption
          encryptedData:
            isTranscriptEncrypted && meeting.transcript
              ? {
                  encrypted: meeting.transcript.encrypted,
                  iv: meeting.transcript.iv,
                  salt: meeting.transcript.salt,
                  authTag: meeting.transcript.authTag,
                  algorithm: meeting.transcript.algorithm || "aes-256-gcm",
                }
              : null,
          preview: transcriptAccess.canAccess
            ? null
            : meeting.transcript
              ? "[Encrypted content]"
              : null,
        };

        logger.info(`Guest access (encrypted) to meeting ${meeting._id}`);
      }
      // Case 2: Plaintext transcript allowed
      else if (transcriptAccess.canAccess) {
        response.data.transcript = {
          encrypted: false,
          content: meeting.transcript,
          preview: meeting.transcript?.substring(0, 200),
        };
        logger.info(`Guest access (plaintext) to meeting ${meeting._id}`);
      }
      // Case 3: Restricted access
      else {
        response.data.transcript = {
          encrypted: false,
          content: null,
          preview: null,
          restricted: true,
          message: transcriptAccess.canAccess
            ? "Access granted"
            : "Transcript access restricted",
        };
      }
    } else {
      response.data.transcript = {
        encrypted: false,
        content: null,
        preview: null,
        available: false,
        message: "No transcript available",
      };
    }

    // Log guest access
    guestAccess.metadata.lastAccessedAt = new Date();
    guestAccess.metadata.accessCount =
      (guestAccess.metadata.accessCount || 0) + 1;
    await guestAccess.save();

    res.json(response);
  } catch (error) {
    logger.error("Get guest meeting view error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get meeting view",
      details: error.message,
    });
  }
};

/**
 * Guest decrypt transcript endpoint
 * Client sends encrypted data + decryption key
 */
export const guestDecryptTranscript = async (req, res) => {
  try {
    const { token } = req.params;
    const { encryptedData, decryptionKey } = req.body;

    // Validate guest token
    const decoded = validateGuestToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired guest token",
      });
    }

    if (!encryptedData || !decryptionKey) {
      return res.status(400).json({
        success: false,
        error: "Encrypted data and decryption key are required",
      });
    }

    // Verify guest access
    const guestAccess = await GuestAccess.findOne({ token });
    if (
      !guestAccess ||
      (guestAccess.expiresAt && new Date() > guestAccess.expiresAt)
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired guest access",
      });
    }

    // Decrypt transcript
    try {
      const decrypted = decryptTranscript(encryptedData, decryptionKey);

      // Log decryption attempt
      logger.info(
        `Guest decrypted transcript for token ${token.substring(0, 10)}...`,
      );

      res.json({
        success: true,
        data: {
          transcript: decrypted,
          decryptedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Guest decryption error:", error);
      res.status(400).json({
        success: false,
        error: "Failed to decrypt transcript",
        details: error.message,
      });
    }
  } catch (error) {
    logger.error("Guest decrypt transcript error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process decryption request",
    });
  }
};

/**
 * Revoke guest access
 */
export const revokeGuestAccess = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.id;

    const guestAccess = await GuestAccess.findOne({ token });
    if (!guestAccess) {
      return res.status(404).json({
        success: false,
        error: "Guest access not found",
      });
    }

    // Check if user has permission to revoke
    if (
      guestAccess.createdBy.toString() !== userId &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to revoke this guest access",
      });
    }

    guestAccess.isRevoked = true;
    guestAccess.revokedAt = new Date();
    guestAccess.revokedBy = userId;
    await guestAccess.save();

    logger.info(
      `Guest access revoked: ${token.substring(0, 10)}... by user ${userId}`,
    );

    res.json({
      success: true,
      message: "Guest access revoked successfully",
    });
  } catch (error) {
    logger.error("Revoke guest access error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to revoke guest access",
    });
  }
};

/**
 * Get guest access status
 */
export const getGuestAccessStatus = async (req, res) => {
  try {
    const { token } = req.params;

    const guestAccess = await GuestAccess.findOne({ token }).populate(
      "meetingId",
      "title status",
    );

    if (!guestAccess) {
      return res.status(404).json({
        success: false,
        error: "Guest access not found",
      });
    }

    const isExpired =
      guestAccess.expiresAt && new Date() > guestAccess.expiresAt;
    const isRevoked = guestAccess.isRevoked || false;

    res.json({
      success: true,
      data: {
        valid: !isExpired && !isRevoked,
        expiresAt: guestAccess.expiresAt,
        isExpired,
        isRevoked,
        accessLevel: guestAccess.accessLevel,
        meeting: {
          id: guestAccess.meetingId._id,
          title: guestAccess.meetingId.title,
          status: guestAccess.meetingId.status,
        },
        metadata: {
          createdAt: guestAccess.metadata.createdAt,
          lastAccessedAt: guestAccess.metadata.lastAccessedAt,
          accessCount: guestAccess.metadata.accessCount || 0,
        },
      },
    });
  } catch (error) {
    logger.error("Get guest access status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get guest access status",
    });
  }
};

/**
 * Parse expiry string to milliseconds
 */
const parseExpiry = (expiryStr) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  const match = expiryStr.match(/^(\d+)([smhdw])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  return parseInt(match[1]) * units[match[2]];
};

export default {
  createGuestAccess,
  getGuestMeetingView,
  guestDecryptTranscript,
  revokeGuestAccess,
  getGuestAccessStatus,
};
