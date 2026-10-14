import { jest } from "@jest/globals";
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

const { default: meetingRsvpRoutes } =
  await import("../routes/meetingRsvpRoutes.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: MeetingRsvp } = await import("../models/meetingRsvpModel.js");
await import("../models/userModel.js");
const { default: express } = await import("express");

const app = express();
app.use(express.json());
app.use("/api/rsvps", meetingRsvpRoutes);

describe("Meeting RSVP Authorization & IDOR Tests (#1673)", () => {
  const ORG_A = new mongoose.Types.ObjectId();
  const ORG_B = new mongoose.Types.ObjectId();

  const ALICE_ORG_A = {
    _id: new mongoose.Types.ObjectId(),
    organization: ORG_A,
    role: "member",
    email: "alice@orga.com",
  };

  const BOB_ORG_A = {
    _id: new mongoose.Types.ObjectId(),
    organization: ORG_A,
    role: "member",
    email: "bob@orga.com",
  };

  const CHARLIE_ORG_A = {
    _id: new mongoose.Types.ObjectId(),
    organization: ORG_A,
    role: "member",
    email: "charlie@orga.com",
  };

  const MALLORY_ORG_B = {
    _id: new mongoose.Types.ObjectId(),
    organization: ORG_B,
    role: "member",
    email: "mallory@orgb.com",
  };

  let meetingA;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.TEST_MONGODB_URI);
    }
  });

  beforeEach(async () => {
    await Meeting.deleteMany({});
    await MeetingRsvp.deleteMany({});

    meetingA = await Meeting.create({
      title: "Architecture Sync",
      uploadedBy: ALICE_ORG_A._id,
      organization: ORG_A,
      date: new Date(),
      status: "uploaded",
      participants: [
        {
          user: ALICE_ORG_A._id,
          name: "Alice Owner",
          email: ALICE_ORG_A.email,
        },
        {
          user: BOB_ORG_A._id,
          name: "Bob Participant",
          email: BOB_ORG_A.email,
        },
      ],
    });
  });

  describe("RSVP Creation and Updates", () => {
    it("allows invited user (in participants list) to create/update RSVP", async () => {
      currentUser = BOB_ORG_A;

      const res = await request(app)
        .put(`/api/rsvps/${meetingA._id}/respond`)
        .send({ status: "accepted" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("accepted");

      const rsvp = await MeetingRsvp.findOne({
        meetingId: meetingA._id,
        userId: BOB_ORG_A._id,
      });
      expect(rsvp).toBeDefined();
      expect(rsvp.status).toBe("accepted");
    });

    it("allows user with an existing RSVP record to update RSVP status", async () => {
      // Pre-seed an RSVP record for Bob
      await MeetingRsvp.create({
        meetingId: meetingA._id,
        userId: BOB_ORG_A._id,
        status: "pending",
      });

      currentUser = BOB_ORG_A;

      const res = await request(app)
        .put(`/api/rsvps/${meetingA._id}/respond`)
        .send({ status: "declined", declineReason: "Busy" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("declined");
      expect(res.body.data.declineReason).toBe("Busy");
    });

    it("denies RSVP creation for non-invited user from the same organization (403)", async () => {
      currentUser = CHARLIE_ORG_A;

      const res = await request(app)
        .put(`/api/rsvps/${meetingA._id}/respond`)
        .send({ status: "accepted" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not invited or authorized/i);

      // Verify no RSVP database record was created
      const count = await MeetingRsvp.countDocuments({
        meetingId: meetingA._id,
        userId: CHARLIE_ORG_A._id,
      });
      expect(count).toBe(0);
    });

    it("denies RSVP creation for user from a different organization (403 IDOR check)", async () => {
      currentUser = MALLORY_ORG_B;

      const res = await request(app)
        .put(`/api/rsvps/${meetingA._id}/respond`)
        .send({ status: "accepted" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      const count = await MeetingRsvp.countDocuments({
        meetingId: meetingA._id,
        userId: MALLORY_ORG_B._id,
      });
      expect(count).toBe(0);
    });

    it("returns 400 for invalid meeting ID formatting", async () => {
      currentUser = BOB_ORG_A;

      const res = await request(app)
        .put("/api/rsvps/invalid-meeting-id/respond")
        .send({ status: "accepted" });

      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent meeting ID", async () => {
      currentUser = BOB_ORG_A;
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/rsvps/${fakeId}/respond`)
        .send({ status: "accepted" });

      expect(res.status).toBe(404);
    });

    it("allows joining waitlist and tracks waitlist transition (#2485)", async () => {
      currentUser = BOB_ORG_A;

      const res = await request(app)
        .put(`/api/rsvps/${meetingA._id}/respond`)
        .send({
          status: "waitlisted",
          availabilityNote: "Can join if spot opens",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("waitlisted");

      const updatedMeeting = await Meeting.findById(meetingA._id);
      expect(updatedMeeting.waitlist).toHaveLength(1);
      expect(updatedMeeting.waitlist[0].user.toString()).toBe(
        BOB_ORG_A._id.toString(),
      );
      expect(updatedMeeting.waitlist[0].note).toBe("Can join if spot opens");
    });

    it("enforces max capacity rules and prevents accepting when meeting is full (#2485)", async () => {
      meetingA.maxParticipants = 1;
      meetingA.participants[0].rsvpStatus = "accepted";
      await meetingA.save();

      currentUser = BOB_ORG_A;

      const res = await request(app)
        .put(`/api/rsvps/${meetingA._id}/respond`)
        .send({ status: "accepted" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.isFull).toBe(true);
    });
  });

  describe("RSVP Summary Retrieval", () => {
    it("allows access to RSVP summary for member of the organization", async () => {
      currentUser = BOB_ORG_A;

      const res = await request(app).get(`/api/rsvps/meeting/${meetingA._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.participants).toBeDefined();
    });

    it("denies access to RSVP summary for cross-organization user", async () => {
      currentUser = MALLORY_ORG_B;

      const res = await request(app).get(`/api/rsvps/meeting/${meetingA._id}`);

      expect(res.status).toBe(403);
    });
  });
});
