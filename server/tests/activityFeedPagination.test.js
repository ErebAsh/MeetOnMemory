import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

jest.unstable_mockModule("../middleware/rbac.js", () => ({
  requireOrgMembership: (req, res, next) => {
    if (!req.user || !req.user.organization) {
      return res.status(400).json({ error: "No organization selected." });
    }
    next();
  },
}));

const { default: userModel } = await import("../models/userModel.js");
const { default: activityRoutes } = await import("../routes/activityRoutes.js");
const { default: Activity } = await import("../models/activityModel.js");
const { default: express } = await import("express");

const app = express();
app.use(express.json());
app.use("/api/activities", activityRoutes);

describe("Activity Feed Pagination Boundaries (#1668)", () => {
  const ORG_ID = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.TEST_MONGODB_URI);
    }
  });

  beforeEach(async () => {
    await Activity.deleteMany({});

    currentUser = {
      _id: new mongoose.Types.ObjectId(),
      organization: ORG_ID,
      role: "member",
    };

    // Create 150 dummy activity records for testing limits up to 100
    const activitiesToCreate = [];
    for (let i = 1; i <= 150; i++) {
      activitiesToCreate.push({
        organization: ORG_ID,
        actor: currentUser._id,
        action: "meeting.created",
        targetType: "Meeting",
        targetId: new mongoose.Types.ObjectId(),
        targetTitle: `Meeting ${i}`,
      });
    }
    await Activity.insertMany(activitiesToCreate);
  });

  it("uses default limit of 20 when limit parameter is omitted", async () => {
    const res = await request(app).get("/api/activities");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(20);
    expect(res.body.totalActivities).toBe(150);
  });

  it("respects valid limit within maximum (limit=35)", async () => {
    const res = await request(app).get("/api/activities?limit=35");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(35);
  });

  it("respects limit exactly equal to maximum (limit=100)", async () => {
    const res = await request(app).get("/api/activities?limit=100");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(100);
  });

  it("clamps limit above maximum (limit=150) to configured max (100)", async () => {
    const res = await request(app).get("/api/activities?limit=150");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(100);
  });

  it("handles zero (limit=0) safely by falling back to default limit (20)", async () => {
    const res = await request(app).get("/api/activities?limit=0");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(20);
  });

  it("handles negative values (limit=-5, page=-2) safely without throwing or breaking MongoDB skip", async () => {
    const res = await request(app).get("/api/activities?limit=-5&page=-2");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(20);
    expect(res.body.currentPage).toBe(1);
  });

  it("handles non-numeric values (limit=abc) safely by falling back to default limit (20)", async () => {
    const res = await request(app).get("/api/activities?limit=abc&page=xyz");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(20);
    expect(res.body.currentPage).toBe(1);
  });

  it("clamps very large values (limit=10000000) to configured maximum (100)", async () => {
    const res = await request(app).get("/api/activities?limit=10000000");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(100);
  });
});
