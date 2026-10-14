import { jest } from "@jest/globals";
import mongoose from "mongoose";
import request from "supertest";

const mockGenerateTimeline = jest.fn();

jest.unstable_mockModule("../services/sentimentTimelineService.js", () => ({
  generateSentimentTimeline: mockGenerateTimeline,
}));

const { app } = await import("../server.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: Transcript } = await import("../models/transcriptModel.js");
const { default: SentimentTimeline } =
  await import("../models/sentimentTimelineModel.js");
const { default: Organization } =
  await import("../models/organizationModel.js");
const { default: User } = await import("../models/userModel.js");
const { createClerkTestToken, authHeader } =
  await import("./helpers/clerkTestAuth.js");

describe("Sentiment Timeline Feature", () => {
  let meeting;
  let organization;
  let user;
  let token;

  beforeEach(async () => {
    await Meeting.deleteMany({});
    await Transcript.deleteMany({});
    await SentimentTimeline.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    organization = await Organization.create({
      name: "Test Org",
      domain: "example.com",
      owner: new mongoose.Types.ObjectId(),
      slug: `test-org-${Date.now()}`,
    });

    const clerkUserId = `clerk_${Date.now()}`;
    user = await User.create({
      name: "Test User",
      email: `test_${Date.now()}@example.com`,
      clerkUserId,
      role: "admin",
      organization: organization._id,
      password: "password123",
    });
    organization.owner = user._id;
    await organization.save();

    token = createClerkTestToken({
      clerkUserId,
      email: user.email,
    });

    meeting = await Meeting.create({
      title: "Test Meeting",
      date: new Date(),
      uploadedBy: user._id,
      organization: organization._id,
      agendaItems: [{ text: "Introduction" }, { text: "Main Discussion" }],
    });

    await Transcript.create({
      meeting: meeting._id,
      status: "completed",
      segments: [
        { startTime: 0, endTime: 60000, text: "Hello everyone.", speaker: "A" },
        {
          startTime: 60000,
          endTime: 120000,
          text: "Let's start the meeting.",
          speaker: "B",
        },
        {
          startTime: 120000,
          endTime: 180000,
          text: "This is a great idea.",
          speaker: "A",
        },
        {
          startTime: 180000,
          endTime: 240000,
          text: "I disagree strongly.",
          speaker: "B",
        },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Just to be clean, wait for pending tasks if any.
    // Real connection teardown is handled by setup.js
    await SentimentTimeline.deleteMany({});
  });

  it("should generate a timeline successfully and save it", async () => {
    mockGenerateTimeline.mockImplementationOnce(async (meetingId) => {
      const targetMeeting = await Meeting.findById(meetingId);
      return await SentimentTimeline.create({
        meeting: meetingId,
        organization: targetMeeting.organization,
        status: "completed",
        segments: [
          {
            startTime: 0,
            endTime: 120000,
            sentiment: "neutral",
            score: 0.1,
            textSnippet: "Hello everyone",
            agendaItemIndex: 0,
            agendaItemText: "Introduction",
          },
          {
            startTime: 120000,
            endTime: 240000,
            sentiment: "negative",
            score: -0.2,
            textSnippet: "I disagree strongly",
            agendaItemIndex: 1,
            agendaItemText: "Main Discussion",
          },
        ],
        overallArc: "Started neutral, became contentious.",
      });
    });

    const res = await request(app)
      .post(`/api/sentiment-timeline/${meeting._id}/generate`)
      .set(authHeader(token))
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timeline).toBeDefined();
    expect(res.body.timeline.status).toBe("completed");
    expect(res.body.timeline.segments).toHaveLength(2);
    expect(res.body.timeline.segments[1].sentiment).toBe("negative");
    expect(res.body.timeline.segments[1].score).toBe(-0.2);

    // Verify it was saved in DB
    const dbTimeline = await SentimentTimeline.findOne({
      meeting: meeting._id,
    });
    expect(dbTimeline).not.toBeNull();
    expect(dbTimeline.segments).toHaveLength(2);
  });

  it("should retrieve an existing timeline", async () => {
    await SentimentTimeline.create({
      meeting: meeting._id,
      status: "completed",
      segments: [
        { startTime: 0, endTime: 120000, sentiment: "positive", score: 0.8 },
      ],
    });

    const res = await request(app)
      .get(`/api/sentiment-timeline/${meeting._id}`)
      .set(authHeader(token))
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timeline.segments[0].sentiment).toBe("positive");
  });

  it("should return 404 if no timeline exists when fetching", async () => {
    const res = await request(app)
      .get(`/api/sentiment-timeline/${meeting._id}`)
      .set(authHeader(token))
      .send();

    expect(res.status).toBe(404);
  });
});
