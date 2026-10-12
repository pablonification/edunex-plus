// v2-09 (#77): Jadwal's logic. Weeks and months in WIB, a class moved off its
// usual slot, overlapping classes, meetings announced only in Edunex text,
// Task deadlines and ITB's calendar on the right days, and what changed
// between two reads of SIX's timetable.
import { describe, expect, it } from "vitest";
import type { Announcement, CalendarEvent, ClassSession, Material, PresenceSession, Task } from "../../src/core/models";
import {
  edunexMeetings,
  isEmptyDay,
  meetingsOutsideSix,
  monthGrid,
  overlaps,
  pairKey,
  scheduleDays,
  sessionChanges,
  sideBySide,
  slotMarks,
  taskWindows,
  termWeek,
  timeAxis,
  weekDays,
  weekOffset,
} from "../../src/core/schedule";
import { aTask } from "../kit/tasks";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

let next = 1;
function session(code: string, startIso: string, minutes: number, patch: Partial<ClassSession> = {}): ClassSession {
  const start = wib(startIso);
  return { id: String(next++), courseCode: code, courseName: code, start, end: start + minutes * 60_000, activity: "Kuliah", room: "9134", ...patch };
}
function weekly(code: string, firstIso: string, weeks: number, minutes = 90, patch: Partial<ClassSession> = {}): ClassSession[] {
  return Array.from({ length: weeks }, (_, i) => {
    const s = session(code, firstIso, minutes, patch);
    return { ...s, start: s.start + i * 7 * DAY, end: s.end + i * 7 * DAY };
  });
}
const event = (kind: CalendarEvent["kind"], title: string, firstDay: string, lastDay: string): CalendarEvent => ({
  id: `${kind}-${firstDay}`,
  title,
  kind,
  term: "2026-1",
  start: wib(`${firstDay}T00:00:00`),
  end: wib(`${lastDay}T00:00:00`) + DAY,
  allDay: true,
  firstDay,
  lastDay,
});
const empty = { schedule: [], outside: [], tasks: [], events: [] };

describe("weeks and months", () => {
  it("a week runs Monday to Sunday in WIB, across a month boundary", () => {
    expect(weekDays(wib("2026-10-08T08:12:00"))).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    // Sunday late evening still belongs to its week; the next one starts Monday.
    expect(weekDays(wib("2026-10-11T23:30:00"))[0]).toBe("2026-10-05");
    expect(weekDays(wib("2026-10-08T08:00:00"), 4)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(weekDays(wib("2026-10-29T08:00:00"))).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("a month is whole Monday-first weeks, and the next month and year follow", () => {
    const october = monthGrid(wib("2026-10-08T08:00:00"));
    expect(october.month).toBe("2026-10");
    expect(october.weeks).toHaveLength(5);
    expect(october.weeks[0][0]).toBe("2026-09-28");
    expect(october.weeks.at(-1)!.at(-1)).toBe("2026-11-01");
    expect(monthGrid(wib("2026-10-08T08:00:00"), 3).month).toBe("2027-01");
    expect(monthGrid(wib("2026-10-08T08:00:00"), -10).month).toBe("2025-12");
  });

  it("a day in another week is found from today", () => {
    expect(weekOffset(wib("2026-10-08T08:00:00"), "2026-10-26")).toBe(3);
    expect(weekOffset(wib("2026-10-08T08:00:00"), "2026-10-05")).toBe(0);
    expect(weekOffset(wib("2026-10-08T08:00:00"), "2026-09-30")).toBe(-1);
  });
});

describe("a day of the schedule", () => {
  it("busy day: classes in time order with rooms, a deadline and the overlap marked on both", () => {
    const schedule = [
      session("PL3032", "2026-10-08T15:00:00", 90, { room: "R.SG PWK LT.6" }),
      session("PL3002", "2026-10-08T08:00:00", 90),
      session("KU5014", "2026-10-08T16:00:00", 110),
      session("DK4073", "2026-10-08T11:00:00", 119, { room: "TVST C" }),
    ];
    const due = (id: number, iso: string) => aTask({ id, courseCode: "PL3002", courseId: 95001, title: `Tugas ${id}`, status: "not_started", dueAt: wib(iso) });
    const tasks: Task[] = [due(1, "2026-10-08T23:59:00"), due(2, "2026-10-09T00:00:00")];
    const [day] = scheduleDays(["2026-10-08"], { ...empty, schedule, tasks });
    expect(day.classes.map((c) => [c.session.courseCode, c.session.room])).toEqual([
      ["PL3002", "9134"],
      ["DK4073", "TVST C"],
      ["PL3032", "R.SG PWK LT.6"],
      ["KU5014", "9134"],
    ]);
    expect(day.classes[2].overlaps).toEqual([{ code: "KU5014", from: wib("2026-10-08T16:00:00"), to: wib("2026-10-08T16:30:00") }]);
    expect(day.classes[3].overlaps).toEqual([{ code: "PL3032", from: wib("2026-10-08T16:00:00"), to: wib("2026-10-08T16:30:00") }]);
    expect(day.classes[0].overlaps).toEqual([]);
    expect(day.due.map((t) => t.id)).toEqual([1]);
    expect(isEmptyDay(day)).toBe(false);
  });

  it("empty day: nothing on it", () => {
    const [day] = scheduleDays(["2026-10-07"], { ...empty, schedule: [session("PL3002", "2026-10-08T08:00:00", 90)] });
    expect(isEmptyDay(day)).toBe(true);
    expect(day.holiday).toBeNull();
  });

  it("holiday: ITB's holiday covers each of its days; UTS week and the last lecture day show too", () => {
    const events = [
      event("holiday", "Libur Kuliah dalam rangka Hari Raya Natal", "2026-12-24", "2026-12-25"),
      event("uts", "Masa Ujian Tengah Semester I-2026/2027", "2026-10-12", "2026-10-16"),
      event("lecture-end", "Hari Terakhir Masa Kuliah Semester I-2026/2027", "2026-12-04", "2026-12-04"),
      event("ukt-deadline", "Batas Waktu Pembayaran", "2026-12-24", "2026-12-24"),
    ];
    const days = scheduleDays(["2026-12-23", "2026-12-24", "2026-12-25", "2026-10-14", "2026-12-04"], { ...empty, events });
    expect(days.map((d) => d.holiday?.title ?? null)).toEqual([
      null,
      "Libur Kuliah dalam rangka Hari Raya Natal",
      "Libur Kuliah dalam rangka Hari Raya Natal",
      null,
      null,
    ]);
    expect(days[1].events.map((e) => e.kind)).toEqual(["holiday"]);
    expect(days[3].events.map((e) => e.kind)).toEqual(["uts"]);
    expect(days[4].events.map((e) => e.kind)).toEqual(["lecture-end"]);
  });

  it("month change: a week across October and November takes each class from its own month", () => {
    const schedule = [session("PL3002", "2026-10-29T08:00:00", 90), session("PL3002", "2026-11-05T08:00:00", 90), session("II4091", "2026-11-01T09:00:00", 60)];
    const days = scheduleDays(weekDays(wib("2026-10-29T07:00:00")), { ...empty, schedule });
    expect(days.map((d) => d.classes.length)).toEqual([0, 0, 0, 1, 0, 0, 1]);
    expect(days[6].day).toBe("2026-11-01");
  });

  it("an exam session is marked, and never counted as moved", () => {
    const schedule = [
      ...weekly("DK4073", "2026-10-01T11:00:00", 2, 119),
      session("DK4073", "2026-10-15T11:00:00", 119, { activity: "UTS" }),
      session("DK4073", "2026-10-22T08:00:00", 60, { activity: "UTS" }),
    ];
    const days = scheduleDays(["2026-10-15", "2026-10-22"], { ...empty, schedule });
    expect(days.map((d) => d.classes.map((c) => [c.exam, c.moved]))).toEqual([[[true, null]], [[true, null]]]);
  });
});

describe("a class moved off its usual slot, or an extra meeting", () => {
  it("another time on the usual day, with the usual time named", () => {
    const usual = weekly("PL3002", "2026-10-01T08:00:00", 4, 90, { room: "R.SG PWK LT.6" });
    const longer = session("PL3002", "2026-10-29T08:00:00", 120, { room: "R.SG PWK LT.6" });
    const { moved, extra } = slotMarks([...usual, longer]);
    expect([...moved.keys()]).toEqual([longer.id]);
    expect(moved.get(longer.id)).toEqual({ kinds: ["time"], usual: { weekday: 3, start: 480, end: 570, room: "R.SG PWK LT.6" } });
    expect(extra.size).toBe(0);
  });

  it("another room at the usual time, and another day standing in for the week's usual meeting", () => {
    const usual = weekly("KU5014", "2026-10-01T16:00:00", 3, 110, { room: "9134" });
    const room = session("KU5014", "2026-10-22T16:00:00", 110, { room: "9009" });
    // No Thursday meeting that week: Friday's replaces it.
    const day = session("KU5014", "2026-10-30T13:00:00", 110, { room: "9134" });
    const { moved, extra } = slotMarks([...usual, room, day]);
    expect(moved.get(room.id)?.kinds).toEqual(["room"]);
    expect(moved.get(day.id)).toMatchObject({ kinds: ["day"], usual: { weekday: 3, start: 960 } });
    expect(moved.size).toBe(2);
    expect(extra.size).toBe(0);
  });

  it("a meeting on top of the week's usual one is an extra meeting, not a move: on another day or the same day", () => {
    const usual = weekly("PL3002", "2026-10-01T08:00:00", 4, 90, { room: "R.SG PWK LT.6" });
    const friday = session("PL3002", "2026-10-09T13:00:00", 90, { room: "9009" });
    const afternoon = session("PL3002", "2026-10-15T13:00:00", 90, { room: "R.SG PWK LT.6" });
    const { moved, extra } = slotMarks([...usual, friday, afternoon]);
    expect(moved.size).toBe(0);
    expect([...extra]).toEqual([friday.id, afternoon.id]);
    const [day] = scheduleDays(["2026-10-09"], { ...empty, schedule: [...usual, friday, afternoon] });
    expect(day.classes.map((c) => [c.extra, c.moved])).toEqual([[true, null]]);
  });

  it("an exam takes its slot: a lecture moved to another day that week is extra", () => {
    const usual = weekly("DK4073", "2026-10-01T11:00:00", 2, 119);
    const uts = session("DK4073", "2026-10-15T11:00:00", 119, { activity: "UTS" });
    const friday = session("DK4073", "2026-10-16T11:00:00", 119);
    const { moved, extra } = slotMarks([...usual, uts, friday]);
    expect(moved.size).toBe(0);
    expect([...extra]).toEqual([friday.id]);
  });

  it("one meeting is no pattern: two meetings at different times are neither moves nor extra", () => {
    const { moved, extra } = slotMarks([
      session("II4091", "2026-10-16T15:00:00", 480, { room: null }),
      session("II4091", "2026-10-30T15:00:00", 539, { room: null }),
    ]);
    expect([moved.size, extra.size]).toEqual([0, 0]);
  });
});

describe("overlaps", () => {
  it("pairs of different courses whose times overlap, with the shared part; touching isn't overlapping", () => {
    const a = session("PL3032", "2026-10-08T15:00:00", 90);
    const b = session("KU5014", "2026-10-08T16:00:00", 110);
    const c = session("DK4073", "2026-10-08T17:50:00", 60);
    const same = session("PL3032", "2026-10-08T15:30:00", 30);
    const found = overlaps([c, b, a, same]);
    expect(found.map((o) => [pairKey(o), o.to - o.from])).toEqual([["KU5014+PL3032", 30 * 60_000]]);
  });
});

describe("meetings announced only in Edunex text", () => {
  const announcement = (text: string): Announcement => ({ id: 1, courseId: 95326, text, author: null, postedAt: wib("2026-10-01T10:00:00") });
  const schedule = [session("II4091", "2026-10-16T15:00:00", 480), session("II4091", "2026-10-30T15:00:00", 539)];
  const months = ["2026-10", "2026-11"];

  it("a meeting on a day SIX doesn't list for that course", () => {
    const announcements = { II4091: [announcement("Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB (Online - Link meeting teams)")] };
    expect(meetingsOutsideSix(["II4091"], schedule, months, { announcements })).toEqual([
      { code: "II4091", number: 3, start: wib("2026-10-09T15:00:00"), end: wib("2026-10-09T17:00:00"), online: true, link: null },
    ]);
  });

  it("not when SIX lists it, nor while SIX's timetable isn't known or its month wasn't read", () => {
    const listed = { II4091: [announcement("Pertemuan 04: Jumat, 16 Oktober 2026 Pkl. 15:00 - 17:00 WIB")] };
    expect(meetingsOutsideSix(["II4091"], schedule, months, { announcements: listed })).toEqual([]);
    const later = { II4091: [announcement("Pertemuan 09: Jumat, 11 Desember 2026 Pkl. 15:00 - 17:00 WIB")] };
    expect(meetingsOutsideSix(["II4091"], schedule, months, { announcements: later })).toEqual([]);
    expect(meetingsOutsideSix(["II4091"], undefined, months, { announcements: listed })).toEqual([]);
    expect(meetingsOutsideSix(["II4091"], schedule, undefined, { announcements: listed })).toEqual([]);
  });

  it("a month counts as read only from its own page: a class on the edge of November's grid doesn't make December read", () => {
    // November's page also shows 1–4 December, so SIX's timetable holds a class on 4 December.
    const withEdge = [...schedule, session("II4091", "2026-12-04T15:00:00", 120)];
    const announcements = {
      II4091: [announcement("Pertemuan 09: Jumat, 11 Desember 2026 Pkl. 15:00 - 17:00 WIB\nPertemuan 07: Jumat, 13 November 2026 Pkl. 15:00 - 17:00 WIB")],
    };
    expect(meetingsOutsideSix(["II4091"], withEdge, months, { announcements }).map((m) => m.number)).toEqual([7]);
    // Once December's own page is read, December's meeting is missing from it.
    expect(meetingsOutsideSix(["II4091"], withEdge, [...months, "2026-12"], { announcements }).map((m) => m.number)).toEqual([7, 9]);
  });
});

describe("what changed between two reads of SIX's timetable", () => {
  it("names the meetings whose time or room changed", () => {
    const before = [
      session("PL3002", "2026-10-15T08:00:00", 90, { id: "a" }),
      session("DK4073", "2026-10-15T11:00:00", 119, { id: "b" }),
      session("KU5014", "2026-10-15T16:00:00", 110, { id: "c" }),
    ];
    const after = [
      { ...before[0], end: before[0].end + 30 * 60_000 },
      { ...before[1], room: "TVST A" },
      before[2],
      session("II4091", "2026-10-16T15:00:00", 60, { id: "d" }),
    ];
    expect(sessionChanges(before, after).map((c) => [c.after.id, c.kinds])).toEqual([
      ["a", ["time"]],
      ["b", ["room"]],
    ]);
  });
});

describe("the term's week", () => {
  const calendar = [
    event("lecture-start", "Hari Pertama Masa Kuliah Semester I-2026/2027", "2026-08-24", "2026-08-24"),
    event("uts", "Masa Ujian Tengah Semester I-2026/2027", "2026-10-12", "2026-10-16"),
    event("lecture-end", "Hari Terakhir Masa Kuliah Semester I-2026/2027", "2026-12-04", "2026-12-04"),
    event("uas", "Ujian Akhir Semester I-2026/2027", "2026-12-07", "2026-12-22"),
  ];

  it("counts weeks from the first lecture day's week, through the UAS", () => {
    expect(termWeek(calendar, "2026-08-24")).toBe(1);
    expect(termWeek(calendar, "2026-08-30")).toBe(1);
    expect(termWeek(calendar, "2026-10-05")).toBe(7);
    expect(termWeek(calendar, "2026-10-15")).toBe(8);
    expect(termWeek(calendar, "2026-12-21")).toBe(18);
  });

  it("says nothing before the term, after its UAS, or without ITB's calendar", () => {
    expect(termWeek(calendar, "2026-08-20")).toBeNull();
    expect(termWeek(calendar, "2026-12-28")).toBeNull();
    expect(termWeek([], "2026-10-05")).toBeNull();
  });
});

describe("the week as a time grid", () => {
  it("shows 07:00–18:00, widened to whole hours around what falls outside", () => {
    expect(timeAxis([])).toEqual({ from: 420, to: 1080 });
    expect(timeAxis([session("PL3002", "2026-10-08T08:00:00", 120), session("KU5014", "2026-10-08T16:00:00", 110)])).toEqual({ from: 420, to: 1080 });
    expect(timeAxis([session("X", "2026-10-08T06:30:00", 60), session("Y", "2026-10-08T19:00:00", 90)])).toEqual({ from: 360, to: 21 * 60 });
    // Never past midnight.
    expect(timeAxis([session("Z", "2026-10-08T22:00:00", 240)]).to).toBe(1440);
  });

  it("puts classes that share time side by side, and the rest full width", () => {
    const pl3032 = session("PL3032", "2026-10-08T15:00:00", 90);
    const ku5014 = session("KU5014", "2026-10-08T16:00:00", 110);
    const pl3002 = session("PL3002", "2026-10-08T08:00:00", 120);
    // Starts as KU5014 ends: touching isn't sharing time.
    const after = session("DK4073", "2026-10-08T17:50:00", 60);
    const placed = sideBySide([ku5014, after, pl3002, pl3032]);
    const where = (s: ClassSession) => [placed.find((p) => p.item === s)!.column, placed.find((p) => p.item === s)!.columns];
    expect(where(pl3002)).toEqual([0, 1]);
    expect(where(pl3032)).toEqual([0, 2]);
    expect(where(ku5014)).toEqual([1, 2]);
    expect(where(after)).toEqual([0, 1]);
  });

  it("a class overlapping only the second of a pair joins their columns, in the first one free", () => {
    const a = session("A", "2026-10-08T15:00:00", 90);
    const b = session("B", "2026-10-08T16:00:00", 110);
    const c = session("C", "2026-10-08T16:45:00", 45);
    const placed = sideBySide([a, b, c]);
    expect(placed.map((p) => [p.item.courseCode, p.column, p.columns])).toEqual([
      ["A", 0, 2],
      ["B", 1, 2],
      ["C", 0, 2],
    ]);
  });
});

describe("Presence by handing in a Task", () => {
  const window = (id: number, openIso: string, closeIso: string, taskId: string): PresenceSession => ({
    id,
    courseId: 95326,
    classId: 87103,
    start: wib(openIso),
    end: wib(closeIso),
    opensAt: wib(openIso),
    closesAt: wib(closeIso),
    topic: "Tugas",
    note: `Presensi dengan submit Tugas ${taskId}`,
    countsBy: [{ kind: "assignment", id: taskId }],
    url: null,
    recorded: null,
  });
  const viewCourse: PresenceSession = { ...window(9, "2026-10-08T08:00:00", "2026-10-08T09:30:00", "x"), courseId: 95001, countsBy: [] };
  const tugas02 = aTask({
    id: 117003,
    courseCode: "II4091",
    courseId: 95326,
    title: "Tugas 02 Bab II",
    status: "not_started",
    dueAt: wib("2026-10-16T23:59:00"),
  });
  // SIX lists the window as a roomless meeting 15:00–23:00.
  const six = session("II4091", "2026-10-16T15:00:00", 480, { room: null });

  it("joins the window to SIX's meeting that day and to its Task", () => {
    const found = taskWindows({ II4091: [window(1, "2026-10-16T15:00:00", "2026-10-16T23:59:00", "117003")], PL3002: [viewCourse] }, [six], [tugas02]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "II4091", task: { id: 117003 }, six: { id: six.id } });
  });

  it("on the day: a time to hand in, not a place to be; its Task's deadline isn't said twice", () => {
    const windows = taskWindows({ II4091: [window(1, "2026-10-16T15:00:00", "2026-10-16T23:59:00", "117003")] }, [six], [tugas02]);
    const [day] = scheduleDays(["2026-10-16"], { ...empty, schedule: [six], tasks: [tugas02], windows });
    expect(day.classes).toEqual([]);
    expect(day.windows.map((w) => w.task?.title)).toEqual(["Tugas 02 Bab II"]);
    expect(day.due).toEqual([]);
    expect(isEmptyDay(day)).toBe(false);
  });

  it("a meeting with a room stays on the grid, with its window beside it", () => {
    const inRoom = session("II4091", "2026-10-16T15:00:00", 120, { room: "7602" });
    const windows = taskWindows({ II4091: [window(1, "2026-10-16T15:00:00", "2026-10-16T23:59:00", "117003")] }, [inRoom], []);
    const [day] = scheduleDays(["2026-10-16"], { ...empty, schedule: [inRoom], windows });
    expect(day.classes.map((c) => c.session.id)).toEqual([inRoom.id]);
    expect(day.windows[0].task).toBeNull();
  });
});

describe("lectures in an exam week or on a holiday", () => {
  it("are marked uncertain; exam sessions aren't", () => {
    const events = [event("uts", "Masa Ujian Tengah Semester I-2026/2027", "2026-10-12", "2026-10-16")];
    const schedule = [
      session("PL3002", "2026-10-15T08:00:00", 90),
      session("DK4073", "2026-10-15T11:00:00", 119, { activity: "UTS" }),
      session("PL3002", "2026-10-22T08:00:00", 90),
    ];
    const days = scheduleDays(["2026-10-15", "2026-10-22"], { ...empty, schedule, events });
    expect(days[0].classes.map((c) => [c.session.courseCode, c.uncertain?.kind ?? null])).toEqual([
      ["PL3002", "uts"],
      ["DK4073", null],
    ]);
    expect(days[1].classes[0].uncertain).toBeNull();
  });
});

describe("what Edunex knows without SIX", () => {
  it("its Presence windows and announced meetings, one per day, without Task windows", () => {
    const presence: Record<string, PresenceSession[]> = {
      PL3002: [
        {
          id: 1,
          courseId: 95001,
          classId: 86778,
          start: wib("2026-10-08T08:00:00"),
          end: wib("2026-10-08T09:30:00"),
          opensAt: wib("2026-10-08T08:00:00"),
          closesAt: wib("2026-10-08T09:30:00"),
          topic: null,
          note: null,
          countsBy: [],
          url: null,
          recorded: null,
        },
      ],
      II4091: [
        {
          id: 2,
          courseId: 95326,
          classId: 87103,
          start: wib("2026-10-16T15:00:00"),
          end: wib("2026-10-16T23:59:00"),
          opensAt: wib("2026-10-16T15:00:00"),
          closesAt: wib("2026-10-16T23:59:00"),
          topic: "Tugas",
          note: null,
          countsBy: [{ kind: "assignment", id: "117003" }],
          url: null,
          recorded: null,
        },
      ],
    };
    const announcements = {
      II4091: [
        {
          id: 1,
          courseId: 95326,
          text: "Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB (Online - Link meeting teams)",
          author: null,
          postedAt: wib("2026-10-01T10:00:00"),
        },
      ],
    };
    const link: Material = {
      id: 7,
      courseId: 95326,
      moduleId: null,
      title: "Link Teams Pertemuan 03",
      type: "ms-teams",
      content: "https://teams.microsoft.com/meet/1",
      sizeBytes: null,
      postedAt: null,
      updatedAt: null,
    };
    expect(edunexMeetings(["PL3002", "II4091"], { presence, announcements, materials: { II4091: [link] } })).toEqual([
      { code: "PL3002", start: wib("2026-10-08T08:00:00"), end: wib("2026-10-08T09:30:00"), number: null, online: false, link: null },
      {
        code: "II4091",
        start: wib("2026-10-09T15:00:00"),
        end: wib("2026-10-09T17:00:00"),
        number: 3,
        online: true,
        link: "https://teams.microsoft.com/meet/1",
      },
    ]);
  });
});
