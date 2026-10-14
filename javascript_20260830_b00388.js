import crypto from "crypto";
import logger from "./logger.js";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
const DIGEST = "sha256";

/**
 * Derive encryption key from secret and salt
 */
const deriveKey = (secret, salt) => {
  return crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, DIGEST);
};

/**
 * Encrypt transcript content
 * Returns: { encrypted: string, iv: string, salt: string, authTag: string }
 */
export const encryptTranscript = (text, secret) => {
  try {
    if (!text) {
      throw new Error("Text to encrypt is required");
    }
    if (!secret || secret.length < 32) {
      throw new Error("Encryption secret must be at least 32 characters");
    }

    // Generate salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from secret and salt
    const key = deriveKey(secret, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      salt: salt.toString("hex"),
      authTag: authTag.toString("hex"),
      algorithm: ENCRYPTION_ALGORITHM,
      iterations: ITERATIONS,
    };
  } catch (error) {
    logger.error("Encryption error:", error);
    throw new Error(`Failed to encrypt transcript: ${error.message}`);
  }
};

/**
 * Decrypt transcript content
 */
export const decryptTranscript = (encryptedData, secret) => {
  try {
    const { encrypted, iv, salt, authTag } = encryptedData;

    if (!encrypted || !iv || !salt || !authTag) {
      throw new Error("Missing required encryption data");
    }
    if (!secret || secret.length < 32) {
      throw new Error("Encryption secret must be at least 32 characters");
    }

    // Derive key from secret and salt
    const key = deriveKey(secret, Buffer.from(salt, "hex"));

    // Create decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, "hex"),
    );

    // Set auth tag
    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    // Decrypt
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error("Decryption error:", error);
    throw new Error(`Failed to decrypt transcript: ${error.message}`);
  }
};

/**
 * Check if transcript is encrypted
 */
export const isEncrypted = (transcriptData) => {
  if (!transcriptData) return false;
  if (typeof transcriptData === "string") return false;
  return !!(
    transcriptData.encrypted &&
    transcriptData.iv &&
    transcriptData.authTag
  );
};

/**
 * Generate a preview from encrypted transcript
 * Returns first N characters of decrypted content or redacted preview
 */
export const generateEncryptedPreview = (
  encryptedData,
  secret,
  previewLength = 100,
) => {
  try {
    if (!encryptedData || !secret) {
      return { preview: null, isEncrypted: false };
    }

    // Try to decrypt and get preview
    try {
      const decrypted = decryptTranscript(encryptedData, secret);
      const preview = decrypted.substring(0, previewLength);
      const isTruncated = decrypted.length > previewLength;

      return {
        preview: isTruncated ? `${preview}...` : preview,
        isEncrypted: true,
        fullLength: decrypted.length,
        isTruncated,
      };
    } catch (error) {
      // If decryption fails, return redacted
      return {
        preview: "[Encrypted content - unable to decrypt]",
        isEncrypted: true,
        fullLength: null,
        isTruncated: false,
      };
    }
  } catch (error) {
    logger.error("Preview generation error:", error);
    return {
      preview: null,
      isEncrypted: false,
      error: error.message,
    };
  }
};

/**
 * Check if E2EE is enabled for an organization
 */
export const isE2EEEnabled = (organization) => {
  if (!organization) return false;
  return !!(organization.e2eeEnabled || organization.isTranscriptEncrypted);
};

/**
 * Check if user has access to transcript
 */
export const canAccessTranscript = (user, meeting, organization) => {
  // Admin/owner always has access
  if (user?.role === "admin" || user?.role === "owner") {
    return true;
  }

  // Check if user is a member of the organization
  if (user?.organizationId?.toString() !== organization?._id?.toString()) {
    return false;
  }

  // Check if user is a participant in the meeting
  if (meeting?.participants?.includes(user._id)) {
    return true;
  }

  return false;
};

/**
 * Get transcript access level for a guest
 */
export const getGuestTranscriptAccess = (meeting, organization) => {
  // Check if E2EE is enabled
  const e2eeEnabled = isE2EEEnabled(organization);

  // Check if meeting transcript is encrypted
  const transcriptEncrypted = meeting?.isTranscriptEncrypted || false;

  // Check if meeting has shared link settings
  const sharedLinkSettings = meeting?.sharedLinkSettings || {};
  const allowTranscriptAccess =
    sharedLinkSettings?.allowTranscriptAccess || false;

  return {
    e2eeEnabled,
    transcriptEncrypted,
    allowTranscriptAccess,
    canAccess: allowTranscriptAccess && !e2eeEnabled && !transcriptEncrypted,
    requiresEncryption: e2eeEnabled || transcriptEncrypted,
    guestAccessLevel:
      e2eeEnabled || transcriptEncrypted ? "restricted" : "allowed",
  };
};

/**
 * Get encrypted envelope for guest
 */
export const getGuestEncryptedEnvelope = (meeting, organization) => {
  const access = getGuestTranscriptAccess(meeting, organization);

  if (!access.canAccess) {
    return {
      access: "restricted",
      message: "Transcript is encrypted and not available for guest access",
      requiresAuthentication: true,
      encryptionEnabled: access.requiresEncryption,
      preview: null,
    };
  }

  // If transcript is encrypted and we have the secret
  if (meeting.transcript && isEncrypted(meeting.transcript)) {
    const secret = process.env.TRANSCRIPT_ENCRYPTION_SECRET;
    const preview = generateEncryptedPreview(meeting.transcript, secret);

    return {
      access: "encrypted",
      message: "Transcript is encrypted. Client-side decryption required.",
      requiresAuthentication: true,
      encryptionEnabled: true,
      preview: preview.preview,
      algorithm: ENCRYPTION_ALGORITHM,
      metadata: {
        fullLength: preview.fullLength,
        isTruncated: preview.isTruncated,
      },
    };
  }

  // If transcript is not encrypted but E2EE is enabled
  if (access.requiresEncryption) {
    return {
      access: "restricted",
      message:
        "E2EE is enabled for this organization/meeting. Guest access is restricted.",
      requiresAuthentication: true,
      encryptionEnabled: true,
      preview: null,
    };
  }

  // Plaintext transcript access
  return {
    access: "allowed",
    message: "Guest access granted",
    requiresAuthentication: false,
    encryptionEnabled: false,
    preview: meeting.transcript?.substring(0, 200) || null,
  };
};

export default {
  encryptTranscript,
  decryptTranscript,
  isEncrypted,
  generateEncryptedPreview,
  isE2EEEnabled,
  canAccessTranscript,
  getGuestTranscriptAccess,
  getGuestEncryptedEnvelope,
};
