import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => ({
  default: class OpenAI {},
}));

const TEST_USER = {
  _id: "507f1f77bcf86cd799439021",
  organization: "507f1f77bcf86cd799439011",
  role: "member",
};

vi.mock("../middleware/userAuth.js", () => ({
  default: (req, _res, next) => {
    req.user = { ...TEST_USER, ...(req.__user || {}) };
    next();
  },
}));

vi.mock("../models/meetingModel.js", () => ({
  default: { findById: vi.fn() },
}));

vi.mock("../models/translationCacheModel.js", () => ({
  default: { deleteMany: vi.fn() },
}));

vi.mock("../services/translationService.js", () => ({
  translateContent: vi.fn(),
}));

vi.mock("../services/realtimeTranslationService.js", () => ({
  translateSegment: vi.fn(),
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
  submitCorrection: vi.fn(),
  getMeetingTranslations: vi.fn(),
  exportTranscript: vi.fn(),
  getSupportedLanguages: vi.fn(() => ["Spanish", "French"]),
  getQualityMetrics: vi.fn(),
}));

import express from "express";
import request from "supertest";
import routes from "../routes/index.js";
import Meeting from "../models/meetingModel.js";
import TranslationCache from "../models/translationCacheModel.js";
import { translateContent } from "../services/translationService.js";
import {
  getMeetingTranslations,
  submitCorrection,
  translateSegment,
  exportTranscript,
  getQualityMetrics,
} from "../services/realtimeTranslationService.js";

const ORG_A = TEST_USER.organization;
const ORG_B = "507f1f77bcf86cd799439012";
const MEETING_ID = "507f1f77bcf86cd799439031";

function countMatchingLayers(router, pathStr) {
  const stack = router.stack || [];
  return stack.filter(
    (layer) =>
      typeof layer.match === "function" &&
      layer.match(pathStr) &&
      layer.path === pathStr,
  ).length;
}

const buildApp = (overrideUser) => {
  const app = express();
  app.use(express.json());
  if (overrideUser) {
    app.use((req, _res, next) => {
      req.__user = overrideUser;
      next();
    });
  }
  app.use(routes);
  return app;
};

/** Makes Meeting.findById resolve to a meeting owned by `org`. */
const meetingIn = (org) =>
  Meeting.findById.mockResolvedValue({ _id: MEETING_ID, organization: org });

describe("Translation endpoint authorization (#1563)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translateContent.mockResolvedValue({ text: "hola" });
    getMeetingTranslations.mockResolvedValue([]);
    submitCorrection.mockResolvedValue({ ok: true });
    translateSegment.mockResolvedValue({ text: "hola" });
    exportTranscript.mockResolvedValue({ content: "1\n00:00\nhola" });
    getQualityMetrics.mockResolvedValue({ segmentId: "seg-1" });
    TranslationCache.deleteMany.mockResolvedValue({ deletedCount: 3 });
  });

  describe("POST /request — the legacy bulk read", () => {
    it("translates a meeting in the caller's organization", async () => {
      meetingIn(ORG_A);

      const res = await request(buildApp())
        .post("/api/translation/request")
        .send({
          meetingId: MEETING_ID,
          sourceType: "transcript",
          targetLanguage: "Spanish",
        });

      expect(res.status).toBe(200);
      expect(translateContent).toHaveBeenCalledWith(
        MEETING_ID,
        "transcript",
        "Spanish",
      );
    });

    it("refuses to translate another organization's meeting", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp())
        .post("/api/translation/request")
        .send({
          meetingId: MEETING_ID,
          sourceType: "transcript",
          targetLanguage: "Spanish",
        });

      expect(res.status).toBe(403);
      // The transcript must never reach the translator, let alone the response.
      expect(translateContent).not.toHaveBeenCalled();
    });

    it("404s for a meeting that does not exist", async () => {
      Meeting.findById.mockResolvedValue(null);

      const res = await request(buildApp())
        .post("/api/translation/request")
        .send({
          meetingId: MEETING_ID,
          sourceType: "summary",
          targetLanguage: "French",
        });

      expect(res.status).toBe(404);
      expect(translateContent).not.toHaveBeenCalled();
    });

    it("400s on a malformed meetingId instead of throwing a CastError", async () => {
      const res = await request(buildApp())
        .post("/api/translation/request")
        .send({
          meetingId: "not-an-id",
          sourceType: "transcript",
          targetLanguage: "Spanish",
        });

      expect(res.status).toBe(400);
      expect(Meeting.findById).not.toHaveBeenCalled();
    });

    it("still rejects an unknown sourceType", async () => {
      const res = await request(buildApp())
        .post("/api/translation/request")
        .send({
          meetingId: MEETING_ID,
          sourceType: "everything",
          targetLanguage: "Spanish",
        });

      expect(res.status).toBe(400);
    });

    it("rejects a caller with no organization", async () => {
      meetingIn(ORG_A);

      const res = await request(buildApp({ organization: undefined }))
        .post("/api/translation/request")
        .send({
          meetingId: MEETING_ID,
          sourceType: "transcript",
          targetLanguage: "Spanish",
        });

      expect(res.status).toBe(403);
      expect(translateContent).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /cache/:meetingId — the legacy destructive path", () => {
    it("clears the cache for a meeting in the caller's organization", async () => {
      meetingIn(ORG_A);

      const res = await request(buildApp()).delete(
        `/api/translation/cache/${MEETING_ID}`,
      );

      expect(res.status).toBe(200);
      expect(TranslationCache.deleteMany).toHaveBeenCalledWith({
        meeting: MEETING_ID,
      });
    });

    it("refuses to clear another organization's cache", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp()).delete(
        `/api/translation/cache/${MEETING_ID}`,
      );

      expect(res.status).toBe(403);
      expect(TranslationCache.deleteMany).not.toHaveBeenCalled();
    });

    it("does not delete anything for a meeting that does not exist", async () => {
      Meeting.findById.mockResolvedValue(null);

      const res = await request(buildApp()).delete(
        `/api/translation/cache/${MEETING_ID}`,
      );

      expect(res.status).toBe(404);
      expect(TranslationCache.deleteMany).not.toHaveBeenCalled();
    });

    it("400s on a malformed meetingId", async () => {
      const res = await request(buildApp()).delete(
        "/api/translation/cache/not-an-id",
      );

      expect(res.status).toBe(400);
      expect(TranslationCache.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("GET /quality/:segmentId", () => {
    it("requires the meeting to be named and authorized", async () => {
      meetingIn(ORG_A);

      const res = await request(buildApp()).get(
        `/api/translation/quality/seg-1?meetingId=${MEETING_ID}`,
      );

      expect(res.status).toBe(200);
      expect(getQualityMetrics).toHaveBeenCalledWith("seg-1", MEETING_ID);
    });

    it("refuses a segment of another organization's meeting", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp()).get(
        `/api/translation/quality/seg-1?meetingId=${MEETING_ID}`,
      );

      expect(res.status).toBe(403);
      expect(getQualityMetrics).not.toHaveBeenCalled();
    });

    it("400s when no meeting is named", async () => {
      const res = await request(buildApp()).get(
        "/api/translation/quality/seg-1",
      );

      expect(res.status).toBe(400);
      expect(getQualityMetrics).not.toHaveBeenCalled();
    });
  });

  describe("the real-time handlers keep the check they already had", () => {
    it("rejects a cross-organization cache read", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp()).get(
        `/api/translation/cache/${MEETING_ID}`,
      );

      expect(res.status).toBe(403);
      expect(getMeetingTranslations).not.toHaveBeenCalled();
    });

    it("rejects a cross-organization correction", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp())
        .post("/api/translation/correct")
        .send({
          meetingId: MEETING_ID,
          segmentId: "seg-1",
          language: "es",
          correctedText: "hola",
        });

      expect(res.status).toBe(403);
      expect(submitCorrection).not.toHaveBeenCalled();
    });

    it("rejects a cross-organization segment translation", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp())
        .post("/api/translation/translate")
        .send({
          meetingId: MEETING_ID,
          segmentId: "seg-1",
          sourceText: "hello",
          sourceLanguage: "en",
          targetLanguage: "es",
        });

      expect(res.status).toBe(403);
      expect(translateSegment).not.toHaveBeenCalled();
    });

    it("rejects a cross-organization export", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp())
        .post(`/api/translation/export/${MEETING_ID}`)
        .send({ format: "srt" });

      expect(res.status).toBe(403);
      expect(exportTranscript).not.toHaveBeenCalled();
    });

    it("allows an in-organization export", async () => {
      meetingIn(ORG_A);

      const res = await request(buildApp())
        .post(`/api/translation/export/${MEETING_ID}`)
        .send({ format: "srt" });

      expect(res.status).toBe(200);
      expect(exportTranscript).toHaveBeenCalled();
    });
  });

  describe("route prefixes", () => {
    it("serves both /api/translation and /api/translations", () => {
      expect(countMatchingLayers(routes, "/api/translation")).toBe(1);
      expect(countMatchingLayers(routes, "/api/translations")).toBe(1);
    });

    it("answers on the singular prefix the transcript panel uses", async () => {
      const res = await request(buildApp()).get("/api/translation/languages");

      expect(res.status).toBe(200);
      expect(res.body.languages).toEqual(["Spanish", "French"]);
    });

    it("still answers on the plural prefix translationApi.js uses", async () => {
      const res = await request(buildApp()).get("/api/translations/languages");

      expect(res.status).toBe(200);
    });

    it("enforces the same authorization on the plural prefix", async () => {
      meetingIn(ORG_B);

      const res = await request(buildApp())
        .post("/api/translations/request")
        .send({
          meetingId: MEETING_ID,
          sourceType: "transcript",
          targetLanguage: "Spanish",
        });

      expect(res.status).toBe(403);
      expect(translateContent).not.toHaveBeenCalled();
    });
  });
});
