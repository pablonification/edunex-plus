// Pertemuan's quiet row for the meetings SIX counted before the months the app read (mobile/src/screens/course/earlier.ts):
// the list and the count always add up, and the split is said only when SIX's count tells it.
import { describe, expect, it } from "vitest";
import { earlierMeetings } from "../../mobile/src/screens/course/earlier";
import type { ClassResult } from "../../src/core/attendance";
import type { Meeting } from "../../src/core/course-meetings";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-11-10T10:00:00+07:00");

const meeting = (id: string, start: number, activity = "Kuliah"): Meeting => ({
  key: `s${id}`,
  start,
  end: start + 2 * HOUR,
  six: { id, courseCode: "KU5014", courseName: "Teknik", start, end: start + 2 * HOUR, activity, room: "9134" },
  presence: null,
  announced: null,
  notInSix: false,
});

const result = (start: number, kind: ClassResult["result"]): ClassResult => ({
  courseCode: "KU5014",
  start,
  end: start + 2 * HOUR,
  result: kind,
  at: start + 3 * HOUR,
});

const nov5 = Date.parse("2026-11-05T16:00:00+07:00");
const nov12 = Date.parse("2026-11-12T16:00:00+07:00");

describe("earlierMeetings", () => {
  it("counts the meetings SIX counted before the one listed, and their split when SIX's count tells it", () => {
    const meetings = [meeting("a", nov5), meeting("b", nov12)];
    expect(earlierMeetings(meetings, NOW, { held: 9, attended: 5 }, { a: result(nov5, "counted") })).toEqual({
      count: 8,
      before: nov5,
      attended: 4,
    });
  });

  it("gives the count alone when a listed meeting's mark isn't SIX's", () => {
    const meetings = [meeting("a", nov5)];
    expect(earlierMeetings(meetings, NOW, { held: 9, attended: 5 }, {})).toEqual({ count: 8, before: nov5, attended: null });
  });

  it("leaves out exams and a class SIX hasn't counted yet", () => {
    const uts = Date.parse("2026-10-15T08:00:00+07:00");
    const meetings = [meeting("u", uts, "UTS"), meeting("a", nov5)];
    expect(earlierMeetings(meetings, NOW, { held: 4, attended: 4 }, { a: result(nov5, "missing") })).toEqual({
      count: 4,
      before: null,
      attended: 4,
    });
  });

  it("says nothing when every counted meeting is listed", () => {
    expect(earlierMeetings([meeting("a", nov5)], NOW, { held: 1, attended: 1 }, {})).toBeNull();
    expect(earlierMeetings([], NOW, { held: null, attended: null }, {})).toBeNull();
  });
});
