// Beranda's reasoning (#77): what needs the Student now from both systems
// ("Needs you"), what today looks like, and what changed. Pure: the screen
// passes in the datasets and the moment.
//
// "Needs you" is a list of providers, one per area (Presence, classes,
// exams, Tasks, announced meetings, attendance). A provider turns the
// datasets into items; a later area (KRS steps, UKT due) is one more provider.
// Ranking: the band first (now, soon, coming up), then the area in the order
// of PROVIDERS, then the soonest moment, so the window closing first is on top.

import { billNeedsStudent, krsWindows } from "./academic";
import {
  type AttendanceHealth,
  type AttendanceState,
  attendanceHealth,
  type CountedIn,
  isExamActivity,
  lecturePeriod,
  openWindows,
  type PresenceActivity,
  presenceAction,
} from "./attendance";
import { materialKind } from "./course-materials";
import { type AnnouncedMeeting, announcedMeetings, wibDay } from "./course-meetings";
import { dateVars, sameLocalDay, weekdayVars } from "./dates";
import { type Exam, mergeExams } from "./exams";
import type {
  AcademicCalendar,
  Alert,
  AlertKind,
  Announcement,
  Bill,
  ClassSession,
  EdunexExam,
  KrsPlan,
  Material,
  PresenceSession,
  SixCourse,
  Task,
} from "./models";
import type { Route } from "./route";
import { dayStart, isScheduleReminder, slotMarks, weekStart } from "./schedule";
import { editedAfterSubmit, isOpenStatus, notOpenYet, shortWindow, takesAnswers, taskStatus } from "./tasks";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A class starting this soon is "now": time to go. */
export const STARTING_SOON = HOUR;
/** Tasks due within these are now / soon / coming up. */
export const DUE_NOW = DAY;
const DUE_SOON = 3 * DAY;
const DUE_LATER = 7 * DAY;
/** How far ahead "coming up" looks, and how far back "What changed" does. */
const AHEAD = 7 * DAY;
const RECENT = 7 * DAY;

// ---------------------------------------------------------------- the inputs

export interface TermCourseFacts {
  code: string;
  /** SIX's exact count, when SIX has one. */
  six: SixCourse["attendance"];
  /** The Edunex course id, when the course is on Edunex. */
  edunexId: number | null;
  /** The course's attendance target, percent: its own, or the Student's default. */
  target: number;
}

/** Everything Beranda reasons from. Missing datasets are empty (or null for SIX's timetable). */
export interface HomeWorld {
  now: number;
  term: string | null;
  courses: readonly TermCourseFacts[];
  tasks: readonly Task[];
  presence: Readonly<Record<string, readonly PresenceSession[]>>;
  materials: Readonly<Record<string, readonly Material[]>>;
  announcements: Readonly<Record<string, readonly Announcement[]>>;
  /** SIX's timetable; null while SIX isn't connected (then nothing can be "not in SIX"). */
  schedule: readonly ClassSession[] | null;
  /** The months whose own SIX timetable page was read ("2026-10"): only there can a meeting be "not in SIX". */
  scheduleMonths?: readonly string[];
  /** Edunex's exams by course code. */
  exams?: Readonly<Record<string, readonly EdunexExam[]>>;
  calendar: AcademicCalendar | undefined;
  /** SIX's study plan (KRS) for the term, and the UKT bills. */
  krs?: KrsPlan;
  bills?: readonly Bill[];
  /** False while signed out of SIX: then which system counts can't be known. */
  sixConnected?: boolean;
}

/** What every provider shares, worked out once. */
export interface HomeContext extends HomeWorld {
  health: ReadonlyMap<string, AttendanceHealth>;
  /** ITB's calendar gave the last lecture day, so "absences left" uses it. */
  usesCalendar: boolean;
}

export function homeContext(world: HomeWorld): HomeContext {
  const period = lecturePeriod(world.calendar, world.term, world.now);
  const schedule = world.schedule ?? [];
  const health = new Map(
    world.courses.map((course) => [
      course.code,
      attendanceHealth({
        code: course.code,
        six: course.six,
        sixConnected: world.sixConnected,
        presence: world.presence[course.code] ?? [],
        schedule,
        period,
        target: course.target,
        now: world.now,
      }),
    ]),
  );
  return { ...world, health, usesCalendar: period !== null };
}

// ---------------------------------------------------------------- the items

export type Band = "now" | "soon" | "later";
export type NeedSource = "edunex" | "six" | "itb";

/** The one thing to do: a screen of the app, or an official page (or the lecturer's online-class link) in the browser. */
export type NeedAction = { kind: "go"; route: Route } | { kind: "open"; url: string; via: "edunex" | "six" | "link" };

interface NeedBase {
  /** Stable, so the screen keeps its place between ticks. */
  id: string;
  course: string | null;
  band: Band;
  /** 1 for the top item. */
  rank: number;
  /** The moment it's about (closes, starts, due), for ordering and "in 3 hours". */
  at: number | null;
  sources: readonly NeedSource[];
  action: NeedAction;
}

/** What a class has on top of SIX's time and room. */
export interface ClassFacts {
  session: ClassSession;
  live: boolean;
  countedIn: CountedIn;
  /** SIX's count and what it leaves, when the course is this term's. */
  health: AttendanceHealth | null;
  absencesLeft: number | null;
  state: AttendanceState;
  /** Different from the course's usual weekly slot. */
  moved: SlotChange | null;
  /** The online-class link posted for it. */
  link: string | null;
  /** Another course's class whose time overlaps this one, and the shared part. */
  overlap: { code: string; from: number; to: number } | null;
}

export type NeedFacts =
  | {
      kind: "presence";
      session: PresenceSession;
      open: boolean;
      activity: PresenceActivity;
      /** The Task to hand in, for Answer Assignment. */
      task: Task | null;
      countedIn: CountedIn;
      /** The class going on with it, from SIX. */
      class: ClassSession | null;
      /** That class is off its usual slot. */
      classMoved: SlotChange | null;
    }
  | ({ kind: "class" } & ClassFacts)
  | { kind: "task"; task: Task; reason: "overdue" | "short" | "due" | "edited"; draft: boolean }
  | { kind: "attendance"; health: AttendanceHealth }
  | { kind: "meeting"; meeting: AnnouncedMeeting }
  | { kind: "exam"; exam: Exam; sitting: ExamSitting; disagree: boolean }
  | { kind: "krs"; closesAt: number; open: boolean; window: "drs" }
  | { kind: "bill"; bill: Bill; overdue: boolean };

/** When and where an exam is sat: SIX's session (with its room) or Edunex's dated exam. */
export interface ExamSitting {
  start: number;
  /** null when Edunex gives only the start. */
  end: number | null;
  room: string | null;
  source: "six" | "edunex";
}

export type Need = NeedBase & NeedFacts;
/** What a provider gives: an item before ranking. */
export type NeedDraft = Omit<NeedBase, "rank"> & NeedFacts;

export interface NeedProvider {
  /** The first kind it gives, for the ranking (one provider may give more kinds). */
  area: NeedFacts["kind"];
  needs(context: HomeContext): NeedDraft[];
}

const BAND_ORDER: Record<Band, number> = { now: 0, soon: 1, later: 2 };

/** Every item from every provider, ranked. */
export function needsYou(world: HomeWorld | HomeContext, providers: readonly NeedProvider[] = PROVIDERS): Need[] {
  const context = "health" in world ? world : homeContext(world);
  const area = new Map<string, number>(providers.map((provider, i) => [provider.area, i]));
  // A provider's other kinds rank with it.
  if (area.has("krs")) area.set("bill", area.get("krs")!);
  return providers
    .flatMap((provider) => provider.needs(context))
    .sort(
      (a, b) =>
        BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
        (area.get(a.kind) ?? providers.length) - (area.get(b.kind) ?? providers.length) ||
        (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    )
    .map((need, i) => ({ ...need, rank: i + 1 }) as Need);
}

// ---------------------------------------------------------------- shared facts

const courseOf = (context: HomeContext, code: string) => context.courses.find((course) => course.code === code);
const courseRoute = (code: string, tab = "meetings"): NeedAction => ({ kind: "go", route: { screen: "course", code, tab } });

/** The course's page in the app, or Presensi for a course only in SIX. */
const classAction = (context: HomeContext, code: string): NeedAction =>
  courseOf(context, code)?.edunexId != null ? courseRoute(code) : { kind: "go", route: { screen: "presence" } };

export interface SlotChange {
  /** The usual time, when this one differs: the usual slot on its own day that week (ms, for formatting). */
  usualStart: number | null;
  usualEnd: number | null;
  /** The usual room, when this one differs. */
  usualRoom: string | null;
}

/**
 * How a SIX meeting differs from its course's usual weekly slot, by Jadwal's
 * rule (slotMarks): another time or another weekday when it stands in for the
 * week's usual meeting, or another room. SIX never marks these. An extra
 * meeting on top of the usual one isn't a move; exams aren't compared.
 */
export function slotChange(session: ClassSession, schedule: readonly ClassSession[]): SlotChange | null {
  const moved = slotMarks(schedule).moved.get(session.id);
  if (!moved) return null;
  const retimed = moved.kinds.includes("time") || moved.kinds.includes("day");
  const usualDay = dayStart(weekStart(wibDay(session.start))) + moved.usual.weekday * DAY;
  return {
    usualStart: retimed ? usualDay + moved.usual.start * MINUTE : null,
    usualEnd: retimed ? usualDay + moved.usual.end * MINUTE : null,
    usualRoom: moved.kinds.includes("room") ? moved.usual.room : null,
  };
}

/** Meetings each course announced in Edunex text, with the moment the text was posted. */
function announced(context: HomeContext, code: string): (AnnouncedMeeting & { postedAt: number | null })[] {
  const materials = context.materials[code] ?? [];
  const announcements = context.announcements[code] ?? [];
  const meetings = announcedMeetings(materials, announcements);
  // The post that announced each meeting, for "What changed".
  const posts = [
    ...materials.filter((m) => materialKind(m.type) === "note").map((m) => ({ found: announcedMeetings([m], []), at: m.updatedAt ?? m.postedAt })),
    ...announcements.map((a) => ({ found: announcedMeetings([], [a]), at: a.postedAt })),
  ];
  return meetings.map((meeting) => ({
    ...meeting,
    postedAt: posts
      .filter((p) => p.found.some((m) => m.start === meeting.start))
      .reduce<number | null>((latest, p) => (p.at !== null && (latest === null || p.at > latest) ? p.at : latest), null),
  }));
}

/** Announced meetings SIX's timetable doesn't list, in a month whose own SIX page was read (only when SIX is connected). */
function onlyInEdunex(context: HomeContext, code: string) {
  if (!context.schedule) return [];
  const read = new Set(context.scheduleMonths ?? []);
  const sixDays = new Set(context.schedule.filter((s) => s.courseCode === code).map((s) => wibDay(s.start)));
  return announced(context, code).filter((meeting) => read.has(wibDay(meeting.start).slice(0, 7)) && !sixDays.has(wibDay(meeting.start)));
}

/**
 * The online-class link for a class on a day: the one posted for that
 * meeting in Edunex text, else the course's latest online-class material
 * (lecturers often keep one Teams link all term).
 */
export function classLink(context: HomeContext, code: string, start: number): string | null {
  const day = wibDay(start);
  const forMeeting = announced(context, code).find((m) => wibDay(m.start) === day && m.link);
  if (forMeeting) return forMeeting.link;
  const vicons = (context.materials[code] ?? []).filter((m) => materialKind(m.type) === "vicon" && m.content?.startsWith("https://"));
  return vicons.sort((a, b) => (b.updatedAt ?? b.postedAt ?? 0) - (a.updatedAt ?? a.postedAt ?? 0))[0]?.content ?? null;
}

function classFacts(context: HomeContext, session: ClassSession): ClassFacts {
  const health = context.health.get(session.courseCode);
  return {
    session,
    live: session.start <= context.now && context.now < session.end,
    countedIn: health?.countedIn ?? "unknown",
    health: health ?? null,
    absencesLeft: health?.absencesLeft ?? null,
    state: health?.state ?? "unknown",
    moved: slotChange(session, context.schedule ?? []),
    link: classLink(context, session.courseCode, session.start),
    overlap: overlapWith(session, context.schedule ?? []),
  };
}

function overlapWith(session: ClassSession, schedule: readonly ClassSession[]): ClassFacts["overlap"] {
  const other = schedule.find((s) => s.courseCode !== session.courseCode && s.start < session.end && session.start < s.end);
  return other ? { code: other.courseCode, from: Math.max(session.start, other.start), to: Math.min(session.end, other.end) } : null;
}

const today = (context: HomeContext) => wibDay(context.now);
/** SIX's meetings today that haven't ended. */
const classesLeftToday = (context: HomeContext) => (context.schedule ?? []).filter((s) => wibDay(s.start) === today(context) && s.end > context.now);

/** The Tasks a Presence window open now or coming up asks to hand in: the Presence item speaks for them. */
function presenceTasks(context: HomeContext): Set<number> {
  const ids = new Set<number>();
  for (const sessions of Object.values(context.presence))
    for (const session of sessions) {
      if (session.closesAt <= context.now || session.opensAt - context.now > AHEAD || session.recorded?.present) continue;
      const action = presenceAction(session, context.tasks);
      if (action.task) ids.add(action.task.id);
    }
  return ids;
}

// ---------------------------------------------------------------- providers

/**
 * Edunex Presence: a window open now (always on top: the action takes
 * seconds and closes soon), and a coming window that counts only by a
 * specific action (hand in a Task, open a module). The weekly View Course
 * default isn't announced ahead: it would repeat every week.
 */
export const presenceProvider: NeedProvider = {
  area: "presence",
  needs(context) {
    const { now } = context;
    const out: NeedDraft[] = [];
    const facts = (code: string, session: PresenceSession) => {
      const action = presenceAction(session, context.tasks);
      const live = (context.schedule ?? []).find((s) => s.courseCode === code && s.start < session.closesAt && session.opensAt < s.end);
      // Signed out of SIX, even a course with no window closed yet can't be said to count in Edunex.
      const countedIn: CountedIn = context.sixConnected === false ? "noSix" : (context.health.get(code)?.countedIn ?? "unknown");
      return { action, live: live ?? null, countedIn, moved: live ? slotChange(live, context.schedule ?? []) : null };
    };
    for (const { code, session } of openWindows(context.presence, now)) {
      const { action, live, countedIn, moved } = facts(code, session);
      out.push({
        id: `presence:${session.id}`,
        kind: "presence",
        course: code,
        band: "now",
        at: session.closesAt,
        sources: live ? ["edunex", "six"] : ["edunex"],
        action: { kind: "open", url: action.url, via: "edunex" },
        session,
        open: true,
        activity: action.activity,
        task: action.task,
        countedIn,
        class: live,
        classMoved: moved,
      });
    }
    for (const [code, sessions] of Object.entries(context.presence)) {
      for (const session of sessions) {
        if (session.opensAt <= now || session.opensAt - now > AHEAD || session.recorded?.present) continue;
        const { action, live, countedIn, moved } = facts(code, session);
        if (action.activity === "course") continue;
        out.push({
          id: `presence:${session.id}`,
          kind: "presence",
          course: code,
          band: session.opensAt - now <= DAY ? "soon" : "later",
          at: session.opensAt,
          sources: ["edunex"],
          action: action.task ? { kind: "go", route: { screen: "task", taskId: action.task.id } } : { kind: "open", url: action.url, via: "edunex" },
          session,
          open: false,
          activity: action.activity,
          task: action.task,
          countedIn,
          class: live,
          classMoved: moved,
        });
      }
    }
    return out;
  },
};

/**
 * SIX's classes today: one going on or starting within the hour (where to
 * be, where attendance counts), and one later today the Student can't
 * afford to miss or that moved from its usual slot. A class with an Edunex
 * window open is already the Presence item; an exam is the exam item.
 */
export const classProvider: NeedProvider = {
  area: "class",
  needs(context) {
    const { now } = context;
    const windows = openWindows(context.presence, now);
    const withWindow = (s: ClassSession) => windows.some((w) => w.code === s.courseCode && s.start < w.session.closesAt && w.session.opensAt < s.end);
    const out: NeedDraft[] = [];
    for (const session of classesLeftToday(context)) {
      if (withWindow(session) || isExamActivity(session.activity)) continue;
      const facts = classFacts(context, session);
      const close = session.start <= now + STARTING_SOON;
      const notable = facts.state === "none" || facts.moved !== null;
      if (!close && !notable) continue;
      out.push({
        id: `class:${session.id}`,
        kind: "class",
        course: session.courseCode,
        band: close ? "now" : "soon",
        at: session.start,
        sources: facts.countedIn === "edunex" || facts.countedIn === "both" || facts.link ? ["six", "edunex"] : ["six"],
        action: facts.link ? { kind: "open", url: facts.link, via: "link" } : classAction(context, session.courseCode),
        ...facts,
      });
    }
    return out;
  },
};

/**
 * Tasks to hand in: late but still taken, a short answer window open now,
 * due within a day (now), three days (soon) or a week (coming up); and a
 * Task the lecturer edited after the Student handed it in, in the last week.
 */
export const taskProvider: NeedProvider = {
  area: "task",
  needs(context) {
    const { now } = context;
    const viaPresence = presenceTasks(context);
    const out: NeedDraft[] = [];
    for (const task of context.tasks) {
      if (viaPresence.has(task.id)) continue;
      const status = taskStatus(task, now);
      const base = {
        kind: "task",
        course: task.courseCode,
        at: task.dueAt,
        sources: ["edunex"],
        action: { kind: "go", route: { screen: "task", taskId: task.id } },
        task,
      } as const;
      if (editedAfterSubmit(task) && task.editedAt! <= now && now - task.editedAt! < RECENT) {
        const stillOpen = task.dueAt === null || task.dueAt > now || task.lateAllowed;
        out.push({ ...base, id: `task:${task.id}:edited`, band: stillOpen && !task.closed ? "now" : "soon", reason: "edited", draft: false });
        continue;
      }
      if (!isOpenStatus(status) || notOpenYet(task, now) || !takesAnswers(task, now)) continue;
      const draft = status === "draft";
      if (status === "overdue") {
        out.push({ ...base, id: `task:${task.id}`, band: "now", reason: "overdue", draft });
        continue;
      }
      if (task.dueAt === null) continue;
      const left = task.dueAt - now;
      if (shortWindow(task) !== null && left <= DUE_SOON) {
        out.push({ ...base, id: `task:${task.id}`, band: "now", reason: "short", draft });
        continue;
      }
      if (left > DUE_LATER) continue;
      out.push({ ...base, id: `task:${task.id}`, band: left <= DUE_NOW ? "now" : left <= DUE_SOON ? "soon" : "later", reason: "due", draft });
    }
    return out;
  },
};

/** Meetings announced only in Edunex text, not on SIX's timetable, in the coming week. */
export const meetingProvider: NeedProvider = {
  area: "meeting",
  needs(context) {
    const { now } = context;
    return context.courses.flatMap((course) =>
      onlyInEdunex(context, course.code)
        .filter((m) => m.end > now && m.start - now <= AHEAD)
        .map(
          ({ postedAt: _postedAt, ...meeting }): NeedDraft => ({
            id: `meeting:${course.code}:${meeting.start}`,
            kind: "meeting",
            course: course.code,
            band: meeting.start <= now + STARTING_SOON ? "now" : meeting.start - now <= 2 * DAY ? "soon" : "later",
            at: meeting.start,
            sources: ["edunex"],
            action: meeting.link ? { kind: "open", url: meeting.link, via: "link" } : courseRoute(course.code),
            meeting,
          }),
        ),
    );
  },
};

/**
 * SIX's count leaves no absences, or the target can't be reached anymore.
 * With no absences left, a course meeting later today is already the class
 * item ("don't miss it").
 */
export const attendanceProvider: NeedProvider = {
  area: "attendance",
  needs(context) {
    const meetsToday = new Set(
      classesLeftToday(context)
        .filter((s) => !isExamActivity(s.activity))
        .map((s) => s.courseCode),
    );
    const out: NeedDraft[] = [];
    for (const course of context.courses) {
      const health = context.health.get(course.code);
      if (!health || (health.state !== "none" && health.state !== "out") || (health.state === "none" && meetsToday.has(course.code))) continue;
      out.push({
        id: `attendance:${course.code}:${health.state}`,
        kind: "attendance",
        course: course.code,
        band: "soon",
        at: health.left.next?.start ?? null,
        sources: context.usesCalendar ? ["six", "itb"] : ["six"],
        action: { kind: "go", route: { screen: "presence" } },
        health,
      });
    }
    return out;
  },
};

/**
 * Exams within the week, each at its next sitting: SIX's session with its
 * room, or Edunex's dated exam (a take-home exam is a Task, and the Task
 * item speaks for it). Within a day it's now, within three days soon, else
 * coming up; when SIX and Edunex give it different days it's at least soon,
 * time to ask the lecturer.
 */
export const examProvider: NeedProvider = {
  area: "exam",
  needs(context) {
    const { now } = context;
    const exams = mergeExams({
      schedule: context.schedule ?? [],
      edunexExams: context.exams,
      tasks: context.tasks,
      courses: context.courses.map((c) => c.code),
      now,
    });
    const out: NeedDraft[] = [];
    for (const exam of exams) {
      const sittings: ExamSitting[] = [
        ...exam.six.map((s) => ({ start: s.start, end: s.end, room: s.room, source: "six" as const })),
        ...exam.edunex.flatMap((e) => (e.start !== null ? [{ start: e.start, end: e.end, room: null, source: "edunex" as const }] : [])),
      ];
      const [next] = sittings.filter((s) => (s.end ?? s.start) > now).sort((a, b) => a.start - b.start);
      if (!next || next.start - now > AHEAD) continue;
      const left = next.start - now;
      const sources: NeedSource[] = [...(exam.six.length ? ["six" as const] : []), ...(exam.edunex.length || exam.tasks.length ? ["edunex" as const] : [])];
      out.push({
        id: `exam:${exam.id}`,
        kind: "exam",
        course: exam.courseCode,
        band: left <= DUE_NOW ? "now" : left <= DUE_SOON || exam.disagree ? "soon" : "later",
        at: next.start,
        sources,
        action: { kind: "go", route: { screen: "exam", examId: exam.id } },
        exam,
        sitting: next,
        disagree: exam.disagree,
      });
    }
    return out;
  },
};

/**
 * SIX's study-plan steps the Student must take: a KRS not sent while ITB's
 * DRS window is open or opens within the week (now when it closes within a
 * day, else soon); and a UKT bill overdue or due within the week.
 */
export const academicProvider: NeedProvider = {
  area: "krs",
  needs(context) {
    const { now } = context;
    const out: NeedDraft[] = [];
    const plan = context.krs;
    if (plan && plan.state === "not-sent") {
      const { drs } = krsWindows(context.calendar, plan.term);
      if (drs && drs.end > now && drs.start - now <= AHEAD) {
        const open = drs.start <= now;
        out.push({
          id: `krs:${plan.term}`,
          kind: "krs",
          course: null,
          band: open && drs.end - now <= DUE_NOW ? "now" : "soon",
          at: open ? drs.end : drs.start,
          sources: ["six"],
          action: { kind: "go", route: { screen: "plan", tab: "krs" } },
          closesAt: drs.end,
          open,
          window: "drs",
        });
      }
    }
    for (const bill of context.bills ?? []) {
      if (!billNeedsStudent(bill, now) || bill.nextDueAt === null) continue;
      const overdue = bill.nextDueAt < now;
      out.push({
        id: `bill:${bill.term}`,
        kind: "bill",
        course: null,
        band: overdue || bill.nextDueAt - now <= DUE_NOW ? "now" : "soon",
        at: bill.nextDueAt,
        sources: ["six"],
        action: { kind: "go", route: { screen: "plan", tab: "bills" } },
        bill,
        overdue,
      });
    }
    return out;
  },
};

/** In ranking order within a band. */
export const PROVIDERS: readonly NeedProvider[] = [
  presenceProvider,
  classProvider,
  examProvider,
  taskProvider,
  meetingProvider,
  attendanceProvider,
  academicProvider,
];

// ---------------------------------------------------------------- today

export interface TodayPlan {
  /** SIX's meetings today, by start. */
  classes: ClassFacts[];
  /** The next class to start (today), for the countdown. */
  next: ClassSession | null;
  /** Meetings announced only in Edunex today and tomorrow. */
  announced: { code: string; meeting: AnnouncedMeeting }[];
  /** Open Tasks due today and tomorrow, soonest first. */
  due: Task[];
}

export function todayPlan(world: HomeWorld | HomeContext): TodayPlan {
  const context = "health" in world ? world : homeContext(world);
  const { now } = context;
  const day = today(context);
  const tomorrow = wibDay(now + DAY);
  const classes = (context.schedule ?? [])
    .filter((s) => wibDay(s.start) === day)
    .sort((a, b) => a.start - b.start)
    .map((s) => classFacts(context, s));
  const announcedSoon = context.courses
    .flatMap((course) => onlyInEdunex(context, course.code).map(({ postedAt: _p, ...meeting }) => ({ code: course.code, meeting })))
    .filter(({ meeting }) => meeting.end > now && (wibDay(meeting.start) === day || wibDay(meeting.start) === tomorrow))
    .sort((a, b) => a.meeting.start - b.meeting.start);
  const due = context.tasks
    .filter((task) => task.dueAt !== null && takesAnswers(task, now) && task.dueAt > now && (wibDay(task.dueAt) === day || wibDay(task.dueAt) === tomorrow))
    .sort((a, b) => a.dueAt! - b.dueAt!);
  return { classes, next: classes.find((c) => c.session.start > now)?.session ?? null, announced: announcedSoon, due };
}

// ---------------------------------------------------------------- what changed

// Change text is kept as catalog keys, so it shows in the Student's language
// wherever it appears: times on this computer's clock (as alert text names
// them), and days in the app's words for both languages ("Kam, 15 Okt").
const two = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) => `${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`;
const timeRange = (start: number, end: number) => `${clock(start)}–${clock(end)}`;

/** A moved class's usual slot: its time, with its weekday when that's another day ("Kamis 08:00–09:30"); else the usual room. */
function usualVars(session: ClassSession, change: SlotChange): { usualId: string; usualEn: string } {
  if (change.usualStart === null || change.usualEnd === null) return { usualId: change.usualRoom ?? "", usualEn: change.usualRoom ?? "" };
  const time = timeRange(change.usualStart, change.usualEnd);
  if (sameLocalDay(change.usualStart, session.start)) return { usualId: time, usualEn: time };
  const { dayId, dayEn } = weekdayVars(change.usualStart);
  return { usualId: `${dayId} ${time}`, usualEn: `${dayEn} ${time}` };
}

/** Alert kinds that are changes (not reminders): what "What changed" lists from the history. */
const CHANGE_KINDS: ReadonlySet<AlertKind> = new Set(["newTask", "newMaterial", "taskEdited", "scheduleChanged", "meeting", "exam", "grade", "krs"]);

/** The id the change alert and the change list share for a Task edit. */
export const taskEditedId = (task: Pick<Task, "id" | "editedAt">) => `task.edited:${task.id}:${task.editedAt}`;
export const materialPostedId = (material: Pick<Material, "id">) => `material.posted:${material.id}`;

/** The text of a Task edit, as the alert and the list both say it. */
export function taskEditedText(task: Task): Pick<Alert, "title" | "body"> {
  return editedAfterSubmit(task)
    ? {
        title: { key: "alert.taskEdited.afterSubmit", vars: { course: task.courseCode } },
        body: { key: "alert.taskEdited.afterSubmit.body", vars: { title: task.title } },
      }
    : { title: { key: "alert.taskEdited", vars: { course: task.courseCode } }, body: { key: "alert.plain", vars: { title: task.title } } };
}

/**
 * The last week's changes in both systems, newest first: the alert history
 * (every alert raised, muted ones too) joined with what the datasets show
 * directly (Task posted or edited, material posted, a class moved from its
 * usual slot in the coming week, a meeting announced outside SIX). Each
 * opens its screen.
 */
export function recentChanges(world: HomeWorld | HomeContext, history: readonly Alert[]): Alert[] {
  const context = "health" in world ? world : homeContext(world);
  const { now } = context;
  const derived: Alert[] = [];
  for (const task of context.tasks) {
    const target = { screen: "task", taskId: task.id } as const;
    if (task.postedAt !== null)
      derived.push({
        id: `task.new:${task.id}`,
        kind: "newTask",
        source: "edunex",
        at: task.postedAt,
        title: { key: "alert.newTask", vars: { course: task.courseCode } },
        body: { key: "alert.plain", vars: { title: task.title } },
        target,
      });
    if (task.editedAt !== null)
      derived.push({ id: taskEditedId(task), kind: "taskEdited", source: "edunex", at: task.editedAt, ...taskEditedText(task), target });
  }
  for (const [code, materials] of Object.entries(context.materials))
    for (const material of materials)
      if (material.postedAt !== null)
        derived.push({
          id: materialPostedId(material),
          kind: "newMaterial",
          source: "edunex",
          at: material.postedAt,
          title: { key: "alert.newMaterial", vars: { course: code } },
          body: { key: "alert.plain", vars: { title: material.title } },
          target: { screen: "course", code, tab: "modules" },
        });
  for (const session of context.schedule ?? []) {
    if (session.end <= now || session.start - now > AHEAD) continue;
    const change = slotChange(session, context.schedule ?? []);
    if (!change) continue;
    // SIX says nothing about when it changed: it's known as of now.
    derived.push({
      // The id the change alert has (src/engine/alerts/schedule.ts), so the two show once.
      id: `schedule.moved:${session.id}:${session.start}:${session.end}:${session.room ?? ""}`,
      kind: "scheduleChanged",
      source: "six",
      at: now,
      title: { key: "home.change.moved", vars: { course: session.courseCode } },
      body: {
        key: change.usualStart !== null ? "home.change.moved.time" : "home.change.moved.room",
        vars: { ...dateVars(session.start), time: timeRange(session.start, session.end), room: session.room ?? "", ...usualVars(session, change) },
      },
      target: { screen: "schedule" },
    });
  }
  // Upcoming meetings, and ones held in the last week: an old meeting re-read in a text isn't news.
  for (const course of context.courses)
    for (const meeting of onlyInEdunex(context, course.code))
      if (meeting.postedAt !== null && meeting.end > now - RECENT)
        derived.push({
          id: `meeting:${course.code}:${meeting.start}`,
          kind: "meeting",
          source: "edunex",
          at: meeting.postedAt,
          title: { key: "home.change.meeting", vars: { course: course.code, number: meeting.number } },
          body: { key: "home.change.meeting.body", vars: { ...dateVars(meeting.start), time: timeRange(meeting.start, meeting.end) } },
          target: { screen: "course", code: course.code, tab: "meetings" },
        });

  // The same event from the history and the datasets shows once, the history's version first.
  const sameness = (a: Alert) => `${a.kind}|${a.title.vars?.course ?? ""}|${a.body?.vars?.title ?? a.id}`;
  const seenIds = new Set<string>();
  const seenAs = new Set<string>();
  const out: Alert[] = [];
  for (const item of [...history.filter((a) => CHANGE_KINDS.has(a.kind) && !isScheduleReminder(a.id)), ...derived]) {
    if (item.at > now || now - item.at > RECENT || seenIds.has(item.id) || seenAs.has(sameness(item))) continue;
    seenIds.add(item.id);
    seenAs.add(sameness(item));
    out.push(item);
  }
  return out.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------- Beranda's three answers

/** An Edunex Presence window open now, and whether doing it counts. */
export interface OpenPresence {
  code: string;
  session: PresenceSession;
  activity: PresenceActivity;
  task: Task | null;
  /** The Presence itself when Edunex gives its page; else where the action is done. */
  url: string;
  /**
   * Doing it counts for attendance: Edunex keeps the count. False when SIX
   * counts and Edunex's record doesn't keep up: the window is open, but
   * sitting in class is what counts. Null while SIX has no count for the
   * course (not connected): nobody can say yet, and the app doesn't guess.
   */
  counts: boolean | null;
  /** Signed out of SIX: whether Edunex counts can't be known, so it's said as a just-in-case. */
  noSix: boolean;
}

/**
 * "Sekarang": the class going on (or else the next one today, or the next
 * one at all within the week), where its attendance counts, and the Edunex
 * Presence open for it. Without a class, an open Presence alone.
 */
export interface NowCard {
  state: "live" | "next" | "later" | "presence";
  class: ClassFacts | null;
  presence: OpenPresence | null;
  /** The class after this one today. */
  after: ClassSession | null;
}

export function nowCard(world: HomeWorld | HomeContext): NowCard | null {
  const context = "health" in world ? world : homeContext(world);
  const { now } = context;
  const schedule = [...(context.schedule ?? [])].sort((a, b) => a.start - b.start);
  const day = today(context);
  const todays = schedule.filter((s) => wibDay(s.start) === day);
  const live = todays.find((s) => s.start <= now && now < s.end) ?? null;
  const next = todays.find((s) => s.start > now) ?? null;
  const later = !live && !next ? (schedule.find((s) => s.start > now && s.start - now <= AHEAD) ?? null) : null;
  const current = live ?? next ?? later;
  const windows = openWindows(context.presence, now);
  const counts = (code: string): boolean | null => {
    if (!context.courses.find((course) => course.code === code)?.six || context.sixConnected === false) return null;
    return context.health.get(code)?.countedIn !== "six";
  };
  // The window for this class; else, between classes, one that counts (it closes first, so it leads); else, with no class at all, any.
  const window =
    (current && windows.find((w) => w.code === current.courseCode && current.start < w.session.closesAt && w.session.opensAt < current.end)) ??
    (live ? null : (windows.find((w) => counts(w.code) !== false) ?? (current ? null : (windows[0] ?? null))));
  const lead = window && current && window.code !== current.courseCode ? null : current;
  if (!lead && !window) return null;
  let presence: OpenPresence | null = null;
  if (window) {
    const action = presenceAction(window.session, context.tasks);
    presence = {
      code: window.code,
      session: window.session,
      activity: action.activity,
      task: action.task,
      url: action.url,
      counts: counts(window.code),
      noSix: context.sixConnected === false,
    };
  }
  const shown = lead;
  return {
    state: !shown ? "presence" : shown === live ? "live" : shown === next ? "next" : "later",
    class: shown ? classFacts(context, shown) : null,
    presence,
    after: shown && wibDay(shown.start) === day ? (todays.find((s) => s.start > shown.start) ?? null) : null,
  };
}

/**
 * "Perlu perhatianmu": what needs the Student this week that "Sekarang" and
 * "Hari ini" don't already show. Out: today's classes and their risk (each
 * class row carries it, except a target out of reach: that's the course's, with its own step), the Presence on the card, meetings and deadlines of
 * today and tomorrow (in "Hari ini"), and exams sat in today's classes.
 */
export function attention(world: HomeWorld | HomeContext, card: NowCard | null = null, plan?: TodayPlan): Need[] {
  const context = "health" in world ? world : homeContext(world);
  const day = today(context);
  const tomorrow = wibDay(context.now + DAY);
  const shownToday = plan ?? todayPlan(context);
  const due = new Set(shownToday.due.map((task) => task.id));
  const meetsToday = new Set(shownToday.classes.filter((c) => c.session.end > context.now).map((c) => c.session.courseCode));
  const soon = (at: number) => wibDay(at) === day || wibDay(at) === tomorrow;
  return needsYou(context)
    .filter((need) => {
      switch (need.kind) {
        case "class":
          return false;
        case "presence":
          return need.session.id !== card?.presence?.session.id;
        case "meeting":
          return !soon(need.meeting.start);
        case "task":
          return need.reason === "edited" || !due.has(need.task.id);
        case "exam":
          return !(need.sitting.source === "six" && wibDay(need.sitting.start) === day);
        case "attendance":
          // "No absences left" is on the class row; out of reach is the course's, with its own step.
          return need.health.state === "out" || !meetsToday.has(need.course ?? "");
        default:
          return true;
      }
    })
    .map((need, i) => ({ ...need, rank: i + 1 }));
}

/**
 * The bell's history: every alert the app raised (reminders too), with the
 * changes it can see in the data itself, so the bell and Beranda's "Yang
 * berubah" never disagree. A first sync is silent (nothing raised), which is
 * why the history alone was empty while the datasets showed changes. Newest first.
 */
export function alertFeed(world: HomeWorld | HomeContext, history: readonly Alert[]): Alert[] {
  const seen = new Set<string>();
  const out: Alert[] = [];
  // A raised alert has happened, even when the screen's clock (it moves once a minute) hasn't caught up with it:
  // a new Task's bell badge must never open onto a panel without it. Only changes read off the data wait for now.
  const raised = history.map((item) => ({ item, due: true }));
  const derived = recentChanges(world, history).map((item) => ({ item, due: item.at <= world.now }));
  for (const { item, due } of [...raised, ...derived]) {
    if (seen.has(item.id) || !due) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}
