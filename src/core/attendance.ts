// Attendance guard (#85): where each course's attendance counts, what SIX's
// exact count leaves the Student before their target, and, for each Edunex
// Presence window, the one action that counts there. Pure: the Presensi
// screen, the course page and the alert detectors all reason with this.
//
// Nothing here ever calls a meeting an absence on Edunex's word: SIX's count
// ("Hadir X dari Y pertemuan") is the official record, and a Presence window
// Edunex didn't record may still have been counted in SIX.
import { wibDay } from "./course-meetings";
import { EDUNEX_WEB, edunexCourseUrl } from "./links";
import type { AcademicCalendar, ClassSession, PresenceSession, Settings, SixCourse, Task, UnreadSession } from "./models";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;

// ---------------------------------------------------------------- the target

export type TargetSettings = Pick<Settings, "attendanceTarget" | "attendanceTargets">;

/** The course's own target when the Student set one (its course contract), else the default. Percent. */
export function targetFor(settings: TargetSettings, code: string): number {
  return Object.hasOwn(settings.attendanceTargets, code) ? settings.attendanceTargets[code] : settings.attendanceTarget;
}

// ---------------------------------------------------------------- where it counts

/**
 * six: the lecturer records attendance in SIX; Edunex's Presence windows (if
 * any) go unused, so their "Absent" means nothing. edunex: only Edunex has a
 * record (SIX shows no count). both: Edunex records keep up with SIX's count,
 * so the lecturer uses both. unknown: neither has a record yet. noSix: SIX
 * isn't connected, so which one counts can't be known; what Edunex recorded
 * is only a fact, never an absence.
 */
export type CountedIn = "six" | "edunex" | "both" | "unknown" | "noSix";

/** Where SIX counts, an Edunex Presence window is optional: said so on every screen, never as a thing to do. */
export const presenceOptional = (where: CountedIn | null | undefined) => where === "six";

/**
 * The rule. SIX's count is official, so wherever SIX has one, SIX counts.
 * Edunex counts too when what it recorded keeps up with SIX: at least SIX's
 * attended count minus one (one meeting of slack for a window the Student
 * missed or a lecturer who records late). A course whose Edunex windows
 * recorded far fewer than SIX counted (the default View Course rule nobody
 * uses: 1 of 15 in Edunex against 6 of 7 in SIX) counts in SIX only.
 */
export function countedIn(six: SixCourse["attendance"], presence: readonly PresenceSession[], now: number, sixConnected = true): CountedIn {
  const closed = presence.filter((p) => p.closesAt <= now);
  if (!sixConnected) return closed.length > 0 ? "noSix" : "unknown";
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

/** The session is on one of its course's usual weekly slots: a clash there comes back every week. */
export const onUsualSlot = (session: ClassSession, sessions: readonly ClassSession[]) =>
  usualSlots(sessions).some((slot) => slotKey(slot) === slotKey(slotOf(session)));

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

/** One meeting still to come. */
export interface UpcomingMeeting {
  start: number;
  /** SIX's session; null for the weekly slot carried on past SIX's timetable. */
  session: ClassSession | null;
  /** The weekly slot carried on: the date is the app's estimate. */
  estimated: boolean;
  /** Listed by SIX inside an exam week or a holiday on ITB's calendar: it may not happen, so it isn't counted. */
  uncertain: boolean;
}

export interface MeetingsLeft {
  /** Meetings sure enough to count on: every one in `upcoming` but the uncertain ones. */
  count: number;
  /** Part of it is the usual weekly slot carried on past SIX's timetable: say "about". */
  estimated: boolean;
  /** The next meeting on SIX's timetable (it may be uncertain: see `upcoming`). */
  next: ClassSession | null;
  /** Each meeting to come, in time order, the uncertain ones too (they aren't in `count`). */
  upcoming: UpcomingMeeting[];
}

/**
 * Meetings still to come until ITB's last lecture day: the course's sessions
 * on SIX's timetable that haven't started, then, past the last day the
 * timetable covers (`schedule` is SIX's whole timetable, every course), the
 * usual weekly slot(s) carried on to the last lecture day, skipping UTS and
 * UAS weeks and holidays. A session SIX lists inside those may not happen,
 * so it's uncertain and left out of the count: more meetings to come means
 * more absences allowed, and the Student must never be told they have one
 * to spare that isn't there. (Missing it if it does happen still costs one:
 * screens say "attend if it runs".) Unless the lecturer set an Edunex hand-in
 * for attendance that day (`presence`): then it happens.
 */
export function meetingsLeft(
  code: string,
  schedule: readonly ClassSession[],
  period: ReturnType<typeof lecturePeriod>,
  now: number,
  presence: readonly PresenceSession[] = [],
): MeetingsLeft {
  const mine = schedule.filter((s) => s.courseCode === code);
  const before = (s: ClassSession) => !period || wibDay(s.start) <= period.lastDay;
  const coming = mine.filter((s) => s.start > now && !isExamActivity(s.activity) && before(s)).sort((a, b) => a.start - b.start);
  // A day the lecturer set a hand-in for attendance (Edunex's Answer Assignment) is a meeting that happens, exam week or not.
  const handIn = new Set(presence.filter((p) => p.countsBy.some((link) => link.kind === "assignment")).map((p) => wibDay(p.opensAt)));
  const uncertain = (day: string) => (period?.offDays.has(day) ?? false) && !handIn.has(day);
  const upcoming: UpcomingMeeting[] = coming.map((session) => ({
    start: session.start,
    session,
    estimated: false,
    uncertain: uncertain(wibDay(session.start)),
  }));
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
        if (slot.weekday === wibWeekday(day) && at >= from && at > now) upcoming.push({ start: at, session: null, estimated: true, uncertain: false });
      }
    }
  }
  upcoming.sort((a, b) => a.start - b.start);
  return {
    count: upcoming.filter((m) => !m.uncertain).length,
    estimated: upcoming.some((m) => m.estimated),
    next: coming[0] ?? null,
    upcoming,
  };
}

// ---------------------------------------------------------------- the budget

/**
 * safe: room to spare. risk: one absence left, or below the target now with
 * absences still to spare by the end of term. none: no absences left (every
 * remaining meeting needed). out: the target can't be reached anymore.
 * met / missed: the course's lectures are over (nothing left to attend), and
 * it finished at or above its target / below it: final, nothing to do.
 * unknown: SIX has no count yet. Only none and out are warnings: while an
 * absence is still allowed (risk too), the course is fine.
 */
export type AttendanceState = "safe" | "risk" | "none" | "out" | "met" | "missed" | "unknown";

export interface AttendanceHealth {
  code: string;
  countedIn: CountedIn;
  /** SIX's exact count; null until SIX shows one. */
  attended: number | null;
  held: number | null;
  left: MeetingsLeft;
  /** Absences still allowed while finishing at the target, counting only meetings sure to happen; negative when out of reach. */
  absencesLeft: number | null;
  /** The share if every remaining meeting is attended, the ones that may not run too (0–1). */
  best: number | null;
  /** No absences left, and the target is in reach only if a class that may not run (exam week, holiday) runs and the Student attends it. */
  needsUncertain: boolean;
  /** Meetings in a row that bring the Student back to the target, when below it now and it can be done this term. */
  toRecover: number | null;
  state: AttendanceState;
  /** The target this course is judged against (percent): its own, or the default. */
  target: number;
  /** Edunex Presence: windows that closed, and how many recorded the Student present. */
  edunexClosed: number;
  edunexRecorded: number;
}

export interface AttendanceInput {
  code: string;
  six: SixCourse["attendance"];
  /** false: the Student isn't signed in to SIX (default true). */
  sixConnected?: boolean;
  presence: readonly PresenceSession[];
  /** SIX's whole timetable (every course). */
  schedule: readonly ClassSession[];
  period: ReturnType<typeof lecturePeriod>;
  /** Percent, 50–100. */
  target: number;
  now: number;
}

const EPS = 1e-9;

/**
 * Absences the target still allows by the end of term with `remaining`
 * meetings to come: a + r − allowed ≥ t·(h + r), so ⌊a + r − t·(h + r)⌋.
 * Negative: that many too many already.
 */
export function allowedAbsences(attended: number, held: number, remaining: number, target: number): number {
  return Math.floor(attended + remaining - (target / 100) * (held + remaining) + EPS);
}

export function attendanceHealth({ code, six, sixConnected, presence, schedule, period, target, now }: AttendanceInput): AttendanceHealth {
  const closed = presence.filter((p) => p.closesAt <= now);
  const base = {
    code,
    target,
    countedIn: countedIn(six, presence, now, sixConnected),
    left: meetingsLeft(code, schedule, period, now, presence),
    edunexClosed: closed.length,
    edunexRecorded: closed.filter((p) => p.recorded?.present).length,
  };
  if (!six || six.held === 0)
    return {
      ...base,
      attended: six?.attended ?? null,
      held: six?.held ?? null,
      absencesLeft: null,
      best: null,
      toRecover: null,
      needsUncertain: false,
      state: "unknown",
    };
  const { attended, held } = six;
  const t = target / 100;
  const allowed = (remaining: number) => allowedAbsences(attended, held, remaining, target);
  // Nothing left to attend, by ITB's calendar: past the last lecture day, or no
  // meeting of the course's own still to come before it (not even one that may
  // not run). Without the calendar, or the course's own classes on SIX's
  // timetable, that can't be told from a timetable that hasn't come yet. Nor
  // while a Presence window is still open: marking it there still counts.
  const over =
    period !== null &&
    base.left.upcoming.length === 0 &&
    !presence.some((p) => p.closesAt > now) &&
    (wibDay(now) > period.lastDay || schedule.some((s) => s.courseCode === code && !isExamActivity(s.activity)));
  if (over) {
    const final = allowed(0);
    return {
      ...base,
      attended,
      held,
      absencesLeft: Math.min(final, 0),
      best: attended / held,
      toRecover: null,
      needsUncertain: false,
      state: final < 0 ? "missed" : "met",
    };
  }
  // Absences to spare count only the meetings sure to happen; out of reach
  // counts every one that may still run: a class that may not run never
  // takes an absence away from the count, nor the target from the Student.
  const sure = base.left.count;
  const all = base.left.upcoming.length;
  const atBest = allowed(all);
  const absencesLeft = atBest < 0 ? atBest : Math.max(0, allowed(sure));
  const needsUncertain = atBest >= 0 && allowed(sure) < 0;
  const best = (attended + all) / (held + all);
  // (a + k) / (h + k) ≥ t  →  k = ⌈(t·h − a) / (1 − t)⌉
  const below = attended / held < t - EPS;
  const k = !below ? 0 : t >= 1 ? Number.POSITIVE_INFINITY : Math.ceil((t * held - attended) / (1 - t) - EPS);
  const toRecover = below && k <= sure ? k : null;
  const state: AttendanceState = absencesLeft < 0 ? "out" : absencesLeft === 0 ? "none" : absencesLeft === 1 || below ? "risk" : "safe";
  return { ...base, attended, held, absencesLeft, best, toRecover, needsUncertain, state };
}

/** A state that needs the Student: no absences left, or the target out of reach. */
export const needsAttention = (state: AttendanceState) => state === "none" || state === "out";

// ---------------------------------------------------------------- absences left, as a budget

/**
 * The absences a course's target allows this term, as the Student spends
 * them: `left` still theirs, `used` (missed, within the budget), `over`
 * (missed past it: the target is out of reach). `allowed` = left + used.
 */
export interface AbsenceBudget {
  allowed: number;
  left: number;
  used: number;
  over: number;
}

/**
 * The budget a Presence row draws. With m missed so far, s meetings sure to
 * come and A that may still run: in reach, ⌊(1−t)(h+s)⌋ = m + absences left;
 * out of reach, ⌊(1−t)(h+A)⌋, every one used and the rest over. Null where
 * there's nothing to spend: no SIX count yet, or lectures over (the result says it).
 */
export function absenceBudget(health: AttendanceHealth): AbsenceBudget | null {
  const { attended, held, absencesLeft, state } = health;
  if (attended === null || held === null || absencesLeft === null) return null;
  if (state !== "safe" && state !== "risk" && state !== "none" && state !== "out") return null;
  const missed = held - attended;
  if (state === "out") {
    const allowed = Math.max(0, allowedAbsences(attended, held, health.left.upcoming.length, health.target) + missed);
    return { allowed, left: 0, used: Math.min(allowed, missed), over: Math.max(0, missed - allowed) };
  }
  return { allowed: missed + absencesLeft, left: absencesLeft, used: missed, over: 0 };
}

/**
 * Before SIX has a count (early in the term): the absences the timetable
 * alone allows, ⌊(1−t)·r⌋ over the meetings sure to come. Null with none to come.
 */
export function estimatedBudget(health: Pick<AttendanceHealth, "left" | "target">): number | null {
  return health.left.count > 0 ? allowedAbsences(0, 0, health.left.count, health.target) : null;
}

/**
 * Presensi's groups, by what each course asks of the Student, in the order on
 * the page: out of reach, no absences left, recorded only in Edunex, absences
 * to spare, no SIX count yet, finished below, reached. `courses`: signed out
 * of SIX with nothing of it kept, where no state can be said.
 */
export type PresenceGroup = "out" | "none" | "edunex" | "spare" | "unknown" | "missed" | "met" | "courses";

export const GROUP_ORDER: readonly PresenceGroup[] = ["out", "none", "edunex", "spare", "unknown", "missed", "met", "courses"];

export function presenceGroup(health: AttendanceHealth, signedOut = false): PresenceGroup {
  if (signedOut && health.held === null) return "courses";
  switch (health.state) {
    case "safe":
    case "risk":
      return "spare";
    case "unknown":
      return health.countedIn === "edunex" ? "edunex" : "unknown";
    default:
      return health.state;
  }
}

/** The next meeting to come, sure or not; for ordering. */
const nextStart = (health: AttendanceHealth) => health.left.upcoming[0]?.start ?? health.left.next?.start ?? Number.MAX_SAFE_INTEGER;

/**
 * The rows of one group in their order: out of reach by the best still
 * possible (lowest first), no absences left by the next class, absences to
 * spare by how few are left then the next class, finished below by the
 * share; otherwise (and on ties) by course code. `windowAt`: the next Edunex
 * window of a course recorded there.
 */
export function sortGroup<T>(
  group: PresenceGroup,
  items: readonly T[],
  health: (item: T) => AttendanceHealth,
  windowAt: (item: T) => number | null = () => null,
): T[] {
  const share = (h: AttendanceHealth) => (h.held ? (h.attended ?? 0) / h.held : 0);
  const by: (a: AttendanceHealth, b: AttendanceHealth, x: T, y: T) => number =
    group === "out"
      ? (a, b) => (a.best ?? 0) - (b.best ?? 0)
      : group === "none"
        ? (a, b) => nextStart(a) - nextStart(b)
        : group === "spare"
          ? (a, b) => (a.absencesLeft ?? 0) - (b.absencesLeft ?? 0) || nextStart(a) - nextStart(b)
          : group === "missed"
            ? (a, b) => share(a) - share(b)
            : group === "edunex"
              ? (_a, _b, x, y) => (windowAt(x) ?? Number.MAX_SAFE_INTEGER) - (windowAt(y) ?? Number.MAX_SAFE_INTEGER)
              : () => 0;
  return [...items].sort((x, y) => by(health(x), health(y), x, y) || health(x).code.localeCompare(health(y).code));
}

// ---------------------------------------------------------------- two classes at once

/**
 * Which class to go to when two clash and the Student can make only one:
 * the one still in reach of its target that has fewer absences left. Going
 * to a course already out of reach changes nothing, so one in reach needs the
 * Student more. `why` names the facts the answer gives; null when the app
 * can't say (no SIX count, lectures over, both out of reach).
 */
export type ClashWhy = "none" | "fewer" | "noneOut" | "spareOut" | "bothNone" | "even";

export interface ClashPick {
  pick: string | null;
  why: ClashWhy | null;
}

const inReach = (state: AttendanceState) => state === "safe" || state === "risk" || state === "none";

export function clashPick(a: AttendanceHealth, b: AttendanceHealth): ClashPick {
  const known = (h: AttendanceHealth) => inReach(h.state) || h.state === "out";
  if (!known(a) || !known(b) || (a.state === "out" && b.state === "out")) return { pick: null, why: null };
  if (a.state === "out" || b.state === "out") {
    const pick = a.state === "out" ? b : a;
    return { pick: pick.code, why: pick.state === "none" ? "noneOut" : "spareOut" };
  }
  if (a.state === "none" && b.state === "none") return { pick: null, why: "bothNone" };
  const left = (h: AttendanceHealth) => h.absencesLeft ?? 0;
  if (left(a) === left(b)) return { pick: null, why: "even" };
  const pick = left(a) < left(b) ? a : b;
  return { pick: pick.code, why: pick.state === "none" ? "none" : "fewer" };
}

// ---------------------------------------------------------------- the next class day

/**
 * Presensi's first line: the next class day and which of its courses still
 * have an absence to spare ("4 classes today. Only PL3002 has an absence to
 * spare."). The day is today while a class of today hasn't ended, else
 * tomorrow; with neither, the next class at all (SIX's, else the weekly slot
 * carried on). Exams aren't classes. After ITB's last lecture day, the day
 * lectures ended. `spare`: the day's courses with an absence to spare, `of`
 * those with a SIX count, among the day's `courses` (null when none has a
 * count yet). A class SIX shows that the app couldn't read (`unread`) counts
 * on its day while it may still be ahead (unreadDaysAhead), and says so: a
 * day with one is never taken for a day off. Its course isn't known, so the
 * day's courses aren't all known either.
 */
export type DayAnswer =
  | { kind: "day"; day: "today" | "tomorrow"; count: number; spare: { codes: string[]; of: number; courses: number } | null; unread?: number }
  | { kind: "next"; at: number; unread?: number }
  | { kind: "ended"; lastDay: string };

export function dayAnswer(
  courses: readonly AttendanceHealth[],
  schedule: readonly ClassSession[],
  period: ReturnType<typeof lecturePeriod>,
  now: number,
  unread: readonly UnreadSession[] = [],
): DayAnswer | null {
  if (period && wibDay(now) > period.lastDay) return { kind: "ended", lastDay: period.lastDay };
  const ahead = new Set(unreadDaysAhead(unread, schedule, now).filter((day) => !period || day <= period.lastDay));
  const unreadOn = (day: string) => (ahead.has(day) ? unread.filter((one) => one.day === day).length : 0);
  const unreadDays = [...ahead];
  const withUnread = (count: number) => (count ? { unread: count } : {});
  const mine = new Map(courses.map((h) => [h.code, h]));
  // SIX's classes, then the weekly slots carried on past its timetable (so a month SIX hasn't published yet isn't empty).
  const classes = [
    ...schedule
      .filter((s) => mine.has(s.courseCode) && !isExamActivity(s.activity) && (!period || wibDay(s.start) <= period.lastDay))
      .map((s) => ({ code: s.courseCode, start: s.start, end: s.end })),
    ...courses.flatMap((h) => h.left.upcoming.filter((m) => m.estimated).map((m) => ({ code: h.code, start: m.start, end: m.start + 1 }))),
  ];
  const today = classes.filter((s) => wibDay(s.start) === wibDay(now) && s.end > now);
  const tomorrow = classes.filter((s) => wibDay(s.start) === wibDay(now + DAY));
  const [unreadToday, unreadTomorrow] = [unreadOn(wibDay(now)), unreadOn(wibDay(now + DAY))];
  const day = today.length || unreadToday ? "today" : tomorrow.length || unreadTomorrow ? "tomorrow" : null;
  if (day) {
    const sessions = day === "today" ? today : tomorrow;
    const extra = day === "today" ? unreadToday : unreadTomorrow;
    const codes = [...new Set(sessions.map((s) => s.code))];
    const counted = codes.map((code) => mine.get(code)!).filter((h) => h.state !== "unknown");
    const spare = counted.filter((h) => h.state === "safe" || h.state === "risk").map((h) => h.code);
    return {
      kind: "day",
      day,
      count: sessions.length + extra,
      spare: counted.length ? { codes: spare, of: counted.length, courses: codes.length + extra } : null,
      ...withUnread(extra),
    };
  }
  const coming = courses.flatMap((h) => h.left.upcoming).sort((a, b) => a.start - b.start);
  const next = coming.find((m) => !m.uncertain) ?? coming[0];
  // A day before it, or on it, with a class the app couldn't read: that day is the next one with a class.
  const later = unreadDays.filter((one) => one > wibDay(now + DAY)).sort()[0];
  if (later && (!next || later <= wibDay(next.start)))
    return { kind: "next", at: next && later === wibDay(next.start) ? next.start : Date.parse(`${later}T12:00:00+07:00`), ...withUnread(unreadOn(later)) };
  return next ? { kind: "next", at: next.start } : null;
}

/** SIX's classes run until 18:00 WIB most days: a class of today the app couldn't read may be ahead until then. */
const TEACHING_DAY_ENDS = 18 * HOUR;

/**
 * The days, from now on, with a class SIX shows that the app couldn't read. Its time isn't known, so
 * today's counts until the teaching day ends: 18:00 WIB, or the end of a later class SIX lists that day.
 */
export function unreadDaysAhead(unread: readonly UnreadSession[], schedule: readonly ClassSession[], now: number): string[] {
  const today = wibDay(now);
  const ends = Math.max(Date.parse(`${today}T00:00:00+07:00`) + TEACHING_DAY_ENDS, ...schedule.filter((s) => wibDay(s.start) === today).map((s) => s.end));
  return [...new Set(unread.map((one) => one.day))].filter((day) => day > today || (day === today && now < ends)).sort();
}

/**
 * The first of those days up to the day of `until` (a week ahead without it): a class may be on then, so neither
 * the next class nor a free week is said without it. `code`: only that course's (by the code SIX shows for it).
 */
export function firstUnreadDay(
  unread: readonly UnreadSession[],
  schedule: readonly ClassSession[],
  now: number,
  until: number | null,
  code?: string,
): string | null {
  const last = wibDay(until ?? now + 7 * DAY);
  const mine = code === undefined ? unread : unread.filter((one) => one.code === code);
  return unreadDaysAhead(mine, schedule, now).find((day) => day <= last) ?? null;
}

// ---------------------------------------------------------------- what counts in an Edunex window

/**
 * Edunex's `presence_categories`: View Course (the default, no `presentable`),
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

/**
 * A share as a whole percent, rounded down, the same on every screen: 79.6 %
 * must never read as the 80 % target. `whole` omitted: `part` is a fraction.
 */
export function percent(part: number, whole = 1): number {
  return whole > 0 ? Math.floor((part / whole) * 100 + 1e-9) : 0;
}

export interface PresenceAction {
  activity: PresenceActivity;
  /** The Task to hand in, for Answer Assignment, when the app knows it. */
  task: Task | null;
  /** The Edunex page where the Student does it. */
  url: string;
}

/**
 * The activity that counts in a Presence window and the Edunex page to do it
 * on: the session's own link when Edunex gives one, else the Task's or
 * module's page, else the course. A window can count by several things (two
 * Tasks, a Task and a module): a Task the app knows comes first, else the
 * first the lecturer chose. The app only opens the page; the Student acts.
 */
export function presenceAction(session: PresenceSession, tasks: readonly Task[]): PresenceAction {
  const known = session.countsBy.find((link) => link.kind === "assignment" && tasks.some((t) => String(t.id) === link.id));
  const first = known ?? session.countsBy[0];
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

/**
 * When the app may say SIX didn't count a class: a few hours after it ends
 * (lecturers fill SIX in after class), and still the same day (`until`, the
 * day's end), while the lecturer still remembers. The alert, the saved
 * results, Presensi and its badge share it.
 */
export function resultGate(session: Pick<ClassSession, "start" | "end">): { at: number; until: number } {
  const dayEnd = dayStart(wibDay(session.start)) + DAY;
  return { at: Math.max(session.end + 30 * MINUTE, Math.min(session.end + 3 * HOUR, dayEnd - HOUR)), until: dayEnd };
}

/** SIX's count per course over time: the changes only, the last 30 per course. */
export type CountLog = Readonly<Record<string, readonly CountAt[]>>;

const LOG_KEEP = 30;

/**
 * The log with each course's count as read at `at`, appended only where it
 * changed, and only for the courses SIX lists now (the same object when
 * nothing changed).
 */
export function appendCount(log: CountLog, courses: readonly Pick<SixCourse, "code" | "attendance">[], at: number): CountLog {
  // A course SIX no longer lists (last term's) takes its history with it.
  const listed = new Set(courses.map((c) => c.code));
  const gone = courses.length > 0 && Object.keys(log).some((code) => !listed.has(code));
  let next: Record<string, readonly CountAt[]> | null = gone ? Object.fromEntries(Object.entries(log).filter(([code]) => listed.has(code))) : null;
  for (const course of courses) {
    if (!course.attendance) continue;
    const list = (next ?? log)[course.code] ?? [];
    const last = list.at(-1);
    if (last && last.attended === course.attendance.attended && last.held === course.attendance.held) continue;
    next ??= { ...log };
    next[course.code] = [...list, { at, ...course.attendance }].slice(-LOG_KEEP);
  }
  return next ?? log;
}

/** What SIX's count did after one class. */
export interface ClassResult {
  courseCode: string;
  start: number;
  end: number;
  result: AfterClass;
  /** When the app judged it. */
  at: number;
  /** It was absent or missing first (judged then), and SIX counted it later, at `at`. */
  wasAt?: number;
}

export type ClassResults = Readonly<Record<string, ClassResult>>;

/** Results are kept this long after their class. */
const RESULTS_KEEP = 14 * DAY;

/**
 * What SIX's count says about one class so far, where it can be told apart
 * (SIX gives totals only):
 * - from the count before it started; never a class from before the app watched;
 * - only by what changed before the course's next class, and never when the
 *   course's class before it was still uncounted (one change could be either's);
 * - counted as soon as both numbers went up; absent (held up, attended not)
 *   or missing (neither) only from a count read after the class ended, and
 *   never when the course's next class starts before `resultGate` (two
 *   classes sharing one count).
 * `readAt`: when SIX's count was last read. The saved results, Presensi, its
 * badge and the alert all judge with this; when they may say it is
 * `resultGate`'s.
 */
export function judgeClass(
  session: ClassSession,
  schedule: readonly ClassSession[],
  log: CountLog,
  previous: ClassResults,
  readAt: number,
): { result: AfterClass; at: number } | null {
  const counts = log[session.courseCode] ?? [];
  const before = counts.filter((c) => c.at <= session.start).at(-1);
  if (!before) return null;
  const siblings = schedule
    .filter((s) => s.courseCode === session.courseCode && s.id !== session.id && !isExamActivity(s.activity))
    .sort((a, b) => a.start - b.start);
  const prev = siblings.filter((s) => s.start < session.start).at(-1);
  if (prev && prev.end > before.at && previous[prev.id]?.result !== "counted") return null;
  const horizon = siblings.find((s) => s.start > session.start)?.start ?? Number.POSITIVE_INFINITY;
  const after = counts.filter((c) => c.at > session.start && c.at <= Math.min(horizon, readAt)).at(-1) ?? before;
  const result = afterClass(before, after);
  if (result === "counted") return { result, at: after.at };
  if (readAt <= session.end || horizon <= resultGate(session).at) return null;
  return { result, at: after === before ? readAt : after.at };
}

/**
 * What SIX's count did after each class, by SIX's meeting id (`judgeClass`):
 * counted as soon as SIX counts it; absent or missing once `resultGate` has
 * passed, the same day. A result missing or absent first that SIX later
 * counted keeps when it was first judged (`wasAt`). Kept 14 days.
 */
export function classResults(previous: ClassResults, log: CountLog, schedule: readonly ClassSession[], now: number, readAt: number): ClassResults {
  const kept = Object.entries(previous).filter(([, r]) => r.start >= now - RESULTS_KEEP);
  const next: Record<string, ClassResult> = Object.fromEntries(kept);
  const classes = schedule.filter((s) => !isExamActivity(s.activity)).sort((a, b) => a.start - b.start);
  for (const session of classes) {
    if (session.start > now || session.start < now - RESULTS_KEEP) continue;
    const old = next[session.id];
    if (old?.result === "counted") continue;
    const judged = judgeClass(session, classes, log, next, readAt);
    if (!judged) continue;
    const base = { courseCode: session.courseCode, start: session.start, end: session.end };
    if (judged.result === "counted") {
      next[session.id] = { ...base, result: "counted", at: judged.at, ...(old ? { wasAt: old.at } : {}) };
      continue;
    }
    // Missing, then SIX held the class without counting the Student: it says more now, from when SIX showed it.
    if (old) {
      if (old.result === "missing" && judged.result === "absent") next[session.id] = { ...base, result: "absent", at: judged.at };
      continue;
    }
    const gate = resultGate(session);
    if (now < gate.at || now >= gate.until) continue;
    next[session.id] = { ...base, result: judged.result, at: now };
  }
  return next;
}

/**
 * A result that still needs the Student: absent or missing, judged within
 * the last two days, while SIX's count for the course hasn't moved since.
 */
export function resultNeedsStudent(result: ClassResult, log: CountLog, now: number): boolean {
  if (result.result === "counted" || now - result.at > 2 * DAY) return false;
  return !(log[result.courseCode] ?? []).some((c) => c.at > result.at);
}
