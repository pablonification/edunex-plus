// Presensi's figures and words, copied as they are from the desktop's src/app/screens/presence.tsx
// (that file draws DOM too): the groups and their order, what needs the Student now (the "zone"),
// a row's next class and meta line, the clash answer, and the dates the footer names. The screens
// in this folder only lay them out.
import type { Attendance, CourseAttendance, OpenWindow } from "../../../../src/app/attendance";
import type { Format, Translate } from "../../../../src/app/i18n";
import {
  type AttendanceHealth,
  clashPick,
  firstUnreadDay,
  GROUP_ORDER,
  isExamActivity,
  type PresenceGroup,
  percent,
  presenceGroup,
  resultNeedsStudent,
  sortGroup,
} from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { wibDay } from "../../../../src/core/course-meetings";
import type { CalendarEvent, ClassSession, SixCheckIn, SixStudent, UnreadSession } from "../../../../src/core/models";
import { dayNoon } from "../../../../src/core/schedule";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A class whose Tandai Hadir went this long ago still gets "did it go through?" on its row. */
export const GONE_FOR = HOUR;

/** The groups' order frozen while the Targets sheet is open, so nothing moves under the thumb. */
export type Still = { group: PresenceGroup; codes: string[] }[];

/** "80%", or "75–80%" when courses have their own. */
export function targetRange(courses: readonly CourseAttendance[]): string {
  const values = courses.map((c) => c.health.target);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? `${low}%` : `${low}–${high}%`;
}

export function groupsOf(courses: readonly CourseAttendance[], signedOut: boolean, still: Still | null): { group: PresenceGroup; items: CourseAttendance[] }[] {
  const byCode = new Map(courses.map((c) => [c.course.code, c]));
  if (still) {
    const placed = new Set(still.flatMap((s) => s.codes));
    const frozen = still.map(({ group, codes }) => ({
      group,
      items: codes.map((code) => byCode.get(code)).filter((c): c is CourseAttendance => c !== undefined),
    }));
    // A course that appears meanwhile joins its group's end (or a group of its own), never a second copy of a group.
    for (const extra of groupsOf(
      courses.filter((c) => !placed.has(c.course.code)),
      signedOut,
      null,
    )) {
      const same = frozen.find((g) => g.group === extra.group);
      if (same) same.items.push(...extra.items);
      else frozen.push(extra);
    }
    return frozen;
  }
  return GROUP_ORDER.map((group) => ({
    group,
    items: sortGroup(
      group,
      courses.filter((c) => presenceGroup(c.health, signedOut) === group),
      (c) => c.health,
      (c) => c.nextWindow?.session.opensAt ?? null,
    ),
  })).filter(({ items }) => items.length > 0);
}

/** All the group's courses share a target: the heading names it; else it says "the target". */
const sharedTarget = (items: readonly CourseAttendance[]) => (new Set(items.map((c) => c.health.target)).size === 1 ? items[0]!.health.target : null);

export function groupLabel(t: Translate, group: PresenceGroup, items: readonly CourseAttendance[]): string {
  const target = sharedTarget(items);
  switch (group) {
    case "out":
      return target === null ? t("presence.group.outMixed") : t("presence.status.out", { target });
    case "none":
      return t("presence.group.none");
    case "edunex":
      return t("presence.group.edunex");
    case "spare":
      return t("presence.group.spare");
    case "unknown":
      return t("presence.budget.unknown");
    case "missed":
      return target === null ? t("presence.group.missedMixed") : t("presence.budget.missed", { target });
    case "met":
      return target === null ? t("presence.group.metMixed") : t("presence.group.met", { target });
    case "courses":
      return t("presence.courses");
  }
}

/** "Kam 15 Okt" / "Thu 15 Oct". */
export const dayLabel = (f: Format, at: number) => `${f.weekdayShort(at)} ${f.dayMonth(at)}`;
export const noonOf = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

// ---------------------------------------------------------------- what needs the Student now

export interface Zone {
  checkIns: ClassSession[];
  windows: OpenWindow[];
  /** SIX's count that didn't go up after a class, by SIX's meeting id. */
  results: { id: string; code: string; absent: boolean; start: number }[];
  counted: string[];
  countedLate: string[];
  clashes: { a: CourseAttendance; b: CourseAttendance; from: number; to: number }[];
  /** Two or more courses' next class falls in one exam week (or holiday): said once. */
  week: { event: CalendarEvent; codes: string[] } | null;
}

export function nowZone(
  attendance: Attendance,
  {
    now,
    student,
    checkIns,
    events,
  }: { now: number; student: SixStudent | undefined; checkIns: Record<string, SixCheckIn> | undefined; events: readonly CalendarEvent[] },
): Zone {
  const today = wibDay(now);
  const byCode = new Map(attendance.courses.map((c) => [c.course.code, c]));
  const open = student ? attendance.schedule.filter((s) => checkIns?.[s.id]?.state === "open" && checkingIn(s, now)) : [];
  const results = Object.entries(attendance.results)
    .filter(([, r]) => byCode.has(r.courseCode) && resultNeedsStudent(r, attendance.countLog, now))
    .map(([id, r]) => ({ id, code: r.courseCode, absent: r.result === "absent", start: r.start }))
    .sort((a, b) => a.start - b.start);
  const countedToday = Object.values(attendance.results)
    .filter((r) => r.result === "counted" && wibDay(r.at) === today && byCode.has(r.courseCode))
    .sort((a, b) => a.start - b.start);
  const counted = [...new Set(countedToday.filter((r) => r.wasAt === undefined).map((r) => r.courseCode))];
  const countedLate = [...new Set(countedToday.filter((r) => r.wasAt !== undefined).map((r) => r.courseCode))];
  // Today's classes that share time and haven't ended, each pair once.
  const todays = attendance.schedule
    .filter((s) => wibDay(s.start) === today && s.end > now && !isExamActivity(s.activity) && byCode.has(s.courseCode))
    .sort((a, b) => a.start - b.start);
  const clashes: Zone["clashes"] = [];
  for (const [i, x] of todays.entries())
    for (const y of todays.slice(i + 1))
      if (
        y.courseCode !== x.courseCode &&
        y.start < x.end &&
        x.start < y.end &&
        !clashes.some((c) => c.a.course.code === x.courseCode && c.b.course.code === y.courseCode)
      )
        clashes.push({ a: byCode.get(x.courseCode)!, b: byCode.get(y.courseCode)!, from: Math.max(x.start, y.start), to: Math.min(x.end, y.end) });
  // The next class of each course, when it may not run, by the exam week (or holiday) it falls in.
  const uncertain = new Map<CalendarEvent, string[]>();
  for (const c of attendance.courses) {
    const first = c.health.left.upcoming[0];
    if (!first?.uncertain || c.health.needsUncertain) continue;
    const event = periodOf(events, first.start);
    if (event) uncertain.set(event, [...(uncertain.get(event) ?? []), c.course.code]);
  }
  const shared = [...uncertain.entries()].find(([, codes]) => codes.length >= 2);
  return {
    checkIns: open,
    windows: attendance.open.filter((w) => w.counts),
    results,
    counted,
    countedLate,
    clashes,
    week: shared ? { event: shared[0], codes: shared[1] } : null,
  };
}

export const periodOf = (events: readonly CalendarEvent[], at: number) => {
  const day = wibDay(at);
  return events.find((e) => (e.kind === "uts" || e.kind === "uas" || e.kind === "holiday") && e.firstDay <= day && day <= e.lastDay);
};

/** The clash answer in words, from `clashPick`; null when the app can't say (the title stands alone). */
export function clashAnswer(t: Translate, a: AttendanceHealth, b: AttendanceHealth): string | null {
  const pick = clashPick(a, b);
  if (!pick.why) return null;
  const picked = pick.pick === a.code ? a : b;
  const other = picked === a ? b : a;
  const left = (h: AttendanceHealth) => h.absencesLeft ?? 0;
  switch (pick.why) {
    case "none":
      return t("presence.clash.none", { code: picked.code });
    case "fewer":
      return t("presence.clash.fewer", { code: picked.code, count: left(picked), other: other.code, otherCount: left(other) });
    case "noneOut":
      return t("presence.clash.noneOut", { code: picked.code, other: other.code, target: other.target });
    case "spareOut":
      return t("presence.clash.spareOut", { code: picked.code, count: left(picked), other: other.code, target: other.target });
    case "bothNone":
      return t("presence.clash.bothNone");
    case "even":
      return t("presence.clash.even", { count: left(a) });
  }
}

// ---------------------------------------------------------------- a course

export interface RowContext {
  now: number;
  student: SixStudent | undefined;
  checkIns: Record<string, SixCheckIn>;
  events: readonly CalendarEvent[];
  zone: Zone;
  signedOut: boolean;
  schedule: readonly ClassSession[];
  /** SIX's meetings the app couldn't read, by day (ADR 0013). */
  unread: readonly UnreadSession[];
  own: Readonly<Record<string, number>>;
  /** Without ITB's calendar: absences count only SIX's timetable so far. */
  soFar: boolean;
  onChangeTarget: (code: string) => void;
}

export function sideText(t: Translate, group: PresenceGroup, health: AttendanceHealth): string {
  if (group === "edunex" && health.edunexClosed > 0) return t("presence.edunexTally", { recorded: health.edunexRecorded, closed: health.edunexClosed });
  if ((group === "met" || group === "missed") && health.held) return t("presence.row.final", { percent: percent(health.attended ?? 0, health.held) });
  return "";
}

/** The class going on now, else the next one (SIX's, else the weekly slot carried on). */
export function classOf(item: CourseAttendance, context: RowContext): { session: ClassSession | null; start: number; live: boolean } | null {
  const live = context.schedule.find((s) => s.courseCode === item.course.code && s.start <= context.now && context.now < s.end && !isExamActivity(s.activity));
  if (live) return { session: live, start: live.start, live: true };
  const next = item.health.left.next;
  if (next) return { session: next, start: next.start, live: false };
  const coming = item.health.left.upcoming[0];
  return coming ? { session: null, start: coming.start, live: false } : null;
}

/** When an Edunex window is: a hand-in's close is a deadline ("Jum 16 Okt, kumpulkan sebelum 23:59"), any other its time. */
export function windowWhen(t: Translate, f: Format, window: NonNullable<CourseAttendance["nextWindow"]>): string {
  const { session, action } = window;
  if (action.activity === "assignment") return t("presence.row.handIn", { day: dayLabel(f, session.closesAt), time: f.time(session.closesAt) });
  return `${f.relativeDay(session.opensAt)}, ${f.timeRange(session.opensAt, session.closesAt)}`;
}

/** The meta line: on now until when, or the next class and its room; signed out of SIX, the next Edunex window. */
export function metaParts(t: Translate, f: Format, item: CourseAttendance, context: RowContext): string[] {
  if (context.signedOut) return item.nextWindow ? [t("presence.row.window", { when: windowWhen(t, f, item.nextWindow) })] : [];
  const at = classOf(item, context);
  if (at?.live && at.session) return [t("presence.row.now", { time: f.time(at.session.end) }), at.session.room ?? ""].filter(Boolean);
  // A class of the course SIX shows that the app couldn't read, before the next one it can: that comes first.
  const unreadDay = firstUnreadDay(context.unread, context.schedule, context.now, at?.start ?? null, item.course.code);
  if (unreadDay) return [t("home.now.unread", { day: f.relativeDay(dayNoon(unreadDay)) })];
  if (!at) return [];
  const time = at.session ? f.timeRange(at.session.start, at.session.end) : f.time(at.start);
  const offset = f.dayOffset(at.start);
  const when =
    offset === 0
      ? t("presence.row.nextToday", { time })
      : offset === 1
        ? t("presence.row.nextTomorrow", { time })
        : t("presence.row.nextOn", { day: dayLabel(f, at.start), time });
  return [when, at.session?.room ?? ""].filter(Boolean);
}

/**
 * "Kam 15 Okt masuk masa UTS, …", naming the period from ITB's calendar.
 * `target`: the course's target hangs on that class running.
 */
export function uncertainText(t: Translate, f: Format, start: number, events: readonly CalendarEvent[], target?: number): string {
  const date = dayLabel(f, start);
  const event = periodOf(events, start);
  if (event?.kind === "holiday") return target ? t("presence.warn.neededHoliday", { date, target }) : t("presence.warn.uncertainHoliday", { date });
  const period = t(event?.kind === "uts" ? "presence.period.uts" : event?.kind === "uas" ? "presence.period.uas" : "presence.period.off");
  return target ? t("presence.warn.needed", { date, period, target }) : t("presence.warn.uncertain", { date, period });
}

// ---------------------------------------------------------------- said once, under the groups

/** The footer's dates line: when lectures end, and up to when SIX's timetable is read (later dates are estimated). */
export function footerDates(t: Translate, f: Format, attendance: Attendance): string {
  const { lastDay, schedule } = attendance;
  const estimated = attendance.courses.some((c) => c.health.left.estimated);
  if (!lastDay) return t("presence.estimateNoDate");
  if (!estimated || !schedule.length) return t("presence.estimateEnd", { date: dayLabel(f, noonOf(lastDay)) });
  // SIX's timetable comes a month at a time: it covers through the end of its last month.
  const [year, month] = wibDay(Math.max(...schedule.map((s) => s.start)))
    .slice(0, 7)
    .split("-")
    .map(Number) as [number, number];
  const covered = Date.UTC(year, month, 1) - 7 * HOUR - DAY / 2;
  return t("presence.estimate", { date: dayLabel(f, noonOf(lastDay)), day: f.dayMonth(covered) });
}
