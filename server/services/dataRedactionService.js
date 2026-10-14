import crypto from "crypto";
import RedactionAudit from "../models/redactionAuditModel.js";

const ALGORITHM = "aes-256-cbc";
const KEY_SALT = "meetonmemory_pii_salt";

// Retrieve or fallback key
const getEncryptionKey = () => {
  const secret =
    process.env.PII_ENCRYPTION_KEY || "fallback_secret_key_meetonmemory_pii";
  // Derives a 32-byte key from the secret
  return crypto.scryptSync(secret, KEY_SALT, 32);
};

/**
 * Encrypts cleartext using AES-256-CBC.
 * Returns formatted "ivHex:ciphertextHex".
 */
export const encryptText = (text) => {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};

/**
 * Decrypts "ivHex:ciphertextHex" back to cleartext.
 */
export const decryptText = (encryptedText) => {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 2) return "";

  try {
    const iv = Buffer.from(parts[0], "hex");
    const ciphertext = parts[1];
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("AES-256 Decryption failed:", err);
    return "";
  }
};

/**
 * Redacts PII elements from target text and inserts logs into RedactionAudit.
 */
export const redactTextAndAudit = async (text, meetingId, organizationId) => {
  if (!text) return { redactedText: "", audits: [] };

  let redactedText = text;
  const audits = [];

  const classifiers = [
    {
      type: "API_KEY",
      regex:
        /\b(key-[a-zA-Z0-9]{16,}|sk_live_[a-zA-Z0-9]{24,}|AIzaSy[a-zA-Z0-9_-]{33})\b/g,
      mask: "[REDACTED_API_KEY]",
    },
    {
      type: "EMAIL",
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      mask: "[REDACTED_EMAIL]",
    },
    {
      type: "PHONE",
      regex:
        /(?:(?<=\s|^|\W)\+?\d{1,3}[-.\s]+)?(?:\(?\d{3}\)?[-.\s]*)?\d{3}[-.\s]?\d{4}\b/g,
      mask: "[REDACTED_PHONE]",
    },
    {
      type: "CREDIT_CARD",
      regex:
        /\b(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b/g,
      mask: "[REDACTED_CARD]",
    },
    {
      type: "PASSWORD_SECRET",
      regex:
        /\b(?:password|secret|passwd|token)\s*=\s*['"][a-zA-Z0-9!@#$%^&*()_+=-]{6,}['"]/gi,
      mask: "[REDACTED_SECRET]",
    },
  ];

  for (const c of classifiers) {
    // Find all matches before replacing
    let match;
    const regexCopy = new RegExp(c.regex);

    while ((match = regexCopy.exec(text)) !== null) {
      const matchedValue = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedValue.length;

      // Extract a 30-character context snippet
      const snippetStart = Math.max(0, startIndex - 30);
      const snippetEnd = Math.min(text.length, endIndex + 30);
      const contextSnippet = text.substring(snippetStart, snippetEnd);

      // Mask token preview (e.g. first 3 chars + "...masked...")
      const maskedToken =
        matchedValue.length > 5
          ? `${matchedValue.substring(0, 3)}...masked...`
          : "...masked...";

      audits.push({
        organizationId,
        meetingId,
        entityType: c.type,
        maskedToken,
        charIndexStart: startIndex,
        charIndexEnd: endIndex,
        contextSnippet,
      });
    }

    // Perform replacement on final redacted text
    redactedText = redactedText.replace(c.regex, c.mask);
  }

  // Bulk insert audits if any were collected
  if (audits.length > 0 && organizationId && meetingId) {
    try {
      await RedactionAudit.insertMany(audits);
    } catch (auditErr) {
      console.error("Failed to insert RedactionAudit entries:", auditErr);
    }
  }

  return { redactedText, audits };
};
