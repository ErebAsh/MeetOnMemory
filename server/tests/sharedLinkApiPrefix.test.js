import { jest } from "@jest/globals";
import express from "express";
import supertest from "supertest";

// Mock userAuth middleware for testing protected shared link routes
jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    req.user = {
      _id: "507f1f77bcf86cd799439011",
      organization: "507f1f77bcf86cd799439022",
      role: "admin",
    };
    next();
  },
}));

// Mock controllers
jest.unstable_mockModule("../controllers/sharedLinkController.js", () => ({
  createLink: jest.fn().mockImplementation((req, res) =>
    res.status(201).json({
      success: true,
      link: {
        _id: "link-101",
        hash: "hash-101",
        resourceId: req.body.resourceId,
      },
    }),
  ),
  getActiveLinks: jest.fn().mockImplementation((req, res) =>
    res.status(200).json({
      success: true,
      links: [{ _id: "link-101", hash: "hash-101" }],
    }),
  ),
  revokeLink: jest
    .fn()
    .mockImplementation((req, res) =>
      res.status(200).json({ success: true, message: "Link revoked" }),
    ),
  getPublicResource: jest.fn().mockImplementation((req, res) =>
    res.status(200).json({
      success: true,
      resourceType: "Meeting",
      data: { title: "Public Sync" },
    }),
  ),
  verifyPasscode: jest
    .fn()
    .mockImplementation((req, res) =>
      res.status(200).json({ success: true, verified: true }),
    ),
}));

// Dynamically import routes after mocking
const { default: sharedLinkRoutes } =
  await import("../routes/sharedLinkRoutes.js");
const { default: publicSharedRoutes } =
  await import("../routes/publicSharedRoutes.js");

describe("Shared Links and Public Shared View Route Prefixes (#1999)", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/shared-links", sharedLinkRoutes);
    app.use("/api/public/shared", publicSharedRoutes);
  });

  it("POST /api/shared-links creates a shared link under /api prefix", async () => {
    const res = await supertest(app)
      .post("/api/shared-links")
      .send({ resourceId: "meet-1", resourceType: "Meeting" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.link._id).toBe("link-101");
  });

  it("GET /api/shared-links/:resourceType/:resourceId retrieves active links under /api prefix", async () => {
    const res = await supertest(app).get("/api/shared-links/Meeting/meet-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.links).toHaveLength(1);
  });

  it("DELETE /api/shared-links/:id revokes a link under /api prefix", async () => {
    const res = await supertest(app).delete("/api/shared-links/link-101");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/public/shared/:hash loads public resource under /api prefix", async () => {
    const res = await supertest(app).get("/api/public/shared/hash-101");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Public Sync");
  });

  it("POST /api/public/shared/:hash/verify verifies passcode under /api prefix", async () => {
    const res = await supertest(app)
      .post("/api/public/shared/hash-101/verify")
      .send({ passcode: "secret123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verified).toBe(true);
  });
});
