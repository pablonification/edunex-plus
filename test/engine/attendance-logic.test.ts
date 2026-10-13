// v2-16 (#85): the attendance guard's reasoning, on its own: where a course's
// attendance counts, what SIX's exact count leaves before the target, meetings
// left to ITB's last lecture day, and the action each Edunex Presence window
// counts.
import { describe, expect, it } from "vitest";
import {
  type AttendanceInput,
  afterClass,
  attendanceHealth,
  countedIn,
  lecturePeriod,
  meetingsLeft,
  percent,
  presenceAction,
  presenceOptional,
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
