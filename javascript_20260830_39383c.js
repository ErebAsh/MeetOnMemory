import { describe, it, expect, before, after } from "vitest";
import request from "supertest";
import app from "../app.js";
import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import Organization from "../models/Organization.js";
import GuestAccess from "../models/GuestAccess.js";
import {
  encryptTranscript,
  decryptTranscript,
  isEncrypted,
  getGuestTranscriptAccess,
} from "../utils/transcriptEncryption.js";

describe("Guest Encryption Tests", () => {
  let testMeetingId;
  let testOrganizationId;
  let guestToken;
  const testSecret = "test-secret-key-min-32-characters-long";

  before(async () => {
    // Connect to test database
    await mongoose.connect(
      process.env.TEST_MONGODB_URI ||
        "mongodb://localhost:27017/test_meetonmemory",
    );

    // Create test organization with E2EE
    const org = new Organization({
      name: "Test Org",
      e2eeEnabled: true,
      isTranscriptEncrypted: true,
    });
    await org.save();
    testOrganizationId = org._id;

    // Create test meeting with encrypted transcript
    const encryptedData = encryptTranscript(
      "This is a test transcript",
      testSecret,
    );
    const meeting = new Meeting({
      title: "Test Meeting",
      organizationId: testOrganizationId,
      transcript: encryptedData,
      isTranscriptEncrypted: true,
      status: "completed",
    });
    await meeting.save();
    testMeetingId = meeting._id;

    // Create guest access
    const guestAccess = new GuestAccess({
      meetingId: testMeetingId,
      createdBy: new mongoose.Types.ObjectId(),
      token: "test-guest-token-123",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      accessLevel: "view",
    });
    await guestAccess.save();
    guestToken = "test-guest-token-123";
  });

  after(async () => {
    await Meeting.deleteMany({});
    await Organization.deleteMany({});
    await GuestAccess.deleteMany({});
    await mongoose.disconnect();
  });

  describe("Encryption Utilities", () => {
    it("should encrypt and decrypt transcript", () => {
      const originalText = "Test transcript content";
      const encrypted = encryptTranscript(originalText, testSecret);
      expect(encrypted).toHaveProperty("encrypted");
      expect(encrypted).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("salt");
      expect(encrypted).toHaveProperty("authTag");

      const decrypted = decryptTranscript(encrypted, testSecret);
      expect(decrypted).toBe(originalText);
    });

    it("should detect encrypted data", () => {
      const encrypted = encryptTranscript("test", testSecret);
      expect(isEncrypted(encrypted)).toBe(true);
      expect(isEncrypted("plaintext")).toBe(false);
      expect(isEncrypted(null)).toBe(false);
    });

    it("should fail decryption with wrong key", () => {
      const encrypted = encryptTranscript("test", testSecret);
      expect(() => decryptTranscript(encrypted, "wrong-key")).toThrow();
    });
  });

  describe("Guest Access Control", () => {
    it("should restrict guest access when E2EE enabled", () => {
      const access = getGuestTranscriptAccess(
        { isTranscriptEncrypted: true },
        { e2eeEnabled: true },
      );
      expect(access.canAccess).toBe(false);
      expect(access.requiresEncryption).toBe(true);
    });

    it("should allow guest access when E2EE disabled", () => {
      const access = getGuestTranscriptAccess(
        {
          isTranscriptEncrypted: false,
          sharedLinkSettings: { allowTranscriptAccess: true },
        },
        { e2eeEnabled: false },
      );
      expect(access.canAccess).toBe(true);
      expect(access.requiresEncryption).toBe(false);
    });

    it("should restrict access when transcript is encrypted", () => {
      const access = getGuestTranscriptAccess(
        {
          isTranscriptEncrypted: true,
          sharedLinkSettings: { allowTranscriptAccess: true },
        },
        { e2eeEnabled: false },
      );
      expect(access.canAccess).toBe(false);
      expect(access.requiresEncryption).toBe(true);
    });
  });

  describe("API Endpoints", () => {
    it("should return encrypted envelope for guest view", async () => {
      const response = await request(app).get(`/api/guest/view/${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("transcript");
      expect(response.body.data.transcript.encrypted).toBe(true);
      expect(response.body.data.transcript.requiresDecryption).toBe(true);
      expect(response.body.data.transcript.encryptedData).toBeDefined();
    });

    it("should reject invalid guest tokens", async () => {
      const response = await request(app).get("/api/guest/view/invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should reject expired guest tokens", async () => {
      // Create expired guest access
      const expiredAccess = new GuestAccess({
        meetingId: testMeetingId,
        createdBy: new mongoose.Types.ObjectId(),
        token: "expired-token",
        expiresAt: new Date(Date.now() - 1000),
        accessLevel: "view",
      });
      await expiredAccess.save();

      const response = await request(app).get("/api/guest/view/expired-token");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("ACCESS_EXPIRED");
    });

    it("should handle decryption request for guests", async () => {
      // First get the encrypted data
      const viewResponse = await request(app).get(
        `/api/guest/view/${guestToken}`,
      );

      const encryptedData = viewResponse.body.data.transcript.encryptedData;

      // Attempt decryption
      const response = await request(app)
        .post(`/api/guest/decrypt/${guestToken}`)
        .send({
          encryptedData,
          decryptionKey: testSecret,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transcript).toBe("This is a test transcript");
    });

    it("should reject decryption with wrong key", async () => {
      const viewResponse = await request(app).get(
        `/api/guest/view/${guestToken}`,
      );

      const encryptedData = viewResponse.body.data.transcript.encryptedData;

      const response = await request(app)
        .post(`/api/guest/decrypt/${guestToken}`)
        .send({
          encryptedData,
          decryptionKey: "wrong-key",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should show preview of encrypted transcript", async () => {
      const response = await request(app).get(`/api/guest/view/${guestToken}`);

      expect(response.body.data.transcript.preview).toBeDefined();
      expect(response.body.data.transcript.preview).toContain("Encrypted");
    });
  });

  describe("Security", () => {
    it("should not return plaintext transcript when E2EE enabled", async () => {
      const response = await request(app).get(`/api/guest/view/${guestToken}`);

      expect(response.body.data.transcript.content).toBeUndefined();
      expect(response.body.data.transcript.encryptedData).toBeDefined();
    });

    it("should include encryption metadata", async () => {
      const response = await request(app).get(`/api/guest/view/${guestToken}`);

      expect(response.body.data.transcript.encryptedData).toHaveProperty(
        "algorithm",
      );
      expect(response.body.data.transcript.encryptedData.algorithm).toBe(
        "aes-256-gcm",
      );
    });
  });
});
