import { jest } from "@jest/globals";
import mongoose from "mongoose";

const mockFind = jest.fn().mockReturnThis();
const mockSort = jest.fn().mockReturnThis();
const mockSkip = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockResolvedValue([]);
const mockCountDocuments = jest.fn().mockResolvedValue(0);

jest.unstable_mockModule("../models/notificationModel.js", () => ({
  default: {
    find: mockFind,
    sort: mockSort,
    skip: mockSkip,
    limit: mockLimit,
    countDocuments: mockCountDocuments,
  },
}));

const { getNotifications } =
  await import("../controllers/notificationController.js");

describe("getNotifications with search", () => {
  let req, res;
  const validUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: validUserId },
      query: { search: "test query" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("should build search filter correctly", async () => {
    await getNotifications(req, res);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { title: { $regex: "test query", $options: "i" } },
          { description: { $regex: "test query", $options: "i" } },
        ],
      }),
    );
  });
});
