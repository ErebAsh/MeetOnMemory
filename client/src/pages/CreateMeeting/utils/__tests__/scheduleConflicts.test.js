import { describe, expect, it } from "vitest";
import {
  buildScheduleSlot,
  findBusyParticipants,
  findFocusConflicts,
} from "../scheduleConflicts";

describe("schedule conflict helpers", () => {
  it("builds a local schedule slot from date, time and duration", () => {
    const slot = buildScheduleSlot("2026-08-24", "10:30", 45);

    expect(slot.start.getHours()).toBe(10);
    expect(slot.start.getMinutes()).toBe(30);
    expect(slot.end.getTime() - slot.start.getTime()).toBe(45 * 60 * 1000);
  });

  it("detects a recurring focus block on the selected weekday", () => {
    const slot = buildScheduleSlot("2026-08-24", "10:30", 30);
    const focusStart = new Date(2026, 7, 1, 10, 0, 0);
    const focusEnd = new Date(2026, 7, 1, 11, 0, 0);
    const conflicts = findFocusConflicts(
      [
        {
          _id: "focus-1",
          title: "Deep work",
          isRecurring: true,
          daysOfWeek: [1],
          startTime: focusStart.toISOString(),
          endTime: focusEnd.toISOString(),
        },
      ],
      slot,
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].title).toBe("Deep work");
  });

  it("lists only participants whose busy interval overlaps the proposed slot", () => {
    const slot = buildScheduleSlot("2026-08-24", "10:30", 30);
    const participants = [
      { name: "Busy User", email: "busy@example.com" },
      { name: "Free User", email: "free@example.com" },
    ];

    const busyStart = new Date(slot.start.getTime() - 15 * 60 * 1000);
    const busyEnd = new Date(slot.end.getTime() + 15 * 60 * 1000);
    const freeStart = new Date(slot.end.getTime() + 60 * 60 * 1000);
    const freeEnd = new Date(slot.end.getTime() + 120 * 60 * 1000);

    const busy = findBusyParticipants(
      {
        google: {
          "busy@example.com": {
            busy: [
              {
                start: busyStart.toISOString(),
                end: busyEnd.toISOString(),
              },
            ],
          },
          "free@example.com": {
            busy: [
              {
                start: freeStart.toISOString(),
                end: freeEnd.toISOString(),
              },
            ],
          },
        },
      },
      participants,
      slot,
    );

    expect(busy).toHaveLength(1);
    expect(busy[0].email).toBe("busy@example.com");
  });
});
