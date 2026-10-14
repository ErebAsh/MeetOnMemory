import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { jest } from "@jest/globals";

jest.unstable_mockModule("../middleware/userAuth.js", () => {
  return {
    default: async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const jwtModule = await import("jsonwebtoken");
          const decoded = jwtModule.default.verify(
            token,
            process.env.JWT_SECRET || "testsecret",
          );

          req.user = {
            _id: decoded.id,
            id: decoded.id,
            role: decoded.role,
            organization: decoded.organization,
            activeOrganization: decoded.organization,
          };
          return next();
        } catch (_err) {
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }
      }
      return res.status(401).json({ success: false, message: "No token" });
    },
  };
});

const { app } = await import("../server.js");

import ParkingLotItem from "../models/parkingLotItemModel.js";
import Organization from "../models/organizationModel.js";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";

process.env.CLERK_TEST_AUTH = "jwt";
process.env.JWT_SECRET = "testsecret";

describe("Parking Lot API Integration Tests", () => {
  let token;
  let user;
  let organization;
  let meeting;

  beforeAll(async () => {
    // Setup user, organization, meeting
    user = await User.create({
      name: "Test User",
      email: "test.parkinglot@example.com",
      clerkId: "clerk_test_parkinglot",
      password: "password123",
    });

    organization = await Organization.create({
      name: "Test Org",
      slug: "test-org-parking-lot",
      owner: user._id,
    });

    user.organization = organization._id;
    await user.save();

    meeting = await Meeting.create({
      title: "Test Meeting",
      organization: organization._id,
      uploadedBy: user._id,
      date: new Date(),
      time: "10:00",
      status: "uploaded",
    });

    token = jwt.sign(
      { id: user._id, role: "admin", organization: organization._id },
      process.env.JWT_SECRET || "testsecret",
    );
  });

  afterAll(async () => {
    await ParkingLotItem.deleteMany({});
    await Meeting.deleteMany({ _id: meeting._id });
    await Organization.deleteMany({ _id: organization._id });
    await User.deleteMany({ _id: user._id });
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await ParkingLotItem.deleteMany({});
  });

  describe("POST /api/parking-lot", () => {
    it("should add a topic to the parking lot", async () => {
      const res = await request(app)
        .post("/api/parking-lot")
        .set("Authorization", `Bearer ${token}`)
        .send({
          organizationId: organization._id,
          sourceMeetingId: meeting._id,
          topic: "Off-topic discussion point",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.item.topic).toBe("Off-topic discussion point");
      expect(res.body.item.status).toBe("pending");

      const dbItem = await ParkingLotItem.findById(res.body.item._id);
      expect(dbItem).toBeTruthy();
      expect(dbItem.topic).toBe("Off-topic discussion point");
    });
  });

  describe("GET /api/parking-lot/organization/:orgId", () => {
    it("should fetch pending items for an organization", async () => {
      await ParkingLotItem.create([
        {
          organization: organization._id,
          sourceMeetingId: meeting._id,
          submittedBy: user._id,
          topic: "Topic 1",
          status: "pending",
        },
        {
          organization: organization._id,
          sourceMeetingId: meeting._id,
          submittedBy: user._id,
          topic: "Topic 2",
          status: "discarded",
        },
      ]);

      const res = await request(app)
        .get(`/api/parking-lot/organization/${organization._id}?status=pending`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].topic).toBe("Topic 1");
    });
  });

  describe("PATCH /api/parking-lot/:id/status", () => {
    it("should update the status of a parking lot item", async () => {
      const item = await ParkingLotItem.create({
        organization: organization._id,
        sourceMeetingId: meeting._id,
        submittedBy: user._id,
        topic: "Topic 1",
        status: "pending",
      });

      const res = await request(app)
        .patch(`/api/parking-lot/${item._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "discarded" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.item.status).toBe("discarded");

      const dbItem = await ParkingLotItem.findById(item._id);
      expect(dbItem.status).toBe("discarded");
    });
  });

  describe("POST /api/parking-lot/assign", () => {
    it("should assign multiple topics to a meeting", async () => {
      const items = await ParkingLotItem.insertMany([
        {
          organization: organization._id,
          sourceMeetingId: meeting._id,
          submittedBy: user._id,
          topic: "Topic A",
        },
        {
          organization: organization._id,
          sourceMeetingId: meeting._id,
          submittedBy: user._id,
          topic: "Topic B",
        },
      ]);

      const newMeeting = await Meeting.create({
        title: "Future Meeting",
        organization: organization._id,
        uploadedBy: user._id,
        date: new Date(),
        time: "11:00",
        status: "uploaded",
      });

      const topicIds = items.map((item) => item._id);

      const res = await request(app)
        .post("/api/parking-lot/assign")
        .set("Authorization", `Bearer ${token}`)
        .send({
          topicIds,
          meetingId: newMeeting._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbItems = await ParkingLotItem.find({ _id: { $in: topicIds } });
      dbItems.forEach((item) => {
        expect(item.status).toBe("scheduled");
        expect(item.scheduledForMeetingId.toString()).toBe(
          newMeeting._id.toString(),
        );
      });
    });
  });
});
