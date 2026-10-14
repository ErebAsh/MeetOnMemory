/**
 * E2EE client utilities for transcript encryption/decryption
 */

/**
 * Generate a random encryption key
 */
export const generateEncryptionKey = (length = 32) => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
  let key = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    key += charset[randomIndex];
  }
  return key;
};

/**
 * Check if transcript is encrypted
 */
export const isTranscriptEncrypted = (transcript) => {
  if (!transcript) return false;
  if (typeof transcript === "string") return false;
  return !!(transcript.encrypted && transcript.iv && transcript.authTag);
};

/**
 * Get transcript access status
 */
export const getTranscriptAccessStatus = (transcriptData) => {
  if (!transcriptData) {
    return { hasAccess: false, encrypted: false, preview: null };
  }

  const encrypted = transcriptData.encrypted || false;
  const hasContent = !!(transcriptData.content || transcriptData.preview);
  const requiresDecryption = transcriptData.requiresDecryption || false;
  const preview = transcriptData.preview || null;

  return {
    hasAccess: hasContent || !!preview,
    encrypted,
    requiresDecryption,
    preview,
    hasPreview: !!preview,
    hasFullContent: !!transcriptData.content,
  };
};

/**
 * Validate decryption key format
 */
export const isValidDecryptionKey = (key) => {
  if (!key) return false;
  if (key.length < 8) return false;
  // Check if key has reasonable entropy
  const hasUpper = /[A-Z]/.test(key);
  const hasLower = /[a-z]/.test(key);
  const hasNumber = /[0-9]/.test(key);
  const hasSpecial = /[!@#$%^&*()_+-=]/.test(key);
  return hasUpper && hasLower && (hasNumber || hasSpecial);
};

/**
 * Get encryption status message
 */
export const getEncryptionStatusMessage = (isEncrypted, hasAccess) => {
  if (isEncrypted && !hasAccess) {
    return {
      message:
        "Transcript is encrypted. Please enter the decryption key to view.",
      type: "warning",
      icon: "🔒",
    };
  }
  if (isEncrypted && hasAccess) {
    return {
      message: "Transcript is encrypted but you have access to view it.",
      type: "info",
      icon: "🔓",
    };
  }
  return {
    message: "Transcript is available in plaintext.",
    type: "success",
    icon: "📄",
  };
};

/**
 * Check if user is guest
 */
export const isGuestUser = () => {
  const path = window.location.pathname;
  return path.includes("/guest/");
};

/**
 * Get guest token from URL
 */
export const getGuestToken = () => {
  const path = window.location.pathname;
  const match = path.match(/\/guest\/([^/]+)/);
  return match ? match[1] : null;
};

export default {
  generateEncryptionKey,
  isTranscriptEncrypted,
  getTranscriptAccessStatus,
  isValidDecryptionKey,
  getEncryptionStatusMessage,
  isGuestUser,
  getGuestToken,
};
