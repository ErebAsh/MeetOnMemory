/**
 * Issue #1530 — Smart Scheduler auth, org boundaries, and confirm persistence.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

const userFindSpy = jest.fn();
const proposalCreateSpy = jest.fn();
const proposalFindByIdSpy = jest.fn();
const meetingCreateSpy = jest.fn();
const generateProposalsSpy = jest.fn();
const createGoogleEventSpy = jest.fn();

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    find: (...args) => {
      const p = Promise.resolve(userFindSpy(...args));
      return {
        select: jest.fn().mockReturnValue(p),
        then: p.then.bind(p),
        catch: p.catch.bind(p),
      };
    },
  },
}));

jest.unstable_mockModule("../models/MeetingProposal.js", () => ({
  default: {
    create: (...args) => proposalCreateSpy(...args),
    findById: (...args) => proposalFindByIdSpy(...args),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    create: (...args) => meetingCreateSpy(...args),
  },
}));

jest.unstable_mockModule("../services/smartScheduler.js", () => ({
  default: {
    generateProposals: (...args) => generateProposalsSpy(...args),
  },
}));

jest.unstable_mockModule("../services/calendarService.js", () => ({
  getFreeBusy: jest.fn().mockResolvedValue({ google: {} }),
  createGoogleEvent: (...args) => createGoogleEventSpy(...args),
}));

const { default: schedulerRoutes } =
  await import("../routes/scheduler.routes.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();
const USER_A = new mongoose.Types.ObjectId();
const USER_B = new mongoose.Types.ObjectId();
const PROPOSAL_ID = new mongoose.Types.ObjectId();
const MEETING_ID = new mongoose.Types.ObjectId();

const alice = {
  _id: USER_A,
  organization: ORG_A,
  role: "member",
  name: "Alice",
  email: "alice@example.com",
};

const mallory = {
  _id: USER_B,
  organization: ORG_B,
  role: "admin",
  name: "Mallory",
  email: "mallory@example.com",
};

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/api/scheduler", schedulerRoutes);
});

beforeEach(() => {
  currentUser = alice;
  userFindSpy.mockReset();
  proposalCreateSpy.mockReset();
  proposalFindByIdSpy.mockReset();
  meetingCreateSpy.mockReset();
  generateProposalsSpy.mockReset();
  createGoogleEventSpy.mockReset();

  userFindSpy.mockResolvedValue([
    {
      _id: USER_A,
      name: "Alice",
      email: "alice@example.com",
      organization: ORG_A,
    },
  ]);
  generateProposalsSpy.mockResolvedValue([
    {
      startTime: new Date("2026-08-20T10:00:00Z"),
      endTime: new Date("2026-08-20T10:30:00Z"),
      score: 90,
      conflicts: [],
      attendeeCount: 1,
    },
  ]);
  proposalCreateSpy.mockImplementation(async (doc) => ({
    _id: PROPOSAL_ID,
    ...doc,
  }));
  meetingCreateSpy.mockResolvedValue({ _id: MEETING_ID });
  createGoogleEventSpy.mockResolvedValue("gcal_1");
});

describe("POST /api/scheduler/propose (#1530)", () => {
  it("rejects unauthenticated proposal creation", async () => {
    currentUser = null;
    const res = await request(app)
      .post("/api/scheduler/propose")
      .send({
        title: "Sync",
        dateRange: { start: "2026-08-20", end: "2026-08-27" },
      });
    expect(res.status).toBe(401);
    expect(proposalCreateSpy).not.toHaveBeenCalled();
  });

  it("creates a proposal for an authorized org member", async () => {
    const res = await request(app)
      .post("/api/scheduler/propose")
      .send({
        title: "Planning",
        duration: 30,
        dateRange: { start: "2026-08-20", end: "2026-08-27" },
        preferences: { avoidWeekends: true },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(generateProposalsSpy).toHaveBeenCalled();
    expect(proposalCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Planning",
        organizer: USER_A,
        organization: ORG_A.toString(),
        status: "proposed",
      }),
    );
  });

  it("rejects participants outside the organizer organization", async () => {
    userFindSpy.mockResolvedValue([
      {
        _id: USER_A,
        name: "Alice",
        email: "alice@example.com",
        organization: ORG_A,
      },
    ]);

    const res = await request(app)
      .post("/api/scheduler/propose")
      .send({
        title: "Leak",
        participantIds: [USER_A.toString(), USER_B.toString()],
        dateRange: { start: "2026-08-20", end: "2026-08-27" },
      });

    expect(res.status).toBe(403);
    expect(proposalCreateSpy).not.toHaveBeenCalled();
  });

  it("ignores client-supplied organizationId", async () => {
    const res = await request(app)
      .post("/api/scheduler/propose")
      .send({
        title: "Org Spoof",
        organizationId: ORG_B.toString(),
        dateRange: { start: "2026-08-20", end: "2026-08-27" },
      });

    expect(res.status).toBe(201);
    expect(proposalCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ organization: ORG_A.toString() }),
    );
  });
});

describe("GET /api/scheduler/propose/:id (#1530)", () => {
  it("rejects unauthenticated retrieval", async () => {
    currentUser = null;
    const res = await request(app).get(`/api/scheduler/propose/${PROPOSAL_ID}`);
    expect(res.status).toBe(401);
  });

  it("allows the organizer to retrieve their proposal", async () => {
    proposalFindByIdSpy.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: PROPOSAL_ID,
          organizer: { _id: USER_A },
          organization: ORG_A,
          title: "Planning",
        }),
      }),
    });

    const res = await request(app).get(`/api/scheduler/propose/${PROPOSAL_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Planning");
  });

  it("denies cross-organization proposal retrieval", async () => {
    currentUser = mallory;
    proposalFindByIdSpy.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: PROPOSAL_ID,
          organizer: { _id: USER_A },
          organization: ORG_A,
          title: "Secret",
        }),
      }),
    });

    const res = await request(app).get(`/api/scheduler/propose/${PROPOSAL_ID}`);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain("Secret");
  });
});

describe("PUT /api/scheduler/propose/:id/confirm (#1530)", () => {
  const startTime = "2026-08-20T10:00:00.000Z";
  const endTime = "2026-08-20T10:30:00.000Z";

  const mockProposalForConfirm = (overrides = {}) => {
    const proposal = {
      _id: PROPOSAL_ID,
      title: "Planning",
      organizer: USER_A,
      organization: ORG_A,
      duration: 30,
      status: "proposed",
      participants: [
        { _id: USER_A, name: "Alice", email: "alice@example.com" },
      ],
      meetingId: null,
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
    proposalFindByIdSpy.mockReturnValue({
      populate: jest.fn().mockResolvedValue(proposal),
    });
    return proposal;
  };

  it("rejects unauthenticated confirmation", async () => {
    currentUser = null;
    const res = await request(app)
      .put(`/api/scheduler/propose/${PROPOSAL_ID}/confirm`)
      .send({ startTime, endTime });
    expect(res.status).toBe(401);
    expect(meetingCreateSpy).not.toHaveBeenCalled();
  });

  it("rejects confirmation by a non-organizer", async () => {
    currentUser = { ...alice, _id: new mongoose.Types.ObjectId() };
    mockProposalForConfirm();

    const res = await request(app)
      .put(`/api/scheduler/propose/${PROPOSAL_ID}/confirm`)
      .send({ startTime, endTime });

    expect(res.status).toBe(403);
    expect(meetingCreateSpy).not.toHaveBeenCalled();
  });

  it("rejects cross-organization confirmation", async () => {
    currentUser = { ...alice, organization: ORG_B };
    mockProposalForConfirm({ organization: ORG_A });

    const res = await request(app)
      .put(`/api/scheduler/propose/${PROPOSAL_ID}/confirm`)
      .send({ startTime, endTime });

    expect(res.status).toBe(403);
    expect(meetingCreateSpy).not.toHaveBeenCalled();
  });

  it("confirms with proposal id in the path and persists a Meeting", async () => {
    const proposal = mockProposalForConfirm();

    const res = await request(app)
      .put(`/api/scheduler/propose/${PROPOSAL_ID}/confirm`)
      .send({ startTime, endTime });

    expect(res.status).toBe(200);
    expect(meetingCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Planning",
        uploadedBy: USER_A,
        organization: ORG_A,
      }),
    );
    expect(proposal.status).toBe("confirmed");
    expect(proposal.meetingId).toEqual(MEETING_ID);
    expect(proposal.save).toHaveBeenCalled();
    expect(res.body.meetingId).toEqual(MEETING_ID.toString());
  });
});
