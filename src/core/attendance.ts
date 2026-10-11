// Attendance guard (#85): where each course's attendance counts, what SIX's
// exact count leaves the Student before their target, and, for each EduNex
// Presence window, the one action that counts there. Pure: the Presensi
// screen, the course page and the alert detectors all reason with this.
//
// Nothing here ever calls a meeting an absence on EduNex's word: SIX's count
// ("Hadir X dari Y pertemuan") is the official record, and a Presence window
// EduNex didn't record may still have been counted in SIX.
import { wibDay } from "./course-meetings";
import { EDUNEX_WEB, edunexCourseUrl } from "./links";
import type { AcademicCalendar, ClassSession, PresenceSession, SixCourse, Task } from "./models";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;

export const DEFAULT_TARGET = 80;

// ---------------------------------------------------------------- where it counts

/**
 * six: the lecturer records attendance in SIX; EduNex's Presence windows (if
 * any) go unused, so their "Absent" means nothing. edunex: only EduNex has a
 * record (SIX shows no count). both: EduNex records keep up with SIX's count,
 * so the lecturer uses both. unknown: neither has a record yet.
 */
export type CountedIn = "six" | "edunex" | "both" | "unknown";

/**
 * The rule. SIX's count is official, so wherever SIX has one, SIX counts.
 * EduNex counts too when what it recorded keeps up with SIX: at least SIX's
 * attended count minus one (one meeting of slack for a window the Student
 * missed or a lecturer who records late). A course whose EduNex windows
 * recorded far fewer than SIX counted (the default View Course rule nobody
 * uses: 1 of 15 in EduNex against 6 of 7 in SIX) counts in SIX only.
 */
export function countedIn(six: SixCourse["attendance"], presence: readonly PresenceSession[], now: number): CountedIn {
  const closed = presence.filter((p) => p.closesAt <= now);
  const recorded = closed.filter((p) => p.recorded?.present).length;
  const sixCounts = six !== null && six.held > 0;
  if (!sixCounts) return closed.length > 0 ? "edunex" : "unknown";
  if (closed.length === 0) return "six";
  return recorded >= six.attended - 1 ? "both" : "six";
}

// ---------------------------------------------------------------- meetings left

/** Exam sessions take a lecture slot; they aren't meetings. */
export const isExamActivity = (activity: string) => /\b(UTS|UAS|Ujian|Kuis|Quiz|Exam)\b/i.test(activity);

const wibWeekday = (ms: number) => new Date(ms + WIB).getUTCDay();
const wibMinutes = (ms: number) => Math.round(((ms + WIB) % DAY) / MINUTE);
const dayStart = (day: string) => Date.parse(`${day}T00:00:00+07:00`);

interface Slot {
  weekday: number;
  /** Minutes after midnight, WIB. */
  start: number;
  length: number;
}
const slotOf = (s: ClassSession): Slot => ({ weekday: wibWeekday(s.start), start: wibMinutes(s.start), length: s.end - s.start });
const slotKey = (slot: Slot) => `${slot.weekday}|${slot.start}|${slot.length}`;

/**
 * The course's usual weekly slot(s): the weekday and time it met at least
 * twice, still in use (last met within a week of the course's latest regular
 * meeting, so a slot the course moved away from mid-semester drops out). A
 * course seen once only has that one slot.
 */
export function usualSlots(sessions: readonly ClassSession[]): Slot[] {
  const regular = sessions.filter((s) => !isExamActivity(s.activity)).sort((a, b) => a.start - b.start);
  if (!regular.length) return [];
  const seen = new Map<string, { slot: Slot; count: number; last: number }>();
  for (const s of regular) {
    const slot = slotOf(s);
    const entry = seen.get(slotKey(slot)) ?? { slot, count: 0, last: 0 };
    entry.count += 1;
    entry.last = s.start;
    seen.set(slotKey(slot), entry);
  }
  const recurring = [...seen.values()].filter((e) => e.count >= 2);
  if (!recurring.length) return [slotOf(regular.at(-1)!)];
  const latest = Math.max(...recurring.map((e) => e.last));
  return recurring.filter((e) => latest - e.last < 7 * DAY).map((e) => e.slot);
}

/** The term's last lecture day ("2026-12-04"), and the days with no lectures (UTS, UAS, holidays), from ITB's calendar. */
export function lecturePeriod(calendar: AcademicCalendar | undefined, term: string | null, now: number): { lastDay: string; offDays: Set<string> } | null {
  if (!calendar) return null;
  const today = wibDay(now);
  const ends = calendar.events.filter((e) => e.kind === "lecture-end");
  const end = term ? ends.find((e) => e.term === term) : ends.filter((e) => e.lastDay >= today).sort((a, b) => a.start - b.start)[0];
  if (!end) return null;
  const offDays = new Set<string>();
  for (const event of calendar.events) {
    if (event.kind !== "uts" && event.kind !== "uas" && event.kind !== "holiday") continue;
    for (let t = dayStart(event.firstDay); wibDay(t) <= event.lastDay; t += DAY) offDays.add(wibDay(t));
  }
  return { lastDay: end.lastDay, offDays };
}

export interface MeetingsLeft {
  count: number;
  /** Part of it is the usual weekly slot carried on past SIX's timetable: say "about". */
  estimated: boolean;
  /** The next meeting on SIX's timetable. */
  next: ClassSession | null;
}

/**
 * Meetings still to come until ITB's last lecture day: the course's sessions
 * on SIX's timetable that haven't started, then, past the last day the
 * timetable covers (`schedule` is SIX's whole timetable, every course), the
 * usual weekly slot(s) carried on to the last lecture day, skipping UTS and
 * UAS weeks and holidays.
 */
export function meetingsLeft(code: string, schedule: readonly ClassSession[], period: ReturnType<typeof lecturePeriod>, now: number): MeetingsLeft {
  const mine = schedule.filter((s) => s.courseCode === code);
  const before = (s: ClassSession) => !period || wibDay(s.start) <= period.lastDay;
  const coming = mine.filter((s) => s.start > now && !isExamActivity(s.activity) && before(s)).sort((a, b) => a.start - b.start);
  let count = coming.length;
  let estimated = false;
  if (period && schedule.length) {
    // SIX's timetable comes a month at a time: it covers through the end of its last month.
    const lastMonth = wibDay(Math.max(...schedule.map((s) => s.start))).slice(0, 7);
    const [year, month] = lastMonth.split("-").map(Number);
    const covered = Date.UTC(year, month, 1) - WIB;
    const slots = usualSlots(mine);
    const from = Math.max(covered, now);
    for (let day = dayStart(wibDay(from)); wibDay(day) <= period.lastDay; day += DAY) {
      const date = wibDay(day);
      if (period.offDays.has(date)) continue;
      for (const slot of slots) {
        const at = day + slot.start * MINUTE;
        if (slot.weekday === wibWeekday(day) && at >= from && at > now) {
          count += 1;
          estimated = true;
        }
      }
    }
  }
  return { count, estimated, next: coming[0] ?? null };
}

// ---------------------------------------------------------------- the budget

/**
 * safe: room to spare. risk: one absence left, or below the target now.
 * none: no absences left (every remaining meeting needed). out: the target
 * can't be reached anymore. unknown: SIX has no count yet.
 */
export type AttendanceState = "safe" | "risk" | "none" | "out" | "unknown";

export interface AttendanceHealth {
  code: string;
  countedIn: CountedIn;
  /** SIX's exact count; null until SIX shows one. */
  attended: number | null;
  held: number | null;
  left: MeetingsLeft;
  /** Absences still allowed while finishing at the target; negative when out of reach. */
  absencesLeft: number | null;
  /** The share if every remaining meeting is attended (0–1). */
  best: number | null;
  /** Meetings in a row that bring the Student back to the target, when below it now and it can be done this term. */
  toRecover: number | null;
  state: AttendanceState;
  /** EduNex Presence: windows that closed, and how many recorded the Student present. */
  edunexClosed: number;
  edunexRecorded: number;
}

export interface AttendanceInput {
  code: string;
  six: SixCourse["attendance"];
  presence: readonly PresenceSession[];
  /** SIX's whole timetable (every course). */
  schedule: readonly ClassSession[];
  period: ReturnType<typeof lecturePeriod>;
  /** Percent, 50–100. */
  target: number;
  now: number;
}

const EPS = 1e-9;

export function attendanceHealth({ code, six, presence, schedule, period, target, now }: AttendanceInput): AttendanceHealth {
  const closed = presence.filter((p) => p.closesAt <= now);
  const base = {
    code,
    countedIn: countedIn(six, presence, now),
    left: meetingsLeft(code, schedule, period, now),
    edunexClosed: closed.length,
    edunexRecorded: closed.filter((p) => p.recorded?.present).length,
  };
  if (!six || six.held === 0) return { ...base, attended: six?.attended ?? null, held: six?.held ?? null, absencesLeft: null, best: null, toRecover: null, state: "unknown" };
  const { attended, held } = six;
  const t = target / 100;
  const remaining = base.left.count;
  const planned = held + remaining;
  // a + r − (allowed) ≥ t·(h + r)  →  allowed = ⌊a + r − t·(h + r)⌋
  const absencesLeft = Math.floor(attended + remaining - t * planned + EPS);
  const best = (attended + remaining) / planned;
  // (a + k) / (h + k) ≥ t  →  k = ⌈(t·h − a) / (1 − t)⌉
  const below = attended / held < t - EPS;
  const k = !below ? 0 : t >= 1 ? Number.POSITIVE_INFINITY : Math.ceil((t * held - attended) / (1 - t) - EPS);
  const toRecover = below && k <= remaining ? k : null;
  const state: AttendanceState = absencesLeft < 0 ? "out" : absencesLeft === 0 ? "none" : absencesLeft === 1 || below ? "risk" : "safe";
  return { ...base, attended, held, absencesLeft, best, toRecover, state };
}

/** A state worth a word: not safe and known. */
export const needsAttention = (state: AttendanceState) => state === "risk" || state === "none" || state === "out";

// ---------------------------------------------------------------- what counts in an EduNex window

/**
 * EduNex's `presence_categories`: View Course (the default, no `presentable`),
 * Read Module, Join Discussion, Answer Assignment, Do Exam, Join Vicon, and
 * the CRS actions. "other" is a category the app doesn't know yet.
 */
export type PresenceActivity = "course" | "module" | "thread" | "assignment" | "exam" | "vicon" | "crs" | "other";

const ACTIVITIES: Readonly<Record<string, PresenceActivity>> = {
  course: "course",
  module: "module",
  thread: "thread",
  assignment: "assignment",
  exam: "exam",
  vicon: "vicon",
  crs_join: "crs",
  crs_chat: "crs",
  crs_vote: "crs",
};

export interface PresenceAction {
  activity: PresenceActivity;
  /** The Task to hand in, for Answer Assignment, when the app knows it. */
  task: Task | null;
  /** The EduNex page where the Student does it. */
  url: string;
}

/**
 * The activity that counts in a Presence window and the EduNex page to do it
 * on: the session's own link when EduNex gives one, else the Task's or
 * module's page, else the course. The app only opens the page; the Student acts.
 */
export function presenceAction(session: PresenceSession, tasks: readonly Task[]): PresenceAction {
  const first = session.countsBy[0];
  const activity = first ? (ACTIVITIES[first.kind] ?? "other") : "course";
  const task = activity === "assignment" ? (tasks.find((t) => String(t.id) === first?.id) ?? null) : null;
  const fallback =
    activity === "module" && first
      ? `${EDUNEX_WEB}/courses/${session.courseId}/preview/${first.id}`
      : task?.moduleId != null
        ? `${EDUNEX_WEB}/courses/${task.courseId}/preview/${task.moduleId}`
        : edunexCourseUrl(task?.courseId ?? session.courseId);
  return { activity, task, url: session.url ?? fallback };
}

/** The Presence window, not closed yet, that a Task's hand-in counts as attendance for (Answer Assignment); the soonest. */
export function attendanceWindow(task: Task, presence: Readonly<Record<string, readonly PresenceSession[]>> | undefined, now: number): PresenceSession | null {
  const windows = (presence?.[task.courseCode] ?? []).filter((session) => session.closesAt > now && presenceAction(session, [task]).task !== null);
  return windows.sort((a, b) => a.opensAt - b.opensAt)[0] ?? null;
}

/** Presence windows open right now that haven't recorded the Student yet, soonest closing first. */
export function openWindows(presence: Readonly<Record<string, readonly PresenceSession[]>>, now: number): { code: string; session: PresenceSession }[] {
  return Object.entries(presence)
    .flatMap(([code, sessions]) => sessions.filter((p) => p.opensAt <= now && now < p.closesAt && !p.recorded?.present).map((session) => ({ code, session })))
    .sort((a, b) => a.session.closesAt - b.session.closesAt);
}

// ---------------------------------------------------------------- after a class

/** SIX's count for a course at a moment. */
export interface CountAt {
  at: number;
  attended: number;
  held: number;
}

/**
 * counted: both went up. absent: SIX held the meeting but didn't count the
 * Student (marked absent). missing: SIX's count didn't move (not recorded yet).
 */
export type AfterClass = "counted" | "absent" | "missing";

export function afterClass(before: CountAt, now: Pick<CountAt, "attended" | "held">): AfterClass {
  if (now.held > before.held) return now.attended > before.attended ? "counted" : "absent";
  return now.attended > before.attended ? "counted" : "missing";
}
