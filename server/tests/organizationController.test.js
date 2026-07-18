import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrJoinOrganization } from "../controllers/organizationController.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import AuditService from "../services/AuditService.js";

// Mock dependencies
vi.mock("../models/organizationModel.js", () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../models/userModel.js", () => ({
  default: {
    findByIdAndUpdate: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../services/AuditService.js", () => ({
  default: {
    logAction: vi.fn(),
  },
}));

vi.mock("../services/notificationService.js", () => ({
  createAndPushNotification: vi.fn(),
}));

// Provide a fake mock for membershipModel to avoid import issues from within the controller
vi.mock("../models/membershipModel.js", () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  }
}));

describe("organizationController - createOrJoinOrganization", () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: "user123" },
      body: { name: "Test Org" },
      app: {
        get: vi.fn().mockReturnValue({}), // mock io
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("should return 401 if user is not authenticated", async () => {
    req.user = null;

    await createOrJoinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication failed.",
    });
  });

  it("should return 400 if organization name is missing", async () => {
    req.body.name = "";

    await createOrJoinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Please provide an organization name.",
    });
  });

  it("should create a new organization if it does not exist", async () => {
    // Mock that org doesn't exist
    Organization.findOne.mockResolvedValue(null);

    // Mock org creation
    const mockCreatedOrg = {
      _id: "org123",
      name: "Test Org",
      members: ["user123"],
    };
    Organization.create.mockResolvedValue(mockCreatedOrg);

    // Mock user update & find
    userModel.findByIdAndUpdate.mockResolvedValue(true);
    userModel.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue({
        _id: "user123",
        role: "admin",
        organization: mockCreatedOrg,
        _doc: { name: "Test User" },
      }),
    });

    await createOrJoinOrganization(req, res);

    expect(Organization.findOne).toHaveBeenCalled();
    expect(Organization.create).toHaveBeenCalled();
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith("user123", {
      role: "admin",
      organization: "org123",
      hasCompletedOnboarding: true,
    });
    expect(AuditService.logAction).toHaveBeenCalled();
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Organization created successfully!",
      })
    );
  });
});
