// Jadwal (#77): SIX's timetable laid out by week and month, with what the
// approved prototype marks on it: a class moved off its usual slot (time,
// day or room) and an extra meeting on top of it, classes that overlap (SIX
// accepts a KRS whose classes clash and never says so), exam sessions,
// meetings announced only in EduNex text, Task deadlines and ITB's calendar.
// Pure: the Jadwal screen, Beranda, the calendar export and the alert
// detectors all reason with this. Days are WIB days, ITB's own, so a class
// lands on the same day on any computer.
import { isExamActivity, usualSlots } from "./attendance";
import { announcedMeetings, courseMeetings, wibDay } from "./course-meetings";
import { SIX_WEB } from "./links";
import type { Announcement, CalendarEvent, ClassSession, Material, PresenceSession, SixStudent, Task } from "./models";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;

/** SIX's month timetable page, where the Student checks a meeting. */
export const sixTimetableUrl = (student: Pick<SixStudent, "nim" | "term" | "studentId">) =>
  `${SIX_WEB}/app/mahasiswa:${student.nim}+${student.term}/kelas/jadwal/mahasiswa/${student.studentId}`;

// ---------------------------------------------------------------- days, weeks, months

/** The start of a WIB day ("2026-10-08") in ms. */
export const dayStart = (day: string) => Date.parse(`${day}T00:00:00+07:00`);
const addDays = (day: string, n: number) => wibDay(dayStart(day) + n * DAY + 12 * HOUR);
/** 0 Monday … 6 Sunday. */
const mondayIndex = (day: string) => (new Date(dayStart(day) + WIB).getUTCDay() + 6) % 7;

/** The Monday of the week holding that day. */
export const weekStart = (day: string) => addDays(day, -mondayIndex(day));

/** The seven days (Monday first) of the week `offset` weeks from the one holding `now`. */
export function weekDays(now: number, offset = 0): string[] {
  const monday = addDays(weekStart(wibDay(now)), offset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export interface MonthGrid {
  /** "2026-10". */
  month: string;
  /** Monday-first weeks covering the month; days of the months around it included. */
  weeks: string[][];
}

/** The month `offset` months from the one holding `now`, as a Monday-first grid. */
export function monthGrid(now: number, offset = 0): MonthGrid {
  const [year, month] = wibDay(now).slice(0, 7).split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const key = first.toISOString().slice(0, 7);
  const weeks: string[][] = [];
  for (let monday = weekStart(`${key}-01`); monday.slice(0, 7) <= key; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return { month: key, weeks };
}

/** Whole weeks between the week holding `now` and the one holding `day`. */
export const weekOffset = (now: number, day: string) => Math.round((dayStart(weekStart(day)) - dayStart(weekStart(wibDay(now)))) / (7 * DAY));

// ---------------------------------------------------------------- moved classes and extra meetings

/** A slot as the Student reads it: weekday (0 Monday), minutes after midnight WIB, room. */
export interface UsualSlot {
  weekday: number;
  start: number;
  end: number;
  room: string | null;
}

export type MoveKind = "time" | "day" | "room";

export interface Moved {
  kinds: MoveKind[];
  usual: UsualSlot;
}

export interface SlotMarks {
  /** Meetings that replace the week's meeting at the course's usual slot, off it (or at it, in another room). By SIX meeting id. */
  moved: Map<string, Moved>;
  /** Meetings on top of the week's usual ones. By SIX meeting id. */
  extra: Set<string>;
}

/** usualSlots' slots: weekday from Sunday, minutes after midnight WIB, length in ms. */
type Slot = ReturnType<typeof usualSlots>[number];

const minutesOf = (ms: number) => Math.round(((ms + WIB) % DAY) / MINUTE);
const sundayIndex = (ms: number) => new Date(ms + WIB).getUTCDay();
const sameSlot = (s: ClassSession, slot: Slot) => sundayIndex(s.start) === slot.weekday && minutesOf(s.start) === slot.start && s.end - s.start === slot.length;

/** The most common room among sessions; null when there's no clear one. */
function usualRoom(sessions: readonly ClassSession[]): string | null {
  const counts = new Map<string, number>();
  for (const s of sessions) if (s.room) counts.set(s.room, (counts.get(s.room) ?? 0) + 1);
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 2 ? best[0] : null;
}

const groupBy = <T>(items: readonly T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
};

/** Beranda asks about each class in turn: the marks are worked out once per timetable. */
const marksOf = new WeakMap<readonly ClassSession[], SlotMarks>();

/**
 * How SIX's regular meetings sit against their course's usual weekly
 * slot(s), which SIX never marks. A slot is usual once the course met in it
 * at least twice; one meeting is no pattern. A meeting off the usual slot is
 * a move only when it stands in for the week's meeting at a usual slot that
 * didn't happen (another time that day first, then another weekday); with
 * the week's usual meetings all held, it's an extra meeting. An exam holds
 * its day's slot. A meeting at its usual slot in another room than the course
 * usually meets in moved room.
 */
export function slotMarks(schedule: readonly ClassSession[]): SlotMarks {
  const known = marksOf.get(schedule);
  if (known) return known;
  const marks: SlotMarks = { moved: new Map(), extra: new Set() };
  for (const sessions of groupBy(schedule, (s) => s.courseCode).values()) {
    const regular = sessions.filter((s) => !isExamActivity(s.activity));
    const slots = usualSlots(regular).filter((slot) => regular.filter((s) => sameSlot(s, slot)).length >= 2);
    if (!slots.length) continue;
    const room = usualRoom(regular);
    const usual = (slot: Slot): UsualSlot => ({ weekday: (slot.weekday + 6) % 7, start: slot.start, end: slot.start + slot.length / MINUTE, room });
    const otherRoom = (s: ClassSession) => room !== null && s.room !== null && s.room !== room;
    for (const week of groupBy(sessions, (s) => weekStart(wibDay(s.start))).values()) {
      const held = (slot: Slot) => week.some((s) => (isExamActivity(s.activity) ? sundayIndex(s.start) === slot.weekday : sameSlot(s, slot)));
      const free = slots.filter((slot) => !held(slot));
      const off: ClassSession[] = [];
      for (const s of week.filter((x) => !isExamActivity(x.activity)).sort((a, b) => a.start - b.start)) {
        const at = slots.find((slot) => sameSlot(s, slot));
        if (!at) off.push(s);
        else if (otherRoom(s)) marks.moved.set(s.id, { kinds: ["room"], usual: usual(at) });
      }
      const standIn = (s: ClassSession, slot: Slot, kind: "time" | "day") => {
        free.splice(free.indexOf(slot), 1);
        marks.moved.set(s.id, { kinds: otherRoom(s) ? [kind, "room"] : [kind], usual: usual(slot) });
      };
      // Another time on a usual day first, so another weekday never takes that day's slot from it.
      const elsewhere = off.filter((s) => {
        const slot = free.find((x) => x.weekday === sundayIndex(s.start));
        if (slot) standIn(s, slot, "time");
        return !slot;
      });
      // Then another weekday, standing in for the nearest usual meeting that didn't happen.
      for (const s of elsewhere) {
        const distance = (slot: Slot) => Math.abs(usual(slot).weekday - mondayIndex(wibDay(s.start)));
        const [nearest] = [...free].sort((a, b) => distance(a) - distance(b));
        if (nearest) standIn(s, nearest, "day");
        else marks.extra.add(s.id);
      }
    }
  }
  marksOf.set(schedule, marks);
  return marks;
}

/** "08:00" for minutes after midnight. */
export const clockOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// ---------------------------------------------------------------- overlaps

export interface Overlap {
  a: ClassSession;
  b: ClassSession;
  /** The overlapping part (ms). */
  from: number;
  to: number;
}

/** Sessions of different courses whose times overlap, earliest first. */
export function overlaps(schedule: readonly ClassSession[]): Overlap[] {
  const sorted = [...schedule].sort((x, y) => x.start - y.start || x.courseCode.localeCompare(y.courseCode));
  const found: Overlap[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j++) {
      const [a, b] = [sorted[i], sorted[j]];
      if (a.courseCode === b.courseCode) continue;
      found.push({ a, b, from: b.start, to: Math.min(a.end, b.end) });
    }
  }
  return found;
}

/** The pair's key, the same whichever comes first. */
export const pairKey = (o: Overlap) => [o.a.courseCode, o.b.courseCode].sort().join("+");

/**
 * The schedule's reminders, by alert id: an overlap each week it happens and
 * an exam the evening before. They tell of what SIX already listed, so
 * Beranda's "what changed" leaves them out.
 */
export const REMINDER_ALERTS = { overlap: "schedule.overlap:", examTomorrow: "exam.tomorrow:" } as const;
export const isScheduleReminder = (alertId: string) => Object.values(REMINDER_ALERTS).some((prefix) => alertId.startsWith(prefix));

// ---------------------------------------------------------------- meetings outside SIX

export interface OutsideMeeting {
  code: string;
  /** "Pertemuan 03" → 3. */
  number: number;
  start: number;
  end: number;
  online: boolean;
  link: string | null;
}

/**
 * Meetings a lecturer announced only in EduNex text ("Pertemuan 03: Jumat,
 * 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB") in a month whose own SIX
 * timetable page was read (`months`, "2026-10"), on a day SIX doesn't list
 * for that course. Nothing while SIX's timetable isn't known.
 */
export function meetingsOutsideSix(
  codes: readonly string[],
  schedule: readonly ClassSession[] | undefined,
  months: readonly string[] | undefined,
  edunex: { materials?: Record<string, readonly Material[]>; announcements?: Record<string, readonly Announcement[]>; presence?: Record<string, readonly PresenceSession[]> },
): OutsideMeeting[] {
  if (!schedule || !months?.length) return [];
  const out: OutsideMeeting[] = [];
  for (const code of codes) {
    const announced = announcedMeetings(edunex.materials?.[code] ?? [], edunex.announcements?.[code] ?? []);
    if (!announced.length) continue;
    for (const meeting of courseMeetings(code, edunex.presence?.[code] ?? [], schedule, announced, months)) {
      if (!meeting.notInSix || !meeting.announced) continue;
      const { number, start, end, online, link } = meeting.announced;
      out.push({ code, number, start, end, online, link });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- days of the schedule

/** ITB calendar events worth marking on a schedule. */
export const SCHEDULE_EVENT_KINDS: ReadonlySet<CalendarEvent["kind"]> = new Set(["uts", "uas", "holiday", "lecture-start", "lecture-end"]);

export interface ScheduledClass {
  session: ClassSession;
  exam: boolean;
  moved: Moved | null;
  /** On top of the week's usual meeting(s): an extra meeting, not a move. */
  extra: boolean;
  /** Other courses it overlaps that day, with the overlapping part. */
  overlaps: { code: string; from: number; to: number }[];
}

export interface ScheduleDay {
  day: string;
  classes: ScheduledClass[];
  outside: OutsideMeeting[];
  /** Tasks due that day, by deadline. */
  due: Task[];
  /** ITB calendar events covering that day. */
  events: CalendarEvent[];
  /** A holiday on ITB's calendar. */
  holiday: CalendarEvent | null;
}

export interface ScheduleInput {
  schedule: readonly ClassSession[];
  outside: readonly OutsideMeeting[];
  tasks: readonly Task[];
  events: readonly CalendarEvent[];
}

/** What each day holds. `tasks` are the ones to show (the caller picks open ones). */
export function scheduleDays(days: readonly string[], input: ScheduleInput): ScheduleDay[] {
  const { moved, extra } = slotMarks(input.schedule);
  const clashes = overlaps(input.schedule);
  const events = input.events.filter((e) => SCHEDULE_EVENT_KINDS.has(e.kind));
  return days.map((day) => {
    const classes = input.schedule
      .filter((s) => wibDay(s.start) === day)
      .sort((a, b) => a.start - b.start || a.courseCode.localeCompare(b.courseCode))
      .map((session) => ({
        session,
        exam: isExamActivity(session.activity),
        moved: moved.get(session.id) ?? null,
        extra: extra.has(session.id),
        overlaps: clashes
          .filter((o) => o.a.id === session.id || o.b.id === session.id)
          .map((o) => ({ code: o.a.id === session.id ? o.b.courseCode : o.a.courseCode, from: o.from, to: o.to })),
      }));
    const covering = events.filter((e) => e.firstDay <= day && day <= e.lastDay);
    return {
      day,
      classes,
      outside: input.outside.filter((m) => wibDay(m.start) === day),
      due: input.tasks.filter((t) => t.dueAt !== null && wibDay(t.dueAt) === day).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)),
      events: covering,
      holiday: covering.find((e) => e.kind === "holiday") ?? null,
    };
  });
}

/** A day with nothing on it. */
export const isEmptyDay = (day: ScheduleDay) => !day.classes.length && !day.outside.length && !day.due.length;

// ---------------------------------------------------------------- what changed (alerts)

export interface SessionChange {
  before: ClassSession;
  after: ClassSession;
  kinds: ("time" | "room")[];
}

/** SIX meetings (by id) whose time or room changed between two reads of the timetable. */
export function sessionChanges(previous: readonly ClassSession[], next: readonly ClassSession[]): SessionChange[] {
  const before = new Map(previous.map((s) => [s.id, s]));
  const changes: SessionChange[] = [];
  for (const after of next) {
    const old = before.get(after.id);
    if (!old) continue;
    const kinds: SessionChange["kinds"] = [];
    if (old.start !== after.start || old.end !== after.end) kinds.push("time");
    if ((old.room ?? "") !== (after.room ?? "") && after.room) kinds.push("room");
    if (kinds.length) changes.push({ before: old, after, kinds });
  }
  return changes;
}
