import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

const { default: exportRoutes } = await import("../routes/export.routes.js");
const { default: ExportTemplate } = await import("../models/ExportTemplate.js");
await import("../models/userModel.js");
const { default: express } = await import("express");

const app = express();
app.use(express.json());
app.use("/api/export-templates", exportRoutes);

describe("Custom Export Templates API & Authorization (#1670)", () => {
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

  const MALLORY_ORG_B = {
    _id: new mongoose.Types.ObjectId(),
    organization: ORG_B,
    role: "member",
    email: "mallory@orgb.com",
  };

  let templateA;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.TEST_MONGODB_URI);
    }
  });

  beforeEach(async () => {
    await ExportTemplate.deleteMany({});

    templateA = await ExportTemplate.create({
      name: "Org A Default Template",
      description: "Standard executive template for Org A",
      templateContent: "<h1>{{meeting.title}}</h1>",
      styles: "h1 { color: red; }",
      createdBy: ALICE_ORG_A._id,
      organization: ORG_A,
      organizationId: ORG_A,
      isPublic: true,
    });
  });

  describe("Authentication", () => {
    it("rejects unauthenticated requests with 401", async () => {
      currentUser = null;

      const res = await request(app).get("/api/export-templates/templates");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/unauthorized/i);
    });
  });

  describe("Same-Organization Access & CRUD", () => {
    it("allows user in Org A to list templates in Org A", async () => {
      currentUser = ALICE_ORG_A;

      const res = await request(app).get("/api/export-templates/templates");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Org A Default Template");
    });

    it("allows user in Org A to create a new custom export template", async () => {
      currentUser = ALICE_ORG_A;

      const res = await request(app)
        .post("/api/export-templates/templates")
        .send({
          name: "Engineering MoM Template",
          description: "Technical notes layout",
          templateContent: "<div>{{meeting.summary}}</div>",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Engineering MoM Template");
      expect(res.body.data.organization.toString()).toBe(ORG_A.toString());
    });

    it("allows user in Org A to retrieve template by ID", async () => {
      currentUser = BOB_ORG_A;

      const res = await request(app).get(
        `/api/export-templates/templates/${templateA._id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(templateA._id.toString());
    });

    it("allows creator to update template", async () => {
      currentUser = ALICE_ORG_A;

      const res = await request(app)
        .put(`/api/export-templates/templates/${templateA._id}`)
        .send({ name: "Updated Org A Template" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Org A Template");
    });

    it("allows creator to delete template", async () => {
      currentUser = ALICE_ORG_A;

      const res = await request(app).delete(
        `/api/export-templates/templates/${templateA._id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await ExportTemplate.findById(templateA._id);
      expect(check).toBeNull();
    });

    it("allows previewing rendered template HTML with sanitization", async () => {
      currentUser = ALICE_ORG_A;

      const res = await request(app)
        .post("/api/export-templates/templates/preview")
        .send({
          templateContent: "<h2>{{meeting.title}}</h2>",
          meetingData: { meeting: { title: "Q3 Strategy" } },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.html).toMatch(/Q3 Strategy/i);
    });
  });

  describe("Cross-Organization Tenant Isolation", () => {
    it("denies access to template from another organization (403)", async () => {
      currentUser = MALLORY_ORG_B;

      const res = await request(app).get(
        `/api/export-templates/templates/${templateA._id}`,
      );

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it("denies template modification by cross-organization user (403)", async () => {
      currentUser = MALLORY_ORG_B;

      const res = await request(app)
        .put(`/api/export-templates/templates/${templateA._id}`)
        .send({ name: "Hacked Template Name" });

      expect(res.status).toBe(403);
    });

    it("denies template deletion by cross-organization user (403)", async () => {
      currentUser = MALLORY_ORG_B;

      const res = await request(app).delete(
        `/api/export-templates/templates/${templateA._id}`,
      );

      expect(res.status).toBe(403);
    });
  });
});
