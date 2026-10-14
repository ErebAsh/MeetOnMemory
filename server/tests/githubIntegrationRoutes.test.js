// server/tests/githubIntegrationRoutes.test.js
import { jest } from "@jest/globals";
import express from "express";
import supertest from "supertest";

// Mock userAuth middleware for testing
jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    req.user = {
      _id: "507f1f77bcf86cd799439011",
      organization: "507f1f77bcf86cd799439022",
      githubIntegration: {
        username: "octocat",
        accessToken: "gho_mock_access_token_12345",
      },
      save: jest.fn().mockResolvedValue(true),
    };
    next();
  },
}));

jest.unstable_mockModule("../models/githubIntegrationModel.js", () => ({
  default: {
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    findOneAndDelete: jest.fn().mockResolvedValue(null),
  },
}));

const { default: githubRoutes } =
  await import("../routes/githubIntegrationRoutes.js");

describe("GitHub Integration Routes & Hook Configuration Tests", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/github", githubRoutes);
  });

  it("GET /api/github/status should respond under /api prefix and return connection status", async () => {
    const res = await supertest(app).get("/api/github/status");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isConnected).toBe(true);
    expect(res.body.githubUser).toBe("octocat");
    expect(res.body.backendUrl).not.toContain("5000");
  });

  it("GET /api/github/connect should initiate OAuth flow using dynamic backend URL (not port 5000)", async () => {
    const res = await supertest(app).get("/api/github/connect");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.redirectUri).toContain("/api/github/oauth_redirect");
    expect(res.body.redirectUri).not.toContain("5000");
  });

  it("POST /api/github/disconnect should disconnect GitHub integration", async () => {
    const res = await supertest(app).post("/api/github/disconnect");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("disconnected successfully");
  });

  it("GET /api/github/repos should return repository list under /api prefix", async () => {
    const res = await supertest(app).get("/api/github/repos");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.repositories)).toBe(true);
  });
});
