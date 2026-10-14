import { jest } from "@jest/globals";

const mockCreateNotification = jest.fn();
const mockCreateNotifications = jest.fn();

jest.unstable_mockModule("../services/notificationService.js", () => ({
  createNotification: mockCreateNotification,
  createNotifications: mockCreateNotifications,
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findOne: jest.fn().mockReturnValue({
      collation: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439011" }),
    }),
  },
}));

const testDueDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now (within upcomingWindow)

const mockItem = {
  _id: "test-task-1",
  text: "Test task",
  assignee: { _id: "507f1f77bcf86cd799439011", email: "user@test.com" },
  owner: "507f1f77bcf86cd799439011",
  dueDate: testDueDate,
  reminderSent: {},
  save: jest.fn().mockResolvedValue(true),
};

jest.unstable_mockModule("../models/actionItemModel.js", () => ({
  default: {
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([mockItem]),
    }),
    updateMany: jest.fn(),
  },
}));

const { checkActionItemReminders } =
  await import("../services/actionItemReminderService.js");

describe("Deep link repairs", () => {
  it("uses proper /followup/tasks/:id link instead of /tasks", async () => {
    await checkActionItemReminders();
    expect(mockCreateNotification).toHaveBeenCalled();
    const callArgs = mockCreateNotification.mock.calls[0];
    const actionUrl = callArgs[4];
    expect(actionUrl).toBe("/followup/tasks/test-task-1");
  });
});
