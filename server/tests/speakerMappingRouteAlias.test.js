import request from "supertest";
import mongoose from "mongoose";

const { default: express } = await import("express");
const { default: routesIndex } = await import("../routes/index.js");
const { default: Meeting } = await import("../models/meetingModel.js");

describe("Speaker Mapping Route Alias Integration Tests (#1886)", () => {
  const ORG_ID = new mongoose.Types.ObjectId();
  const USER_ID = new mongoose.Types.ObjectId();
  let app;
  let meeting;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.TEST_MONGODB_URI);
    }
    app = express();
    app.use(express.json());
    // Inject mock req.user matching userAuth output
    app.use((req, res, next) => {
      req.user = {
        _id: USER_ID,
        organization: ORG_ID,
        role: "member",
      };
      next();
    });
    app.use(routesIndex);

    meeting = await Meeting.create({
      uploadedBy: USER_ID,
      organization: ORG_ID,
      title: "Alias Test Meeting",
      date: new Date(),
    });
  });

  afterAll(async () => {
    await Meeting.deleteMany({});
  });

  it("resolves singular /api/speaker-mapping GET mappings cleanly without 404", async () => {
    const res = await request(app).get(`/api/speaker-mapping/${meeting._id}`);
    expect(res.status).not.toBe(404);
  });

  it("resolves plural /api/speaker-mappings GET mappings cleanly without 404", async () => {
    const res = await request(app).get(`/api/speaker-mappings/${meeting._id}`);
    expect(res.status).not.toBe(404);
  });
});
