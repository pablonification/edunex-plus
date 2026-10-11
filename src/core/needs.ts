// Beranda's reasoning (#77): what needs the Student now from both systems
// ("Needs you"), what today looks like, and what changed. Pure: the screen
// passes in the datasets and the moment.
//
// "Needs you" is a list of providers, one per area (Presence, classes,
// Tasks, announced meetings, attendance). A provider turns the datasets into
// items; a later area (KRS steps, UKT due, exams) is one more provider.
// Ranking: the band first (now, soon, coming up), then the area in the order
// of PROVIDERS, then the soonest moment, so the window closing first is on top.
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
  usualSlots,
} from "./attendance";
import { materialKind } from "./course-materials";
import { type AnnouncedMeeting, announcedMeetings, wibDay } from "./course-meetings";
import type { AcademicCalendar, Alert, AlertKind, Announcement, ClassSession, Material, PresenceSession, SixCourse, Task } from "./models";
import type { Route } from "./route";
import { editedAfterSubmit, isOpenStatus, notOpenYet, shortWindow, takesAnswers, taskStatus } from "./tasks";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;

/** A class starting this soon is "now": time to go. */
export const STARTING_SOON = HOUR;
/** Tasks due within these are now / soon / coming up. */
const DUE_NOW = DAY;
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
  /** The EduNex course id, when the course is on EduNex. */
  edunexId: number | null;
}

/** Everything Beranda reasons from. Missing datasets are empty (or null for SIX's timetable). */
export interface HomeWorld {
  now: number;
  /** Attendance target, percent. */
  target: number;
  term: string | null;
  courses: readonly TermCourseFacts[];
  tasks: readonly Task[];
  presence: Readonly<Record<string, readonly PresenceSession[]>>;
  materials: Readonly<Record<string, readonly Material[]>>;
  announcements: Readonly<Record<string, readonly Announcement[]>>;
  /** SIX's timetable; null while SIX isn't connected (then nothing can be "not in SIX"). */
  schedule: readonly ClassSession[] | null;
  calendar: AcademicCalendar | undefined;
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
      attendanceHealth({ code: course.code, six: course.six, presence: world.presence[course.code] ?? [], schedule, period, target: world.target, now: world.now }),
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
  | { kind: "attendance"; health: AttendanceHealth; target: number }
  | { kind: "meeting"; meeting: AnnouncedMeeting };

export type Need = NeedBase & NeedFacts;
/** What a provider gives: an item before ranking. */
export type NeedDraft = Omit<NeedBase, "rank"> & NeedFacts;

export interface NeedProvider {
  area: NeedFacts["kind"];
  needs(context: HomeContext): NeedDraft[];
}

const BAND_ORDER: Record<Band, number> = { now: 0, soon: 1, later: 2 };

/** Every item from every provider, ranked. */
export function needsYou(world: HomeWorld | HomeContext, providers: readonly NeedProvider[] = PROVIDERS): Need[] {
  const context = "health" in world ? world : homeContext(world);
  const area = new Map(providers.map((provider, i) => [provider.area, i]));
  return providers
    .flatMap((provider) => provider.needs(context))
    .sort(
      (a, b) =>
        BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
        area.get(a.kind)! - area.get(b.kind)! ||
        (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    )
    .map((need, i) => ({ ...need, rank: i + 1 }) as Need);
}

// ---------------------------------------------------------------- shared facts

const courseOf = (context: HomeContext, code: string) => context.courses.find((course) => course.code === code);
const courseRoute = (code: string, tab = "meetings"): NeedAction => ({ kind: "go", route: { screen: "course", code, tab } });

/** The course's page in the app, or Presensi for a course only in SIX. */
const classAction = (context: HomeContext, code: string): NeedAction => (courseOf(context, code)?.edunexId != null ? courseRoute(code) : { kind: "go", route: { screen: "presence" } });

const wibMinutes = (ms: number) => Math.round(((ms + WIB) % DAY) / MINUTE);
const wibWeekday = (ms: number) => new Date(ms + WIB).getUTCDay();

export interface SlotChange {
  /** The usual time, when this one differs (ms of an example meeting in the usual slot, for formatting). */
  usualStart: number | null;
  usualEnd: number | null;
  /** The usual room, when this one differs. */
  usualRoom: string | null;
}

/**
 * How a SIX meeting differs from its course's usual weekly slot: another time
 * on the usual weekday, or another room. SIX never marks these. A meeting on
 * another weekday is an extra one, not a move; exams aren't compared.
 */
export function slotChange(session: ClassSession, schedule: readonly ClassSession[]): SlotChange | null {
  if (isExamActivity(session.activity)) return null;
  const mine = schedule.filter((s) => s.courseCode === session.courseCode && !isExamActivity(s.activity));
  const slots = usualSlots(mine);
  const weekday = wibWeekday(session.start);
  const sameDay = slots.filter((slot) => slot.weekday === weekday);
  const fits = sameDay.some((slot) => slot.start === wibMinutes(session.start) && slot.length === session.end - session.start);
  let usualStart: number | null = null;
  let usualEnd: number | null = null;
  if (sameDay.length && !fits && mine.length > 1) {
    const slot = sameDay[0];
    const dayStart = Date.parse(`${wibDay(session.start)}T00:00:00+07:00`);
    usualStart = dayStart + slot.start * MINUTE;
    usualEnd = usualStart + slot.length;
  }
  const rooms = new Map<string, number>();
  for (const s of mine) if (s.room) rooms.set(s.room, (rooms.get(s.room) ?? 0) + 1);
  const [usual] = [...rooms.entries()].sort((a, b) => b[1] - a[1]);
  const usualRoom = usual && usual[1] >= 2 && session.room && session.room !== usual[0] ? usual[0] : null;
  return usualStart !== null || usualRoom !== null ? { usualStart, usualEnd, usualRoom } : null;
}

/** Meetings each course announced in EduNex text, with the moment the text was posted. */
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
    postedAt: posts.filter((p) => p.found.some((m) => m.start === meeting.start)).reduce<number | null>((latest, p) => (p.at !== null && (latest === null || p.at > latest) ? p.at : latest), null),
  }));
}

/** Announced meetings SIX's timetable doesn't list (only when SIX is connected). */
function onlyInEdunex(context: HomeContext, code: string) {
  if (!context.schedule) return [];
  const sixDays = new Set(context.schedule.filter((s) => s.courseCode === code).map((s) => wibDay(s.start)));
  return announced(context, code).filter((meeting) => !sixDays.has(wibDay(meeting.start)));
}

/**
 * The online-class link for a class on a day: the one posted for that
 * meeting in EduNex text, else the course's latest online-class material
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
  };
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
 * EduNex Presence: a window open now (always on top: the action takes
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
      const countedIn = context.health.get(code)?.countedIn ?? "unknown";
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
 * afford to miss or that moved from its usual slot. A class with an EduNex
 * window open is already the Presence item.
 */
export const classProvider: NeedProvider = {
  area: "class",
  needs(context) {
    const { now } = context;
    const windows = openWindows(context.presence, now);
    const withWindow = (s: ClassSession) => windows.some((w) => w.code === s.courseCode && s.start < w.session.closesAt && w.session.opensAt < s.end);
    const out: NeedDraft[] = [];
    for (const session of classesLeftToday(context)) {
      if (withWindow(session)) continue;
      const facts = classFacts(context, session);
      const close = session.start <= now + STARTING_SOON;
      // An exam later today is the exams provider's (#77 schedule half), not a meeting to attend.
      const notable = !isExamActivity(session.activity) && (facts.state === "none" || facts.moved !== null);
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
      const base = { kind: "task", course: task.courseCode, at: task.dueAt, sources: ["edunex"], action: { kind: "go", route: { screen: "task", taskId: task.id } }, task } as const;
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

/** Meetings announced only in EduNex text, not on SIX's timetable, in the coming week. */
export const meetingProvider: NeedProvider = {
  area: "meeting",
  needs(context) {
    const { now } = context;
    return context.courses.flatMap((course) =>
      onlyInEdunex(context, course.code)
        .filter((m) => m.end > now && m.start - now <= AHEAD)
        .map(({ postedAt: _postedAt, ...meeting }): NeedDraft => ({
          id: `meeting:${course.code}:${meeting.start}`,
          kind: "meeting",
          course: course.code,
          band: meeting.start <= now + STARTING_SOON ? "now" : meeting.start - now <= 2 * DAY ? "soon" : "later",
          at: meeting.start,
          sources: ["edunex"],
          action: meeting.link ? { kind: "open", url: meeting.link, via: "link" } : courseRoute(course.code),
          meeting,
        })),
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
    const meetsToday = new Set(classesLeftToday(context).map((s) => s.courseCode));
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
        target: context.target,
      });
    }
    return out;
  },
};

/** In ranking order within a band. */
export const PROVIDERS: readonly NeedProvider[] = [presenceProvider, classProvider, taskProvider, meetingProvider, attendanceProvider];

// ---------------------------------------------------------------- today

export interface TodayPlan {
  /** SIX's meetings today, by start. */
  classes: ClassFacts[];
  /** The next class to start (today), for the countdown. */
  next: ClassSession | null;
  /** Meetings announced only in EduNex today and tomorrow. */
  announced: { code: string; meeting: AnnouncedMeeting }[];
  /** Open Tasks due today and tomorrow, soonest first. */
  due: Task[];
}

export function todayPlan(world: HomeWorld | HomeContext): TodayPlan {
  const context = "health" in world ? world : homeContext(world);
  const { now } = context;
  const day = today(context);
  const tomorrow = wibDay(now + DAY);
  const classes = (context.schedule ?? []).filter((s) => wibDay(s.start) === day).sort((a, b) => a.start - b.start).map((s) => classFacts(context, s));
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

// Change text is kept as catalog keys with language-free values, so it shows in
// the Student's language wherever it appears: times on this computer's clock
// (as alert text names them) and the date as "15/10".
const two = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) => `${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`;
const timeRange = (start: number, end: number) => `${clock(start)}–${clock(end)}`;
const dayMonth = (ms: number) => `${new Date(ms).getDate()}/${new Date(ms).getMonth() + 1}`;

/** Alert kinds that are changes (not reminders): what "What changed" lists from the history. */
const CHANGE_KINDS: ReadonlySet<AlertKind> = new Set(["newTask", "newMaterial", "taskEdited", "scheduleChanged", "meeting", "exam", "grade", "krs"]);

/** The id the change alert and the change list share for a Task edit. */
export const taskEditedId = (task: Pick<Task, "id" | "editedAt">) => `task.edited:${task.id}:${task.editedAt}`;
export const materialPostedId = (material: Pick<Material, "id">) => `material.posted:${material.id}`;

/** The text of a Task edit, as the alert and the list both say it. */
export function taskEditedText(task: Task): Pick<Alert, "title" | "body"> {
  return editedAfterSubmit(task)
    ? { title: { key: "alert.taskEdited.afterSubmit", vars: { course: task.courseCode } }, body: { key: "alert.taskEdited.afterSubmit.body", vars: { title: task.title } } }
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
      derived.push({ id: `task.new:${task.id}`, kind: "newTask", source: "edunex", at: task.postedAt, title: { key: "alert.newTask", vars: { course: task.courseCode } }, body: { key: "alert.plain", vars: { title: task.title } }, target });
    if (task.editedAt !== null) derived.push({ id: taskEditedId(task), kind: "taskEdited", source: "edunex", at: task.editedAt, ...taskEditedText(task), target });
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
      id: `schedule.moved:${session.id}:${session.start}:${session.room ?? ""}`,
      kind: "scheduleChanged",
      source: "six",
      at: now,
      title: { key: "home.change.moved", vars: { course: session.courseCode } },
      body: {
        key: change.usualStart !== null ? "home.change.moved.time" : "home.change.moved.room",
        vars: { date: dayMonth(session.start), time: timeRange(session.start, session.end), room: session.room ?? "", usual: change.usualStart !== null ? timeRange(change.usualStart, change.usualEnd!) : change.usualRoom ?? "" },
      },
      target: { screen: "schedule" },
    });
  }
  for (const course of context.courses)
    for (const meeting of onlyInEdunex(context, course.code))
      // Upcoming meetings, and ones held in the last week: an old meeting re-read in a text isn't news.
      if (meeting.postedAt !== null && meeting.end > now - RECENT)
        derived.push({
          id: `meeting:${course.code}:${meeting.start}`,
          kind: "meeting",
          source: "edunex",
          at: meeting.postedAt,
          title: { key: "home.change.meeting", vars: { course: course.code, number: meeting.number } },
          body: { key: "home.change.meeting.body", vars: { date: dayMonth(meeting.start), time: timeRange(meeting.start, meeting.end) } },
          target: { screen: "course", code: course.code, tab: "meetings" },
        });

  // The same event from the history and the datasets shows once, the history's version first.
  const sameness = (a: Alert) => `${a.kind}|${a.title.vars?.course ?? ""}|${a.body?.vars?.title ?? a.id}`;
  const seenIds = new Set<string>();
  const seenAs = new Set<string>();
  const out: Alert[] = [];
  for (const item of [...history.filter((a) => CHANGE_KINDS.has(a.kind)), ...derived]) {
    if (item.at > now || now - item.at > RECENT || seenIds.has(item.id) || seenAs.has(sameness(item))) continue;
    seenIds.add(item.id);
    seenAs.add(sameness(item));
    out.push(item);
  }
  return out.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}
