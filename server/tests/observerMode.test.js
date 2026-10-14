import { jest } from "@jest/globals";
import mongoose from "mongoose";

jest.unstable_mockModule("../services/notificationService.js", () => ({
  createNotification: jest.fn().mockResolvedValue(true),
}));

const observerController = await import("../controllers/observerController.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: User } = await import("../models/userModel.js");

describe("Observer Mode", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should approve a shadow request successfully", async () => {
    const hostId = new mongoose.Types.ObjectId();
    const targetUserId = new mongoose.Types.ObjectId();
    const meetingId = new mongoose.Types.ObjectId();

    const meetingMock = {
      _id: meetingId,
      host: hostId,
      uploadedBy: hostId,
      title: "Design Review",
      pendingObservers: [targetUserId],
      participants: [{ user: new mongoose.Types.ObjectId(), role: "member" }],
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(Meeting, "findById").mockResolvedValue(meetingMock);
    jest.spyOn(User, "findById").mockResolvedValue({
      _id: targetUserId,
      name: "Observer User",
      email: "observer@example.com",
    });

    const req = {
      params: {
        meetingId: meetingId.toString(),
        userId: targetUserId.toString(),
      },
      user: { _id: hostId },
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await observerController.approveShadowRequest(req, res);

    expect(meetingMock.participants).toHaveLength(2);
    expect(meetingMock.participants[1].user).toEqual(targetUserId);
    expect(meetingMock.participants[1].role).toBe("observer");
    expect(meetingMock.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledTimes(1);
  });

  it("should deny a shadow request if not host", async () => {
    const hostId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const meetingId = new mongoose.Types.ObjectId();

    const meetingMock = {
      _id: meetingId,
      host: hostId,
      uploadedBy: hostId,
      participants: [],
    };

    jest.spyOn(Meeting, "findById").mockResolvedValue(meetingMock);

    const req = {
      params: {
        meetingId: meetingId.toString(),
        userId: new mongoose.Types.ObjectId().toString(),
      },
      user: { _id: otherUserId },
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await observerController.approveShadowRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
