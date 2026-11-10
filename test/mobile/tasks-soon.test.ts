// Tugas's "Hari ini" group and its soon pill (mobile/src/screens/tasks/soon.ts): by the calendar day, not 24-hour blocks.
import { expect, it } from "vitest";
import { daysAway, dueToday, soonness } from "../../mobile/src/screens/tasks/soon";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const now = at(10, 21, 0);

it("counts calendar days, so tonight is today and tomorrow morning is tomorrow", () => {
  expect(daysAway(now, at(10, 23, 59))).toBe(0);
  expect(daysAway(now, at(11, 8))).toBe(1);
  expect(daysAway(now, at(9, 23))).toBe(-1);
});

it("puts only what's still ahead today in Hari ini", () => {
  expect(dueToday(now, at(10, 23, 59))).toBe(true);
  expect(dueToday(now, at(10, 20))).toBe(false);
  expect(dueToday(now, at(11, 0, 30))).toBe(false);
  expect(dueToday(now, null)).toBe(false);
});

it("marks today red, the next three days amber, and leaves later and past rows to their date", () => {
  expect(soonness(now, at(10, 23, 59))).toEqual({ days: 0, tone: "red" });
  expect(soonness(now, at(11, 8))).toEqual({ days: 1, tone: "amber" });
  expect(soonness(now, at(13, 23))).toEqual({ days: 3, tone: "amber" });
  expect(soonness(now, at(14, 0, 5))).toBeNull();
  expect(soonness(now, at(10, 20))).toBeNull();
});
