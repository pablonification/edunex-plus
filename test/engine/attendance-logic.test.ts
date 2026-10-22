// v2-16 (#85): the attendance guard's reasoning, on its own: where a course's
// attendance counts, what SIX's exact count leaves before the target, meetings
// left to ITB's last lecture day, and the action each Edunex Presence window
// counts.
import { describe, expect, it } from "vitest";
import {
  type AttendanceHealth,
  type AttendanceInput,
  absenceBudget,
  afterClass,
  allowedAbsences,
  appendCount,
  attendanceHealth,
  type ClassResults,
  type CountLog,
  clashPick,
  classResults,
  countedIn,
  dayAnswer,
  estimatedBudget,
  lecturePeriod,
  meetingsLeft,
  percent,
  presenceAction,
  presenceGroup,
  presenceOptional,
  resultGate,
  resultNeedsStudent,
  sortGroup,
  targetFor,
  usualSlots,
} from "../../src/core/attendance";
import type { AcademicCalendar, CalendarEvent, ClassSession, PresenceSession, Task } from "../../src/core/models";
import { aTask } from "../kit/tasks";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

function event(kind: CalendarEvent["kind"], firstDay: string, lastDay: string): CalendarEvent {
  return {
    id: `${kind}-${firstDay}`,
    title: kind,
    kind,
    term: "2026-1",
    start: wib(`${firstDay}T00:00:00`),
    end: wib(`${lastDay}T00:00:00`) + DAY,
    allDay: true,
    firstDay,
    lastDay,
  };
}

/** ITB's real 2026-1 dates: UTS 12–16 Oct, last lecture day 4 Dec, UAS 7–22 Dec, Christmas. */
const CALENDAR: AcademicCalendar = {
  checkedAt: 0,
  events: [
    event("lecture-start", "2026-08-24", "2026-08-24"),
    event("uts", "2026-10-12", "2026-10-16"),
    event("lecture-end", "2026-12-04", "2026-12-04"),
    event("uas", "2026-12-07", "2026-12-22"),
    event("holiday", "2026-12-24", "2026-12-26"),
  ],
};

let ids = 0;
function session(code: string, startIso: string, hours = 2, activity = "Kuliah"): ClassSession {
  const start = wib(startIso);
  return { id: `m${++ids}`, courseCode: code, courseName: code, start, end: start + hours * HOUR, activity, room: "9134" };
}

/** A course meeting weekly from `firstIso`, `weeks` times. */
const weekly = (code: string, firstIso: string, weeks: number, hours = 2) =>
  Array.from({ length: weeks }, (_, i) => {
    const s = session(code, firstIso, hours);
    return { ...s, start: s.start + i * 7 * DAY, end: s.end + i * 7 * DAY };
  });

function presence(id: number, startIso: string, minutes: number, patch: Partial<PresenceSession> = {}): PresenceSession {
  const start = wib(startIso);
  return {
    id,
    courseId: 95001,
    classId: 86778,
    start,
    end: start + minutes * 60_000,
    opensAt: start,
    closesAt: start + minutes * 60_000,
    topic: null,
    note: null,
    countsBy: [],
    url: null,
    recorded: null,
    ...patch,
  };
}

describe("where attendance counts", () => {
  const now = wib("2026-10-08T12:00:00");
  // The View Course default nobody uses: Edunex recorded the Student once in 7 closed windows.
  const viewCourse = Array.from({ length: 7 }, (_, i) =>
    presence(
      i + 1,
      new Date(wib("2026-08-27T08:00:00") + i * 7 * DAY + 7 * HOUR).toISOString().slice(0, 19),
      90,
      i === 0 ? { recorded: { present: true, at: null } } : {},
    ),
  );

  it("in SIX when SIX counted far more than Edunex recorded (Edunex's unused windows aren't absences)", () => {
    expect(countedIn({ attended: 6, held: 7 }, viewCourse, now)).toBe("six");
  });

  it("in both when Edunex's record keeps up with SIX's count", () => {
    const kept = viewCourse.map((p, i) => (i < 5 ? { ...p, recorded: { present: true, at: null } } : p));
    expect(countedIn({ attended: 6, held: 7 }, kept, now)).toBe("both");
  });

  it("in Edunex when only Edunex has a record, in SIX when Edunex has no windows, else unknown", () => {
    expect(countedIn(null, viewCourse, now)).toBe("edunex");
    expect(countedIn({ attended: 0, held: 0 }, viewCourse, now)).toBe("edunex");
    expect(countedIn({ attended: 3, held: 4 }, [], now)).toBe("six");
    expect(countedIn(null, [], now)).toBe("unknown");
    // Windows still to come say nothing yet.
    expect(countedIn({ attended: 3, held: 4 }, [presence(1, "2026-10-15T08:00:00", 90)], now)).toBe("six");
  });

  it("signed out of SIX: not known where it counts, so Edunex's record never claims to be the count", () => {
    expect(countedIn(null, viewCourse, now, false)).toBe("noSix");
    expect(countedIn(null, [], now, false)).toBe("unknown");
  });
});

describe("meetings left to the last lecture day", () => {
  const period = lecturePeriod(CALENDAR, "2026-1", wib("2026-10-08T12:00:00"))!;

  it("reads the last lecture day and the days without lectures from ITB's calendar", () => {
    expect(period.lastDay).toBe("2026-12-04");
    expect([...period.offDays].filter((d) => d.startsWith("2026-10"))).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
    // Without SIX's term: the coming lecture end.
    expect(lecturePeriod(CALENDAR, null, wib("2026-10-08T12:00:00"))?.lastDay).toBe("2026-12-04");
    expect(lecturePeriod(undefined, "2026-1", 0)).toBeNull();
  });

  it("counts SIX's coming sessions, then carries the weekly slot on to 4 Dec, skipping exam weeks and UTS sessions", () => {
    // Thursdays 08:00 from 27 Aug through October; SIX puts the UTS in the 15 Oct slot.
    const schedule = [...weekly("PL3002", "2026-08-27T08:00:00", 10)].map((s) => (wibDate(s.start) === "2026-10-15" ? { ...s, activity: "UTS" } : s));
    const left = meetingsLeft("PL3002", schedule, period, wib("2026-10-08T12:00:00"));
    // 22 and 29 Oct on SIX's timetable, then 5, 12, 19, 26 Nov and 3 Dec carried on.
    expect(left).toMatchObject({ count: 7, estimated: true });
    expect(wibDate(left.next!.start)).toBe("2026-10-22");
  });

  it("follows the new slot after a mid-semester schedule change", () => {
    // Tuesdays and Thursdays until September, then Wednesdays only.
    const before = [...weekly("II3120", "2026-08-25T10:00:00", 6), ...weekly("II3120", "2026-08-27T10:00:00", 6)];
    const after = weekly("II3120", "2026-10-07T13:00:00", 4);
    expect(usualSlots([...before, ...after])).toEqual([{ weekday: 3, start: 13 * 60, length: 2 * HOUR }]);
    const left = meetingsLeft("II3120", [...before, ...after], period, wib("2026-10-08T12:00:00"));
    // 14 Oct (listed by SIX in UTS week: it may not run, so not counted), 21, 28 Oct, then Wednesdays 4 Nov – 2 Dec.
    expect(left.count).toBe(7);
    expect(left.upcoming).toHaveLength(8);
    // SIX moves one class: the next meeting follows.
    const moved = after.map((s, i) => (i === 1 ? { ...s, start: s.start + DAY, end: s.end + DAY } : s));
    expect(wibDate(meetingsLeft("II3120", [...before, ...moved], period, wib("2026-10-08T12:00:00")).next!.start)).toBe("2026-10-15");
  });

  it("a one-off extra class is no weekly slot", () => {
    const sessions = [...weekly("KU5014", "2026-09-03T16:00:00", 5), session("KU5014", "2026-09-26T09:00:00")];
    expect(usualSlots(sessions)).toEqual([{ weekday: 4, start: 16 * 60, length: 2 * HOUR }]);
  });

  it("a lecture SIX still lists inside the UTS week is uncertain and not counted, yet listed with its date", () => {
    // SIX keeps the Thursday lecture in the 15 Oct slot of Masa UTS; it may not happen.
    const schedule = weekly("PL3002", "2026-08-27T08:00:00", 10);
    const left = meetingsLeft("PL3002", schedule, period, wib("2026-10-08T12:00:00"));
    expect(left.count).toBe(7);
    expect(left.upcoming).toHaveLength(8);
    expect(left.upcoming.map((m) => [wibDate(m.start), m.estimated, m.uncertain])).toEqual([
      ["2026-10-15", false, true],
      ["2026-10-22", false, false],
      ["2026-10-29", false, false],
      ["2026-11-05", true, false],
      ["2026-11-12", true, false],
      ["2026-11-19", true, false],
      ["2026-11-26", true, false],
      ["2026-12-03", true, false],
    ]);
    // The next meeting is SIX's next, uncertain or not: a Student with no absences left must not skip it.
    expect(wibDate(left.next!.start)).toBe("2026-10-15");
    expect(left.upcoming[0].session?.id).toBe(left.next!.id);
  });

  it("a meeting in an exam week with a hand-in for attendance that day isn't uncertain: the lecturer set it", () => {
    const schedule = [session("II4091", "2026-10-16T15:00:00", 8), session("II4091", "2026-10-30T15:00:00", 8)];
    const handIn = presence(2243740, "2026-10-16T15:00:00", 539, { courseId: 95326, countsBy: [{ kind: "assignment", id: "117003" }] });
    const viewCourse = presence(2243741, "2026-10-15T15:00:00", 90, { courseId: 95326 });
    expect(meetingsLeft("II4091", schedule, period, wib("2026-10-08T12:00:00")).upcoming[0].uncertain).toBe(true);
    expect(meetingsLeft("II4091", schedule, period, wib("2026-10-08T12:00:00"), [viewCourse]).upcoming[0].uncertain).toBe(true);
    expect(meetingsLeft("II4091", schedule, period, wib("2026-10-08T12:00:00"), [handIn]).upcoming[0].uncertain).toBe(false);
    // So it counts: one more meeting than without the hand-in.
    expect(meetingsLeft("II4091", schedule, period, wib("2026-10-08T12:00:00"), [handIn]).count).toBe(
      meetingsLeft("II4091", schedule, period, wib("2026-10-08T12:00:00")).count + 1,
    );
  });

  it("without the calendar, only SIX's listed sessions count, and not as an estimate", () => {
    const left = meetingsLeft("PL3002", weekly("PL3002", "2026-08-27T08:00:00", 10), null, wib("2026-10-08T12:00:00"));
    expect(left).toMatchObject({ count: 3, estimated: false });
  });
});

const wibDate = (ms: number) => new Date(ms + 7 * HOUR).toISOString().slice(0, 10);

describe("the absence budget", () => {
  const now = wib("2026-10-08T12:00:00");
  /** A course with `remaining` meetings left on SIX's timetable (no calendar). */
  const health = (attended: number, held: number, remaining: number, target = 80) => {
    const schedule = Array.from({ length: remaining }, (_, i) => ({ ...session("X", "2026-10-09T08:00:00"), start: wib("2026-10-09T08:00:00") + i * DAY }));
    const input: AttendanceInput = { code: "X", six: { attended, held }, presence: [], schedule, period: null, target, now };
    return attendanceHealth(input);
  };

  it("no absences left: 4 of 6 with 7 to go at 80% (best 85%, back above after 4 in a row)", () => {
    const h = health(4, 6, 7);
    expect(h).toMatchObject({ state: "none", absencesLeft: 0, toRecover: 4 });
    expect(Math.round(h.best! * 100)).toBe(85);
  });

  it("target out of reach: 2 of 6 with 8 to go (best 71%)", () => {
    const h = health(2, 6, 8);
    expect(h.state).toBe("out");
    expect(h.absencesLeft).toBeLessThan(0);
    expect(Math.round(h.best! * 100)).toBe(71);
    // 2 → 80% needs 16 in a row; only 8 are left.
    expect(h.toRecover).toBeNull();
  });

  it("room to spare, one left, and the target the Student set", () => {
    expect(health(7, 7, 7)).toMatchObject({ state: "safe", absencesLeft: 2, toRecover: null });
    expect(health(6, 7, 7)).toMatchObject({ state: "risk", absencesLeft: 1 });
    expect(health(6, 7, 7, 75)).toMatchObject({ state: "safe", absencesLeft: 2 });
    expect(health(6, 7, 7, 100)).toMatchObject({ state: "out" });
  });

  it("is unknown until SIX shows a count", () => {
    const input: AttendanceInput = { code: "X", six: null, presence: [], schedule: [], period: null, target: 80, now };
    expect(attendanceHealth(input)).toMatchObject({ state: "unknown", absencesLeft: null, best: null, target: 80 });
  });

  it("a UTS-week lecture SIX still lists is no absence to spare: 6 of 7 leaves one, not two", () => {
    // PL3002 on Thursdays; SIX lists 15 Oct (UTS week) as a lecture. Counting it would say "2× lagi".
    const period = lecturePeriod(CALENDAR, "2026-1", now)!;
    const input: AttendanceInput = {
      code: "PL3002",
      six: { attended: 6, held: 7 },
      presence: [],
      schedule: weekly("PL3002", "2026-08-27T08:00:00", 10),
      period,
      target: 80,
      now,
    };
    expect(attendanceHealth(input)).toMatchObject({ state: "risk", absencesLeft: 1, needsUncertain: false });
    expect(attendanceHealth(input).left.upcoming.filter((m) => m.uncertain)).toHaveLength(1);
  });

  it("nor does it take the target away: 4 of 7 can still finish at 80% if the UTS-week lecture runs, so it's no absences left, not out of reach", () => {
    const period = lecturePeriod(CALENDAR, "2026-1", now)!;
    const input: AttendanceInput = {
      code: "PL3002",
      six: { attended: 4, held: 7 },
      presence: [],
      schedule: weekly("PL3002", "2026-08-27T08:00:00", 10),
      period,
      target: 80,
      now,
    };
    // 15 Oct (may not run), 22 and 29 Oct, then Thursdays to 3 Dec: 12 of 15 if every one runs and is attended.
    const health = attendanceHealth(input);
    expect(health).toMatchObject({ state: "none", absencesLeft: 0, needsUncertain: true });
    expect(percent(health.best!)).toBe(80);
    // Without that lecture on SIX's timetable, 80% is out of reach.
    const without = attendanceHealth({ ...input, schedule: input.schedule.filter((s) => wibDate(s.start) !== "2026-10-15") });
    expect(without).toMatchObject({ state: "out", needsUncertain: false });
    expect(percent(without.best!)).toBe(78);
  });
});

describe("once lectures are over", () => {
  /** PL3002 meets on Thursdays to 3 Dec (ITB's last lecture day is Friday 4 Dec). */
  const pl = (attended: number, held: number, now: string, period: ReturnType<typeof lecturePeriod> = lecturePeriod(CALENDAR, "2026-1", wib(now))) =>
    attendanceHealth({
      code: "PL3002",
      six: { attended, held },
      presence: [],
      schedule: weekly("PL3002", "2026-08-27T08:00:00", 15),
      period,
      target: 80,
      now: wib(now),
    });

  it("after the course's last class, the verdict is final: met at or above the target, never 'don't miss another'", () => {
    // 4 of 4, 12 of 15, 15 of 15: nothing left to attend, so no absence is "left" or "needed".
    for (const [attended, held] of [
      [4, 4],
      [12, 15],
      [15, 15],
    ])
      expect(pl(attended, held, "2026-12-03T12:00:00")).toMatchObject({ state: "met", absencesLeft: 0, toRecover: null, needsUncertain: false });
    // That morning, before it, the last class is still to come: the budget, as before ("Masih bisa absen 1× lagi").
    expect(pl(4, 4, "2026-12-03T07:00:00").state).not.toBe("met");
  });

  it("finished below the target: missed, with the share it finished at, not 'out of reach'", () => {
    const health = pl(11, 15, "2026-12-03T12:00:00");
    expect(health).toMatchObject({ state: "missed", toRecover: null });
    expect(health.absencesLeft).toBeLessThan(0);
    expect(percent(health.best!)).toBe(73);
  });

  it("past ITB's last lecture day it's over, even for a course SIX never timetabled", () => {
    const period = lecturePeriod(CALENDAR, "2026-1", wib("2026-12-08T09:00:00"));
    const health = attendanceHealth({
      code: "KP",
      six: { attended: 4, held: 4 },
      presence: [],
      schedule: [],
      period,
      target: 80,
      now: wib("2026-12-08T09:00:00"),
    });
    expect(health.state).toBe("met");
  });

  it("isn't over while a Presence window of the course is still open: marking it there still counts", () => {
    const during = (closesIn: number) =>
      attendanceHealth({
        code: "PL3002",
        six: { attended: 11, held: 15 },
        // The last class (3 Dec 08:00–10:00) ran, and its window closes at 13:00, or already closed.
        presence: [presence(1, "2026-12-03T08:00:00", 300 + closesIn)],
        schedule: weekly("PL3002", "2026-08-27T08:00:00", 15),
        period: lecturePeriod(CALENDAR, "2026-1", wib("2026-12-03T12:00:00")),
        target: 80,
        now: wib("2026-12-03T12:00:00"),
      }).state;
    expect(during(0)).not.toMatch(/met|missed/);
    expect(during(-180)).toBe("missed");
  });

  it("isn't over while a class may still run, nor without ITB's calendar to say when lectures end", () => {
    // Only a class SIX still lists on a holiday is left (3 Dec made a holiday): it may run, so nothing is final yet.
    const holiday = { ...CALENDAR, events: [...CALENDAR.events, event("holiday", "2026-12-03", "2026-12-03")] };
    expect(pl(12, 14, "2026-11-27T12:00:00", lecturePeriod(holiday, "2026-1", wib("2026-11-27T12:00:00"))).state).not.toMatch(/met|missed/);
    // Without the calendar, SIX's timetable alone can't say the term is over.
    expect(pl(4, 4, "2026-12-03T12:00:00", null).state).not.toMatch(/met|missed/);
  });
});

describe("each course's own target", () => {
  const now = wib("2026-10-08T12:00:00");
  const settings = { attendanceTarget: 80, attendanceTargets: { DK4073: 75 } };

  it("is the course contract's when the Student set one, else the default", () => {
    expect(targetFor(settings, "DK4073")).toBe(75);
    expect(targetFor(settings, "PL3002")).toBe(80);
    // Not a property every object has.
    expect(targetFor(settings, "constructor")).toBe(80);
  });

  it("is what the course is judged against, and says so: 4 of 6 with 7 to go has no absences left at 80%, one at 75%", () => {
    const schedule = Array.from({ length: 7 }, (_, i) => ({ ...session("DK4073", "2026-10-09T08:00:00"), start: wib("2026-10-09T08:00:00") + i * DAY }));
    const health = (code: string) =>
      attendanceHealth({
        code,
        six: { attended: 4, held: 6 },
        presence: [],
        schedule: schedule.map((s) => ({ ...s, courseCode: code })),
        period: null,
        target: targetFor(settings, code),
        now,
      });
    expect(health("PL3002")).toMatchObject({ state: "none", absencesLeft: 0, target: 80 });
    expect(health("DK4073")).toMatchObject({ state: "risk", absencesLeft: 1, target: 75 });
  });
});

describe("what counts in an Edunex Presence window", () => {
  const task: Task = aTask({ id: 117003, courseCode: "II4091", courseId: 95326, moduleId: 450222, title: "Tugas 02 Bab II", status: "not_started" });

  it("View Course by default: the course page", () => {
    expect(presenceAction(presence(1, "2026-10-15T08:00:00", 90), [])).toEqual({
      activity: "course",
      task: null,
      url: "https://edunex.itb.ac.id/courses/95001",
    });
  });

  it("Answer Assignment: the Task, on the page Edunex gives, else the Task's module", () => {
    const window = presence(2, "2026-10-16T15:00:00", 539, {
      courseId: 95326,
      countsBy: [{ kind: "assignment", id: "117003" }],
      url: "https://edunex.itb.ac.id/courses/95326/preview/450222",
      note: "Presensi dengan submit Tugas 02 Bab II",
    });
    expect(presenceAction(window, [task])).toEqual({ activity: "assignment", task, url: "https://edunex.itb.ac.id/courses/95326/preview/450222" });
    expect(presenceAction({ ...window, url: null }, [task]).url).toBe("https://edunex.itb.ac.id/courses/95326/preview/450222");
    expect(presenceAction({ ...window, url: null }, [])).toMatchObject({ task: null, url: "https://edunex.itb.ac.id/courses/95326" });
  });

  it("a window that counts by several things: the Task the app knows, wherever the lecturer listed it", () => {
    const window = presence(5, "2026-10-16T15:00:00", 539, {
      courseId: 95326,
      countsBy: [
        { kind: "module", id: "450218" },
        { kind: "assignment", id: "117010" },
        { kind: "assignment", id: "117003" },
      ],
    });
    expect(presenceAction(window, [task])).toMatchObject({ activity: "assignment", task: { id: 117003 } });
    // Without the Task, the first thing the lecturer chose.
    expect(presenceAction(window, [])).toMatchObject({ activity: "module", task: null, url: "https://edunex.itb.ac.id/courses/95326/preview/450218" });
  });

  it("an Edunex window is optional only where SIX counts", () => {
    expect((["six", "both", "edunex", "unknown", "noSix", undefined] as const).map(presenceOptional)).toEqual([true, false, false, false, false, false]);
  });

  it("Read Module opens the module; every other category is named", () => {
    expect(presenceAction(presence(3, "2026-10-15T08:00:00", 90, { countsBy: [{ kind: "module", id: "473251" }] }), []).url).toBe(
      "https://edunex.itb.ac.id/courses/95001/preview/473251",
    );
    const kind = (k: string) => presenceAction(presence(4, "2026-10-15T08:00:00", 90, { countsBy: [{ kind: k, id: "1" }] }), []).activity;
    expect(["thread", "exam", "vicon", "crs_join", "crs_chat", "crs_vote", "course", "something_new"].map(kind)).toEqual([
      "thread",
      "exam",
      "vicon",
      "crs",
      "crs",
      "crs",
      "course",
      "other",
    ]);
  });
});

describe("after a class", () => {
  const before = { at: 0, attended: 5, held: 6 };
  it("tells counted, marked absent and not recorded apart", () => {
    expect(afterClass(before, { attended: 6, held: 7 })).toBe("counted");
    expect(afterClass(before, { attended: 5, held: 7 })).toBe("absent");
    expect(afterClass(before, { attended: 5, held: 6 })).toBe("missing");
  });
});

describe("absences left, as a budget the Student spends", () => {
  const now = wib("2026-10-08T12:00:00");
  /** `remaining` meetings left on SIX's timetable (no calendar). */
  const health = (attended: number, held: number, remaining: number, target = 80) => {
    const schedule = Array.from({ length: remaining }, (_, i) => ({ ...session("X", "2026-10-09T08:00:00"), start: wib("2026-10-09T08:00:00") + i * DAY }));
    return attendanceHealth({ code: "X", six: held ? { attended, held } : null, presence: [], schedule, period: null, target, now });
  };

  it("in reach: what's left, what was used, and the two make the term's allowance", () => {
    // PL3002, 6 of 7 with 8 to go at 80%: ⌊0.2 × 15⌋ = 3 allowed, 1 used, 2 left.
    expect(absenceBudget(health(6, 7, 8))).toEqual({ allowed: 3, left: 2, used: 1, over: 0 });
    expect(absenceBudget(health(7, 7, 7))).toEqual({ allowed: 2, left: 2, used: 0, over: 0 });
    // No absences left: every one used.
    expect(absenceBudget(health(4, 6, 7))).toEqual({ allowed: 2, left: 0, used: 2, over: 0 });
    for (const [a, h, r] of [
      [6, 7, 8],
      [5, 7, 9],
      [4, 6, 7],
      [3, 4, 10],
    ]) {
      const budget = absenceBudget(health(a, h, r))!;
      expect(budget.used + budget.left).toBe(budget.allowed);
      expect(budget.used).toBe(h - a);
    }
  });

  it("out of reach: the whole allowance used, and the misses past it over", () => {
    // KU5014, 2 of 6 with 8 to go: ⌊0.2 × 14⌋ = 2 allowed, 4 missed, 2 over.
    const out = health(2, 6, 8);
    expect(out.state).toBe("out");
    expect(absenceBudget(out)).toEqual({ allowed: 2, left: 0, used: 2, over: 2 });
    for (const [a, h, r] of [
      [2, 6, 8],
      [3, 7, 7],
      [0, 3, 2],
    ]) {
      const budget = absenceBudget(health(a, h, r))!;
      expect(budget.used + budget.over).toBe(h - a);
      expect(budget.used).toBe(budget.allowed);
    }
  });

  it("a target of 100% allows none: nothing to draw while nothing was missed", () => {
    expect(absenceBudget(health(7, 7, 7, 100))).toEqual({ allowed: 0, left: 0, used: 0, over: 0 });
    expect(absenceBudget(health(6, 7, 7, 100))).toEqual({ allowed: 0, left: 0, used: 0, over: 1 });
  });

  it("nothing to spend without a count, nor once lectures are over", () => {
    expect(absenceBudget(health(0, 0, 7))).toBeNull();
    const period = lecturePeriod(CALENDAR, "2026-1", wib("2026-12-05T12:00:00"));
    const over = attendanceHealth({
      code: "X",
      six: { attended: 12, held: 14 },
      presence: [],
      schedule: [],
      period,
      target: 80,
      now: wib("2026-12-05T12:00:00"),
    });
    expect(over.state).toBe("met");
    expect(absenceBudget(over)).toBeNull();
  });

  it("before SIX counts, the allowance the timetable alone gives", () => {
    expect(estimatedBudget(health(0, 0, 0))).toBeNull();
    expect(estimatedBudget(health(0, 0, 14))).toBe(2);
    expect(estimatedBudget(health(0, 0, 15))).toBe(3);
    expect(estimatedBudget(health(0, 0, 15, 100))).toBe(0);
    expect(allowedAbsences(0, 0, 15, 80)).toBe(3);
  });
});

describe("Presensi's groups", () => {
  const now = wib("2026-10-08T07:00:00");
  const make = (code: string, six: { attended: number; held: number } | null, firstIso: string, patch: Partial<AttendanceInput> = {}) =>
    attendanceHealth({ code, six, presence: [], schedule: weekly(code, firstIso, 8), period: null, target: 80, now, ...patch });

  it("by what each course asks of the Student", () => {
    expect(presenceGroup(make("A", { attended: 2, held: 6 }, "2026-10-08T16:00:00"))).toBe("out");
    expect(presenceGroup(make("B", { attended: 4, held: 6 }, "2026-10-08T11:00:00"))).toBe("none");
    expect(presenceGroup(make("C", { attended: 6, held: 7 }, "2026-10-08T08:00:00"))).toBe("spare");
    expect(presenceGroup(make("D", { attended: 7, held: 7 }, "2026-10-08T08:00:00"))).toBe("spare");
    expect(presenceGroup(make("E", null, "2026-10-08T08:00:00"))).toBe("unknown");
    // Only Edunex has a record: its own group.
    const edunex = make("F", null, "2026-10-08T08:00:00", { presence: [presence(1, "2026-10-01T08:00:00", 90)] });
    expect(edunex.countedIn).toBe("edunex");
    expect(presenceGroup(edunex)).toBe("edunex");
    // Signed out of SIX with nothing of it kept: no state can be said.
    expect(presenceGroup(make("G", null, "2026-10-08T08:00:00", { sixConnected: false }), true)).toBe("courses");
  });

  it("in order inside a group: out by the best still possible, none by the next class, spare by fewest left then the next class", () => {
    const outs = [make("A", { attended: 3, held: 7 }, "2026-10-08T16:00:00"), make("B", { attended: 2, held: 7 }, "2026-10-08T16:00:00")];
    expect(sortGroup("out", outs, (h) => h).map((h) => h.code)).toEqual(["B", "A"]);
    const nones = [make("A", { attended: 4, held: 6 }, "2026-10-09T08:00:00"), make("B", { attended: 4, held: 6 }, "2026-10-08T11:00:00")];
    expect(sortGroup("none", nones, (h) => h).map((h) => h.code)).toEqual(["B", "A"]);
    const spare = [
      make("A", { attended: 7, held: 7 }, "2026-10-08T08:00:00"),
      make("B", { attended: 6, held: 7 }, "2026-10-09T08:00:00"),
      make("C", { attended: 6, held: 7 }, "2026-10-08T15:00:00"),
    ];
    expect(sortGroup("spare", spare, (h) => h).map((h) => h.code)).toEqual(["C", "B", "A"]);
  });
});

describe("two classes at once", () => {
  const now = wib("2026-10-08T07:00:00");
  const course = (code: string, attended: number | null, held = 7, target = 80): AttendanceHealth =>
    attendanceHealth({
      code,
      six: attended === null ? null : { attended, held },
      presence: [],
      schedule: weekly(code, "2026-10-08T16:00:00", 8),
      period: null,
      target,
      now,
    });

  it("the one still in reach over one out of reach, naming both facts", () => {
    const none = course("PL3032", 4, 7);
    const spare = course("PL3002", 6, 7);
    const out = course("KU5014", 2, 7);
    expect(none.state).toBe("none");
    expect(spare.absencesLeft).toBe(2);
    expect(out.state).toBe("out");
    expect(clashPick(none, out)).toEqual({ pick: "PL3032", why: "noneOut" });
    expect(clashPick(out, spare)).toEqual({ pick: "PL3002", why: "spareOut" });
  });

  it("between two in reach, the one with fewer left; none left says so; the same count picks neither", () => {
    const none = course("PL3032", 4, 7);
    const one = course("DK4073", 6, 8);
    const two = course("PL3002", 6, 7);
    expect(one.absencesLeft).toBe(1);
    expect(clashPick(one, two)).toEqual({ pick: "DK4073", why: "fewer" });
    expect(clashPick(two, none)).toEqual({ pick: "PL3032", why: "none" });
    expect(clashPick(none, course("X", 4, 7))).toEqual({ pick: null, why: "bothNone" });
    expect(clashPick(two, course("Y", 6, 7))).toEqual({ pick: null, why: "even" });
  });

  it("no answer when both are out of reach, or one has no count yet", () => {
    expect(clashPick(course("A", 2, 7), course("B", 1, 7))).toEqual({ pick: null, why: null });
    expect(clashPick(course("A", 6, 7), course("B", null))).toEqual({ pick: null, why: null });
  });
});

describe("the next class day, on top of Presensi", () => {
  const period = lecturePeriod(CALENDAR, "2026-1", wib("2026-10-08T08:00:00"));
  const schedule = [
    ...weekly("PL3002", "2026-08-27T08:00:00", 15),
    ...weekly("DK4073", "2026-08-27T11:00:00", 15),
    ...weekly("KU5014", "2026-08-27T16:00:00", 15),
  ].map((s) => (s.start >= wib("2026-10-12T00:00:00") && s.start < wib("2026-10-17T00:00:00") && s.courseCode === "KU5014" ? { ...s, activity: "UTS" } : s));
  const health = (code: string, attended: number | null, now: number) =>
    attendanceHealth({ code, six: attended === null ? null : { attended, held: 7 }, presence: [], schedule, period, target: 80, now });
  const courses = (now: number) => [health("PL3002", 6, now), health("DK4073", 4, now), health("KU5014", 2, now)];

  it("today while a class of today hasn't ended: how many, and which can spare one", () => {
    const now = wib("2026-10-08T08:07:00");
    expect(dayAnswer(courses(now), schedule, period, now)).toEqual({ kind: "day", day: "today", count: 3, spare: { codes: ["PL3002"], of: 3 } });
  });

  it("tomorrow once today's classes are over", () => {
    const now = wib("2026-10-07T22:00:00");
    expect(dayAnswer(courses(now), schedule, period, now)).toMatchObject({ kind: "day", day: "tomorrow", count: 3 });
  });

  it("no class today or tomorrow: the next one; exams aren't classes", () => {
    const now = wib("2026-10-09T09:00:00");
    // Thursday 15 Oct: PL3002 and DK4073 lectures (KU5014's is the UTS); SIX lists them in UTS week, so they may not run.
    expect(dayAnswer(courses(now), schedule, period, now)).toEqual({ kind: "next", at: wib("2026-10-22T08:00:00") });
    const thu = wib("2026-10-15T07:00:00");
    expect(dayAnswer(courses(thu), schedule, period, thu)).toMatchObject({ kind: "day", day: "today", count: 2 });
  });

  it("every course with a spare, none, and none counted yet", () => {
    const now = wib("2026-10-08T07:00:00");
    const spare = [health("PL3002", 6, now)];
    expect(dayAnswer(spare, schedule, period, now)).toMatchObject({ spare: { codes: ["PL3002"], of: 1 }, count: 1 });
    expect(dayAnswer([health("KU5014", 2, now)], schedule, period, now)).toMatchObject({ spare: { codes: [], of: 1 } });
    expect(dayAnswer([health("PL3002", null, now)], schedule, period, now)).toMatchObject({ spare: null });
  });

  it("after the last lecture day: when lectures ended", () => {
    const now = wib("2026-12-07T09:00:00");
    expect(dayAnswer(courses(now), schedule, period, now)).toEqual({ kind: "ended", lastDay: "2026-12-04" });
  });
});

describe("what SIX's count did after each class", () => {
  // PL3002 Thursdays 08:00–10:00; the app has watched since Wednesday.
  const classes = weekly("PL3002", "2026-10-01T08:00:00", 3);
  const [, thu] = classes;
  const log = (...counts: [string, number, number][]): CountLog => ({
    PL3002: counts.map(([iso, attended, held]) => ({ at: wib(iso), attended, held })),
  });

  it("the gate: a few hours after class, the same day", () => {
    expect(resultGate(thu)).toEqual({ at: wib("2026-10-08T13:00:00"), until: wib("2026-10-09T00:00:00") });
    const late = session("X", "2026-10-08T20:00:00");
    expect(resultGate(late).at).toBe(wib("2026-10-08T23:00:00"));
  });

  it("counted as soon as both numbers go up", () => {
    const counted = log(["2026-10-07T10:00:00", 6, 7], ["2026-10-08T10:30:00", 7, 8]);
    const results = classResults({}, counted, classes, wib("2026-10-08T10:31:00"), wib("2026-10-08T10:31:00"));
    expect(results[thu.id]).toMatchObject({ result: "counted", at: wib("2026-10-08T10:30:00"), courseCode: "PL3002" });
    expect(results[thu.id].wasAt).toBeUndefined();
  });

  it("absent or missing only once SIX was read after the gate", () => {
    const missing = log(["2026-10-07T10:00:00", 6, 7]);
    expect(classResults({}, missing, classes, wib("2026-10-08T12:59:00"), wib("2026-10-08T12:59:00"))).toEqual({});
    // Past the gate, but SIX last read before it: nothing said.
    expect(classResults({}, missing, classes, wib("2026-10-08T13:30:00"), wib("2026-10-08T12:00:00"))).toEqual({});
    const at = wib("2026-10-08T13:05:00");
    expect(classResults({}, missing, classes, at, at)[thu.id]).toMatchObject({ result: "missing", at });
    const absent = log(["2026-10-07T10:00:00", 6, 7], ["2026-10-08T11:00:00", 6, 8]);
    expect(classResults({}, absent, classes, at, at)[thu.id]).toMatchObject({ result: "absent" });
    // The next day is too late to say.
    expect(classResults({}, missing, classes, wib("2026-10-09T09:00:00"), wib("2026-10-09T09:00:00"))).toEqual({});
  });

  it("nothing for a class from before the app watched", () => {
    const late = log(["2026-10-08T09:00:00", 6, 7]);
    const at = wib("2026-10-08T14:00:00");
    expect(classResults({}, late, classes, at, at)).toEqual({});
  });

  it("two classes of one course in a day give no per-class result: SIX gives totals", () => {
    const twice = [session("PL3002", "2026-10-08T08:00:00"), session("PL3002", "2026-10-08T13:00:00")];
    const counts = log(["2026-10-07T10:00:00", 6, 7]);
    const at = wib("2026-10-08T22:00:00");
    expect(classResults({}, counts, twice, at, at)).toEqual({});
    // One count up after both: still can't say which.
    const once = log(["2026-10-07T10:00:00", 6, 7], ["2026-10-08T16:00:00", 7, 8]);
    expect(classResults({}, once, twice, at, at)).toEqual({});
  });

  it("missing, then counted later: when it was first judged is kept", () => {
    const first = wib("2026-10-08T13:05:00");
    const before: ClassResults = classResults({}, log(["2026-10-07T10:00:00", 6, 7]), classes, first, first);
    const fixed = log(["2026-10-07T10:00:00", 6, 7], ["2026-10-08T16:00:00", 7, 8]);
    const after = classResults(before, fixed, classes, wib("2026-10-08T16:01:00"), wib("2026-10-08T16:01:00"));
    expect(after[thu.id]).toMatchObject({ result: "counted", at: wib("2026-10-08T16:00:00"), wasAt: first });
  });

  it("a result needs the Student until the count moves or two days pass", () => {
    const first = wib("2026-10-08T13:05:00");
    const counts = log(["2026-10-07T10:00:00", 6, 7]);
    const result = classResults({}, counts, classes, first, first)[thu.id];
    expect(resultNeedsStudent(result, counts, first)).toBe(true);
    expect(resultNeedsStudent(result, counts, first + 3 * DAY)).toBe(false);
    expect(resultNeedsStudent(result, log(["2026-10-07T10:00:00", 6, 7], ["2026-10-08T15:00:00", 6, 8]), first + HOUR)).toBe(false);
  });

  it("results older than 14 days go", () => {
    const at = wib("2026-10-08T10:31:00");
    const results = classResults({}, log(["2026-10-07T10:00:00", 6, 7], ["2026-10-08T10:30:00", 7, 8]), classes, at, at);
    expect(classResults(results, {}, classes, at + 15 * DAY, at + 15 * DAY)).toEqual({});
  });

  it("the count's history keeps the changes only, the last 30 per course", () => {
    const course = (attended: number, held: number) => [{ code: "PL3002", attendance: { attended, held } }];
    const first = appendCount({}, course(6, 7), 1);
    expect(appendCount(first, course(6, 7), 2)).toBe(first);
    let log: CountLog = first;
    for (let i = 0; i < 40; i++) log = appendCount(log, course(7 + i, 8 + i), 10 + i);
    expect(log.PL3002).toHaveLength(30);
    expect(log.PL3002.at(-1)).toEqual({ at: 49, attended: 46, held: 47 });
  });
});
