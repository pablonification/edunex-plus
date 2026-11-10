// What the home-screen widget says (D1): the phone's version of the desktop's tray menu
// (src/desktop/tray-menu.ts), from the same engine snapshot and the same core reasoning Beranda
// uses (src/core/needs.ts, held-back.ts), so the widget, Beranda and the tray never disagree.
// Pure, like the tray's: the data, the moment and the language in, the lines and where each tap
// goes out; ./view.tsx draws them. Only times of day and days, never "in 5 minutes": a widget
// doesn't tick.
//
//   the class     on now, or next (today, else the next day): its time, code, name and room
//   Tandai Hadir  while SIX shows it for a class on now; the Edunex Presence to fill in when it counts
//   needs you     Beranda's list with "Hari ini"'s deadlines in, without what's put off or handled
//   status        "Diperbarui pukul 14:05", or what's wrong (it opens the app, where the fix is)
//   today         the "Hari ini" widget (W13): today's classes (time, code, room; the one on now marked), each
//                 opening its sheet on Jadwal, and the next deadline
import { type AttendanceState, absenceBudget } from "../../../src/core/attendance";
import { checkingIn } from "../../../src/core/check-in";
import { courseTone, legacyAutomatic, resolveCourseColors } from "../../../src/core/course-colors";
import { wibDay } from "../../../src/core/course-meetings";
import { examParts, mergeExams } from "../../../src/core/exams";
import { makeFormat } from "../../../src/core/format";
import { heldBack } from "../../../src/core/held-back";
import { snapshotDataset, snapshotHomeWorld, snapshotTermCourses } from "../../../src/core/home-world";
import type { Lang, Settings } from "../../../src/core/models";
import { attentionWithToday, DUE_NOW, type HomeContext, homeContext, type NowCard, needsRange, nowCard, todayPlan } from "../../../src/core/needs";
import type { Route } from "../../../src/core/route";
import type { Snapshot } from "../../../src/core/snapshot";
import { type StringKey, translate, type Vars } from "../../../src/core/strings";
import { isOpenStatus, taskStatus } from "../../../src/core/tasks";
import { needAction, needLine, statusLine, type TrayAction } from "../../../src/desktop/tray-menu";

/** Where a tap goes: a screen of the app, an official page or a lecturer's link in the browser, SIX's check-in page, or the app as it was. */
export type WidgetTarget =
  | { kind: "route"; route: Route }
  | { kind: "url"; url: string }
  | { kind: "checkIn"; meetingId: string }
  /** A class on SIX's timetable: Jadwal on its day, its sheet open. */
  | { kind: "class"; sessionId: string }
  | { kind: "app" };

export interface WidgetLine {
  label: string;
  /** The when and where, in smaller type under it. */
  detail?: string;
  /** What a screen reader says for it, when the line alone doesn't say what a tap does. */
  a11y?: string;
  open: WidgetTarget;
}

export interface WidgetClass {
  /** "Sedang berlangsung", or "Kuliah berikutnya · Besok". */
  heading: string;
  live: boolean;
  code: string;
  name: string | null;
  /** Its course color as the desktop names it (`var(--course-blue)`): theme.course() gives the tone. */
  tone: string | undefined;
  /** "08:00–10:00". */
  time: string;
  /** The room and what kind of class it is, or which meeting ("Pertemuan 3"). */
  where: string | null;
  open: WidgetTarget;
}

export interface WidgetModel {
  theme: Settings["theme"];
  /** When the data was read, or what's wrong (`problem`: it comes first, and says what to fix in the app). */
  status: { text: string; problem: boolean };
  /** The class on now or next; a line instead when there's none in a week; null without a timetable (no SIX). */
  now: WidgetClass | WidgetLine | null;
  /** "Tandai Hadir" open in SIX for a class on now, and the Edunex Presence to fill in when doing it counts. */
  actions: WidgetLine[];
  /** "Perlu perhatianmu": every item, most pressing first (the widget shows as many as fit), or the line saying there's none. */
  needs: { heading: string; items: WidgetLine[]; empty: WidgetLine | null; all: WidgetLine | null } | null;
  /** When what it says next changes by itself (a class starts or ends, a window closes): the app draws it again then. */
  changesAt: number | null;
  /** The "Hari ini" widget's: null without a timetable (SIX not signed in). */
  today: WidgetToday | null;
}

export interface WidgetTodayClass {
  /** "08:00–10:00". */
  time: string;
  code: string;
  room: string | null;
  /** On now: marked. */
  live: boolean;
  /** Over: quiet. */
  past: boolean;
  tone: string | undefined;
  open: WidgetTarget;
}

export interface WidgetToday {
  /** "Hari ini · Kam 8 Okt". */
  heading: string;
  classes: WidgetTodayClass[];
  /** No class today: "Tidak ada kuliah hari ini.", opening Jadwal. */
  none: WidgetLine | null;
  /** The next Task due, still open: "Tenggat 23:59 · DK4073", its title; opens the Task. */
  deadline: WidgetLine | null;
}

type Translate = (key: StringKey, vars?: Vars) => string;

const HOME: WidgetTarget = { kind: "route", route: { screen: "home" } };

export function widgetModel(snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">, now: number): WidgetModel {
  const lang: Lang = snapshot.settings.lang;
  const t: Translate = (key, vars) => translate(lang, key, vars);
  const f = makeFormat(lang, now);
  const world = snapshotHomeWorld(snapshot, now);
  const context = world ? homeContext(world) : undefined;
  const card = context ? nowCard(context) : null;
  const status = statusLine(snapshot, f, t);
  return {
    theme: snapshot.settings.theme,
    status: status.problem?.type === "item" ? { text: status.problem.label, problem: true } : { text: status.updated ?? "", problem: false },
    now: context ? classLine(snapshot, card, context, f, t) : null,
    actions: actionLines(snapshot, card, now, f, t),
    needs: context ? needsLines(snapshot, context, card, f, t) : null,
    changesAt: earliest(changesAt(card, now), context ? todayTurnsAt(context, now) : null),
    today: context ? todayLines(snapshot, context, f, t) : null,
  };
}

const earliest = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));

/** The next moment a class of today's starts or ends: the widget marks the one on now. */
function todayTurnsAt(context: HomeContext, now: number): number | null {
  const plan = todayPlan(context);
  const moments = plan.classes.flatMap(({ session }) => [session.start, session.end]).filter((at) => at > now);
  return moments.length ? Math.min(...moments) : null;
}

/** "Hari ini": SIX's classes today, each opening its sheet, and the next open Task's deadline. */
function todayLines(snapshot: Pick<Snapshot, "datasets" | "statuses">, context: HomeContext, f: Format, t: Translate): WidgetToday | null {
  if (context.schedule === null) return null;
  const { now } = context;
  const plan = todayPlan(context);
  const codes = snapshotTermCourses(snapshot)?.map((c) => c.code) ?? [];
  const classes = plan.classes.map(({ session }) => ({
    time: f.timeRange(session.start, session.end),
    code: session.courseCode,
    room: session.room ?? null,
    live: session.start <= now && now < session.end,
    past: session.end <= now,
    tone: toneOf(snapshot, codes, session.courseCode),
    open: { kind: "class", sessionId: session.id } as WidgetTarget,
  }));
  const next = context.tasks
    .filter((task) => task.dueAt !== null && task.dueAt > now && isOpenStatus(taskStatus(task, now)))
    .sort((a, b) => a.dueAt! - b.dueAt!)[0];
  return {
    heading: `${t("home.today")} · ${f.weekdayShort(now)} ${f.dayMonth(now)}`,
    classes,
    none: classes.length ? null : { label: t("mobile.widget.todayNone"), open: { kind: "route", route: { screen: "schedule" } } },
    deadline: next
      ? {
          label: `${t("home.today.due")} ${f.dayOffset(next.dueAt!) === 0 ? f.time(next.dueAt!) : f.dayTime(next.dueAt!)} · ${next.courseCode}`,
          detail: next.title,
          open: { kind: "route", route: { screen: "task", taskId: next.id } },
        }
      : null,
  };
}

type Format = ReturnType<typeof makeFormat>;

/** The tray's "the class" section (classSection), in parts a widget lays out: the card's class or meeting, else "no class this week". */
function classLine(
  snapshot: Pick<Snapshot, "datasets" | "statuses">,
  card: NowCard | null,
  context: HomeContext,
  f: Format,
  t: Translate,
): WidgetClass | WidgetLine | null {
  const session = card?.class?.session ?? null;
  const meeting = card?.meeting ?? null;
  const slot = session ?? meeting?.meeting ?? null;
  if (!card || !slot) {
    if (card?.presence) return null;
    // Without SIX there's no timetable to say "no class" from (Beranda's "Hari ini" says how to get one).
    return context.schedule === null ? null : { label: t("home.now.free"), open: { kind: "route", route: { screen: "schedule" } } };
  }
  const code = session?.courseCode ?? meeting!.code;
  const courses = snapshotTermCourses(snapshot) ?? [];
  const course = courses.find((c) => c.code === code);
  const what = session
    ? [session.room, /^kuliah$/i.test(session.activity) ? null : session.activity]
    : [t(meeting!.meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting!.meeting.number })];
  const live = card.state === "live";
  return {
    heading: live ? t("tray.now") : t("home.now.later", { day: f.relativeDay(slot.start) }),
    live,
    code,
    name: course?.name ?? session?.courseName ?? null,
    tone: toneOf(
      snapshot,
      courses.map((c) => c.code),
      code,
    ),
    time: f.timeRange(slot.start, slot.end),
    where: what.filter((part): part is string => Boolean(part)).join(" · ") || null,
    open: { kind: "route", route: course?.edunex ? { screen: "course", code, tab: "meetings" } : { screen: "presence" } },
  };
}

/** The course's color, as the app draws it: the Student's pick, else its remembered automatic one (src/app/courses.ts). */
export function toneOf(snapshot: Pick<Snapshot, "datasets">, codes: readonly string[], code: string): string | undefined {
  if (!codes.includes(code)) return undefined;
  const saved = snapshotDataset(snapshot, "local.courseColors") ?? { picks: {}, automatic: legacyAutomatic(codes) };
  const color = resolveCourseColors(codes, saved).colors.get(code);
  return color ? courseTone(color.id) : undefined;
}

/** SIX's "Tandai Hadir" for any class on now, then the card's open Edunex Presence (as the tray lists them). */
function actionLines(snapshot: Pick<Snapshot, "datasets">, card: NowCard | null, now: number, f: Format, t: Translate): WidgetLine[] {
  const lines: WidgetLine[] = [];
  const student = snapshotDataset(snapshot, "six.student");
  const checkIns = snapshotDataset(snapshot, "six.checkIn") ?? {};
  const open = student ? (snapshotDataset(snapshot, "six.schedule") ?? []).filter((s) => checkIns[s.id]?.state === "open" && checkingIn(s, now)) : [];
  for (const s of open)
    lines.push({
      label: t("home.now.checkInOpen"),
      detail: s.courseCode,
      a11y: t("home.now.openSixLabel", { course: s.courseCode }),
      open: { kind: "checkIn", meetingId: s.id },
    });
  const presence = card?.presence;
  if (presence)
    lines.push({
      label: presence.noSix ? t("home.need.presenceNoSix", { course: presence.code }) : t("home.need.presence", { course: presence.code }),
      detail: capital(t("home.need.presence.closes", { time: f.dayTime(presence.session.closesAt) })),
      open:
        presence.activity === "assignment" && presence.task
          ? { kind: "route", route: { screen: "task", taskId: presence.task.id } }
          : { kind: "url", url: presence.url },
    });
  return lines;
}

/** The tray's "needs you" section (needsSection), every item rather than the first three: the widget fits what its size allows. */
function needsLines(
  snapshot: Pick<Snapshot, "datasets" | "statuses">,
  context: HomeContext,
  card: NowCard | null,
  f: Format,
  t: Translate,
): WidgetModel["needs"] {
  // Until Edunex's Tasks arrive, an empty list would claim more than the app knows (as on Beranda).
  const edunex = snapshot.statuses.find((status) => status.source === "edunex");
  if (snapshotDataset(snapshot, "edunex.tasks") === undefined && (edunex?.state ?? "signed-out") !== "signed-out") return null;
  const snoozes = snapshotDataset(snapshot, "local.snoozes") ?? [];
  const handled = snapshotDataset(snapshot, "local.done") ?? [];
  const { shown, snoozed, done } = heldBack(attentionWithToday(context, card), [], snoozes, handled, context.now);
  const heading = t("home.needs");
  if (!shown.length) {
    const range = needsRange(context);
    const label = snoozed.length
      ? t("home.needs.allSnoozed")
      : done.length
        ? t("home.needs.allHandled")
        : range.next !== null
          ? t("home.needs.noneElse")
          : t("home.needs.none", { count: range.days });
    return { heading, items: [], empty: { label, open: HOME }, all: null };
  }
  return {
    heading,
    items: shown.map((need) => {
      // The tray's own words for it, cut as the tray cuts them; the widget ends a line that still doesn't fit with "…".
      const { label, detail } = needLine(need, f, t);
      return { label, ...(detail ? { detail } : {}), open: targetOf(needAction(need)) };
    }),
    empty: null,
    all: { label: t("tray.needs.all", { count: shown.length }), open: HOME },
  };
}

/** A tray line's click as a widget tap: a need only ever opens a screen or a page. */
function targetOf(action: TrayAction): WidgetTarget {
  if (action.kind === "route") return action;
  if (action.kind === "url" || action.kind === "link") return { kind: "url", url: action.url };
  return HOME;
}

/** The next moment the card turns over by itself: its class starting or ending, its Presence window closing. */
function changesAt(card: NowCard | null, now: number): number | null {
  const slot = card?.class?.session ?? card?.meeting?.meeting ?? null;
  const moments = [slot?.start, slot?.end, card?.presence?.session.closesAt].filter((at): at is number => typeof at === "number" && at > now);
  return moments.length ? Math.min(...moments) : null;
}

/** "Tutup 09:30" under a title: a detail starts as a sentence does. */
function capital(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------- every widget (qa/superapp-widgets.md)
//
// One function per widget, each turning the saved data into exactly what that widget says: plain data (no functions,
// no colours, only the course's tone name), so an iPhone widget can be fed the same output as JSON. All of them start
// from one WidgetFacts, worked out once per drawing however many widgets are placed. Times of day and days only; each
// says when it next changes by itself (`changesAt`), and when the data was last read (`status`).

/** What every widget is showing: its data; nothing to show (with the words for it); not signed in to what it reads; a holiday. */
export type WidgetState = "ready" | "empty" | "signedOut" | "holiday";

/** The foot line: "Diperbarui pukul 14:05", or what's wrong (offline, signed out: `problem`, fixed in the app). */
export interface WidgetStatus {
  text: string;
  problem: boolean;
  /** When the newest read finished (ms), for a widget that writes its own "last read at". */
  at: number | null;
}

/** What every widget's function starts from: worked out once, then shared. Not for drawing: it holds the formatters. */
export interface WidgetFacts {
  now: number;
  lang: Lang;
  t: Translate;
  f: Format;
  snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">;
  context: HomeContext | undefined;
  card: NowCard | null;
  status: WidgetStatus;
  /** Every term course's code, for its colour. */
  codes: string[];
  signedIn: { six: boolean; edunex: boolean };
}

export function widgetFacts(snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">, now: number): WidgetFacts {
  const lang: Lang = snapshot.settings.lang;
  const t: Translate = (key, vars) => translate(lang, key, vars);
  const f = makeFormat(lang, now);
  const world = snapshotHomeWorld(snapshot, now);
  const context = world ? homeContext(world) : undefined;
  const line = statusLine(snapshot, f, t);
  const sources = snapshot.statuses.filter((status) => status.state !== "signed-out");
  const at = Math.max(0, ...sources.map((status) => status.updatedAt ?? 0)) || null;
  const signed = (source: "six" | "edunex") => sources.some((status) => status.source === source);
  return {
    now,
    lang,
    t,
    f,
    snapshot,
    context,
    card: context ? nowCard(context) : null,
    status: line.problem?.type === "item" ? { text: line.problem.label, problem: true, at } : { text: line.updated ?? "", problem: false, at },
    codes: snapshotTermCourses(snapshot)?.map((c) => c.code) ?? [],
    signedIn: { six: signed("six"), edunex: signed("edunex") },
  };
}

/** The next WIB midnight: a day's words ("Besok", "3 hari lagi") turn over then. */
function nextMidnight(now: number): number {
  return Date.parse(`${wibDay(now)}T00:00:00+07:00`) + DAY_MS;
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- Tenggat ("Due")

export interface DueRow {
  title: string;
  code: string;
  tone: string | undefined;
  /** "Hari ini, 23:59", "Jum, 13 Nov, 23:59". */
  when: string;
  /** Due within a day: drawn in the warning ink. */
  soon: boolean;
  open: WidgetTarget;
}

export interface DueWidget {
  state: WidgetState;
  /** "Tenggat". */
  heading: string;
  /** Every open Task with a deadline ahead, soonest first (the widget scrolls or fits what it can). */
  rows: DueRow[];
  /** The words when there are no rows: none due, or what to sign in to. */
  empty: WidgetLine | null;
  /** Tugas, for the heading's tap and "+3 lagi". */
  all: WidgetTarget;
  status: WidgetStatus;
  changesAt: number | null;
}

export function dueWidget(facts: WidgetFacts): DueWidget {
  const { t, f, now, snapshot } = facts;
  const all: WidgetTarget = { kind: "route", route: { screen: "tasks" } };
  const base = { heading: t("home.today.due"), all, status: facts.status };
  const tasks = snapshotDataset(snapshot, "edunex.tasks");
  if (tasks === undefined) {
    const signedOut = !facts.signedIn.edunex;
    return {
      ...base,
      state: signedOut ? "signedOut" : "empty",
      rows: [],
      empty: { label: signedOut ? t("action.signInTo", { source: t("source.edunex") }) : t("sync.checking"), open: HOME },
      changesAt: null,
    };
  }
  const open = tasks.filter((task) => task.dueAt !== null && task.dueAt > now && isOpenStatus(taskStatus(task, now))).sort((a, b) => a.dueAt! - b.dueAt!);
  const rows = open.map((task) => ({
    title: task.title,
    code: task.courseCode,
    tone: toneOf(snapshot, facts.codes, task.courseCode),
    when: f.dueLabel(task.dueAt!),
    soon: task.dueAt! - now <= DUE_NOW,
    open: { kind: "route", route: { screen: "task", taskId: task.id } } as WidgetTarget,
  }));
  // A deadline passing drops its row, one coming within a day turns it amber, midnight changes "Besok" to "Hari ini".
  const moments = open.flatMap((task) => [task.dueAt!, task.dueAt! - DUE_NOW]).filter((at) => at > now);
  return {
    ...base,
    state: rows.length ? "ready" : "empty",
    rows,
    empty: rows.length ? null : { label: t("tasks.empty.title"), open: all },
    changesAt: earliest(moments.length ? Math.min(...moments) : null, nextMidnight(now)),
  };
}

// ---------------------------------------------------------------- Kehadiran ("Attendance")

export interface AttendanceRow {
  code: string;
  name: string | null;
  tone: string | undefined;
  state: AttendanceState;
  /** Absences still allowed; negative past the limit; null without SIX's count. */
  left: number | null;
  /** "Sisa jatah absen 2×", "Jatah absen habis", "Lewat jatah absen 1×"; "-" without a count. What TalkBack says. */
  label: string;
  /** The same in a word or two, for the row: "Sisa 2×", "Habis", "Lewat 1×", "-". */
  short: string;
  open: WidgetTarget;
}

export interface AttendanceWidget {
  state: WidgetState;
  /** "Jatah absen". */
  heading: string;
  /** Every term course, the one nearest its limit first. */
  rows: AttendanceRow[];
  empty: WidgetLine | null;
  all: WidgetTarget;
  status: WidgetStatus;
  changesAt: number | null;
}

/** How near the limit, for the order: past it first, then none left, then one left. */
const RISK: Record<AttendanceState, number> = { out: 0, missed: 1, none: 2, risk: 3, safe: 4, met: 5, unknown: 6 };

export function attendanceWidget(facts: WidgetFacts): AttendanceWidget {
  const { t, context, snapshot } = facts;
  const all: WidgetTarget = { kind: "route", route: { screen: "presence" } };
  const base = { heading: t("presence.bar.label"), all, status: facts.status, changesAt: null };
  if (!facts.signedIn.six && !context?.courses.some((c) => c.six)) {
    return { ...base, state: "signedOut", rows: [], empty: { label: t("action.signInTo", { source: t("source.six") }), open: HOME } };
  }
  const courses = snapshotTermCourses(snapshot) ?? [];
  const rows = (context?.courses ?? [])
    .flatMap((course) => {
      const health = context?.health.get(course.code);
      if (!health) return [];
      const budget = absenceBudget(health);
      const label =
        health.state === "none"
          ? t("mobile.absence.none")
          : health.state === "out"
            ? t("mobile.absence.over", { count: budget?.over ?? 0 })
            : budget
              ? t("presence.budget.safe", { count: budget.left })
              : "-";
      const short =
        health.state === "none"
          ? t("mobile.widget.absencesNone")
          : health.state === "out"
            ? t("mobile.widget.absencesOver", { count: budget?.over ?? 0 })
            : budget
              ? t("mobile.widget.absencesLeft", { count: budget.left })
              : "-";
      return [
        {
          code: course.code,
          name: courses.find((c) => c.code === course.code)?.name ?? null,
          tone: toneOf(snapshot, facts.codes, course.code),
          state: health.state,
          left: health.absencesLeft,
          label,
          short,
          open: { kind: "route", route: { screen: "course", code: course.code } } as WidgetTarget,
        },
      ];
    })
    .sort((a, b) => RISK[a.state] - RISK[b.state] || (a.left ?? 99) - (b.left ?? 99) || a.code.localeCompare(b.code));
  return { ...base, state: rows.length ? "ready" : "empty", rows, empty: rows.length ? null : { label: t("presence.empty"), open: all } };
}

// ---------------------------------------------------------------- Ujian ("Exam")

export interface ExamWidget {
  state: WidgetState;
  /** The next exam, at its next sitting (a window at its close); null with none dated. */
  next: {
    /** "UTS DK4073". */
    title: string;
    code: string;
    tone: string | undefined;
    /** Whole days from today to it: 0 today, 1 tomorrow. */
    days: number;
    /** The big word: "5" with "hari lagi", or "Hari ini" / "Besok" alone (`unit` null). */
    big: string;
    unit: string | null;
    /** "Sen, 12 Okt, 08:00 · R.9009". */
    when: string;
    open: WidgetTarget;
  } | null;
  empty: WidgetLine | null;
  status: WidgetStatus;
  changesAt: number | null;
}

export function examWidget(facts: WidgetFacts): ExamWidget {
  const { t, f, now, context, snapshot } = facts;
  const base = { status: facts.status };
  if (!context) return { ...base, state: "signedOut", next: null, empty: { label: t("welcome.continueHint"), open: HOME }, changesAt: null };
  const exams = mergeExams({
    schedule: context.schedule ?? [],
    edunexExams: context.exams,
    tasks: context.tasks,
    courses: context.courses.map((c) => c.code),
    now,
  });
  const parts = exams
    .flatMap((exam) => {
      const [part] = examParts(exam, now, context.examMarks).filter((p) => p.kind !== "takehome");
      return part && part.at > now ? [{ exam, part }] : [];
    })
    .sort((a, b) => a.part.at - b.part.at);
  const first = parts[0];
  if (!first) {
    return {
      ...base,
      state: "empty",
      next: null,
      empty: { label: t("mobile.widget.examNone"), open: { kind: "route", route: { screen: "tasks" } } },
      changesAt: null,
    };
  }
  const { exam, part } = first;
  const start = part.kind === "window" ? (part.opensAt ?? part.at) : part.at;
  const days = Math.max(0, f.dayOffset(start));
  const room = "room" in part ? part.room : null;
  return {
    ...base,
    state: "ready",
    next: {
      title: `${t(`exam.kind.${exam.kind}`)} ${exam.courseCode}`,
      code: exam.courseCode,
      tone: toneOf(snapshot, facts.codes, exam.courseCode),
      days,
      big: days <= 1 ? f.relativeDay(start) : String(days),
      unit: days <= 1 ? null : t("mobile.calendar.daysLeft", { count: days }),
      when: [f.dueLabel(start), room].filter(Boolean).join(" · "),
      open: { kind: "route", route: { screen: "exam", examId: exam.id } },
    },
    empty: null,
    changesAt: earliest(part.at, nextMidnight(now)),
  };
}

// ---------------------------------------------------------------- Kelas berikutnya ("Next")

export interface NextWidget {
  state: WidgetState;
  /** The class on now while SIX shows Tandai Hadir for it, else the next to start (within a week). */
  next: {
    /** "10:00". */
    time: string;
    code: string;
    room: string | null;
    tone: string | undefined;
    /** "Hari ini" / "Besok" / "Sen, 12 Okt": said under the time when it isn't today. */
    day: string | null;
    /** On now, Tandai Hadir open: the cell turns green and a tap opens SIX's page. */
    checkIn: boolean;
    open: WidgetTarget;
    /** What TalkBack says. */
    a11y: string;
  } | null;
  empty: WidgetLine | null;
  status: WidgetStatus;
  changesAt: number | null;
}

export function nextWidget(facts: WidgetFacts): NextWidget {
  const { t, f, now, snapshot } = facts;
  const base = { status: facts.status };
  const schedule = facts.context?.schedule ?? null;
  if (schedule === null)
    return { ...base, state: "signedOut", next: null, empty: { label: t("action.signInTo", { source: t("source.six") }), open: HOME }, changesAt: null };
  const checkIns = snapshotDataset(snapshot, "six.checkIn") ?? {};
  const live = schedule.find((s) => checkIns[s.id]?.state === "open" && checkingIn(s, now));
  const ahead = schedule.filter((s) => s.start > now && s.start - now <= 7 * DAY_MS).sort((a, b) => a.start - b.start)[0];
  const session = live ?? ahead;
  if (!session) {
    return {
      ...base,
      state: "holiday",
      next: null,
      empty: { label: t("home.now.free"), open: { kind: "route", route: { screen: "schedule" } } },
      changesAt: nextMidnight(now),
    };
  }
  const offset = f.dayOffset(session.start);
  const checkIn = session === live;
  const open: WidgetTarget = checkIn ? { kind: "checkIn", meetingId: session.id } : { kind: "class", sessionId: session.id };
  return {
    ...base,
    state: "ready",
    next: {
      time: f.time(session.start),
      code: session.courseCode,
      room: session.room,
      tone: toneOf(snapshot, facts.codes, session.courseCode),
      day: offset === 0 ? null : f.relativeDay(session.start),
      checkIn,
      open,
      a11y: checkIn
        ? t("home.now.openSixLabel", { course: session.courseCode })
        : [f.relativeDay(session.start), f.timeRange(session.start, session.end), session.courseCode, session.room].filter(Boolean).join(", "),
    },
    empty: null,
    // It starts (the next one takes over once it has), or its check-in closes.
    changesAt: earliest(checkIn ? session.end : session.start, offset === 0 ? null : nextMidnight(now)),
  };
}

// ---------------------------------------------------------------- Pintasan ("Services")

/** The four places a student goes most, each with its Fluent icon (drawn by the view) and its own colour. */
export type ServiceIcon = "calendar" | "tasks" | "courses" | "grades";

export interface ServicesWidget {
  items: { label: string; icon: ServiceIcon; open: WidgetTarget }[];
}

export function servicesWidget(facts: Pick<WidgetFacts, "t">): ServicesWidget {
  const { t } = facts;
  const go = (route: Route): WidgetTarget => ({ kind: "route", route });
  return {
    items: [
      { label: t("nav.schedule"), icon: "calendar", open: go({ screen: "schedule" }) },
      { label: t("mobile.tab.tasks"), icon: "tasks", open: go({ screen: "tasks" }) },
      { label: t("mobile.tab.courses"), icon: "courses", open: go({ screen: "presence" }) },
      { label: t("nav.grades"), icon: "grades", open: go({ screen: "grades" }) },
    ],
  };
}

// ---------------------------------------------------------------- Satu mata kuliah ("Course")

export interface CourseWidget {
  state: WidgetState;
  /** The course shown: the one chosen, else the one with the next class. */
  course: {
    code: string;
    name: string | null;
    tone: string | undefined;
    open: WidgetTarget;
  } | null;
  /** Its next class: "Besok, 08:00–10:00 · R.9009", opening its sheet on Jadwal. */
  next: WidgetLine | null;
  /** Its absences ("Sisa jatah absen 2×"), in the state's ink. */
  absences: { label: string; state: AttendanceState } | null;
  /** Its next open Task: the title, "Tenggat Besok, 23:59". */
  task: WidgetLine | null;
  empty: WidgetLine | null;
  status: WidgetStatus;
  changesAt: number | null;
}

/** `code`: the course the Student chose for this widget (src/widget/choice.ts), or null for the one with the next class. */
export function courseWidget(facts: WidgetFacts, code: string | null): CourseWidget {
  const { t, f, now, context, snapshot } = facts;
  const base = { status: facts.status };
  const courses = snapshotTermCourses(snapshot) ?? [];
  if (!context || !courses.length) {
    return {
      ...base,
      state: "signedOut",
      course: null,
      next: null,
      absences: null,
      task: null,
      empty: { label: t("welcome.continueHint"), open: HOME },
      changesAt: null,
    };
  }
  const schedule = [...(context.schedule ?? [])].filter((s) => s.end > now).sort((a, b) => a.start - b.start);
  const chosen = courses.find((c) => c.code === code) ?? courses.find((c) => c.code === schedule[0]?.courseCode) ?? courses[0]!;
  const session = schedule.find((s) => s.courseCode === chosen.code && s.start - now <= 14 * DAY_MS);
  const health = context.health.get(chosen.code);
  const budget = health ? absenceBudget(health) : null;
  const task = context.tasks
    .filter((one) => one.courseCode === chosen.code && one.dueAt !== null && one.dueAt > now && isOpenStatus(taskStatus(one, now)))
    .sort((a, b) => a.dueAt! - b.dueAt!)[0];
  return {
    ...base,
    state: "ready",
    course: {
      code: chosen.code,
      name: chosen.name ?? null,
      tone: toneOf(snapshot, facts.codes, chosen.code),
      open: { kind: "route", route: chosen.edunex ? { screen: "course", code: chosen.code } : { screen: "presence" } },
    },
    next: session
      ? { label: [f.dayTimeRange(session.start, session.end), session.room].filter(Boolean).join(" · "), open: { kind: "class", sessionId: session.id } }
      : null,
    absences:
      health && health.state !== "unknown"
        ? {
            state: health.state,
            label:
              health.state === "none"
                ? t("mobile.absence.none")
                : health.state === "out"
                  ? t("mobile.absence.over", { count: budget?.over ?? 0 })
                  : budget
                    ? t("presence.budget.safe", { count: budget.left })
                    : "-",
          }
        : null,
    task: task
      ? { label: task.title, detail: `${t("home.today.due")} ${f.dueLabel(task.dueAt!)}`, open: { kind: "route", route: { screen: "task", taskId: task.id } } }
      : null,
    empty: null,
    changesAt: earliest(earliest(session ? (session.start > now ? session.start : session.end) : null, task?.dueAt ?? null), nextMidnight(now)),
  };
}
