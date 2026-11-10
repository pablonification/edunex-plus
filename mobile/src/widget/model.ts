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
import type { ClassSession, Lang, Settings } from "../../../src/core/models";
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
  /** The same in a button's few words, where the label would be cut ("Tandai Hadir"). */
  short?: string;
  /** The when and where, in smaller type under it. */
  detail?: string;
  /** What a screen reader says for it, when the line alone doesn't say what a tap does. */
  a11y?: string;
  open: WidgetTarget;
}

export interface WidgetClass {
  /** "Sedang berlangsung", or "Kuliah berikutnya · Besok". */
  heading: string;
  /** What the block says first, true until `changesAt`: "Sedang berlangsung", "Mulai 11:00", "Besok 08:00". */
  lead: string;
  /** "selesai 10:00": said beside "Sedang berlangsung", so "now" always carries when it stops being true. */
  ends: string;
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
  /** When the data was last right ("Diperbarui pukul 14:05", with the day when it isn't today), or what's wrong (`problem`). Never "Memperbarui…". */
  status: { text: string; problem: boolean; offline?: boolean; at?: number | null };
  /** "Sekarang" and "Hari ini" with nothing of their own to show (signed out, a holiday): the one shared layout's words. */
  quiet: { now: WidgetQuiet | null; today: WidgetQuiet | null };
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
  /** "08:00", where the range doesn't fit. */
  start: string;
  /** "10:00": said on the row that's on now. */
  end: string;
  code: string;
  /** The course's name, whole: what a row says first (the code only without one). */
  name: string | null;
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
  /** The next day with classes (within a week), for the room under today's: "Besok", "Sen, 12 Okt". */
  next: { heading: string; classes: WidgetTodayClass[] } | null;
}

/** What every widget is showing: its data; nothing to show (with the words for it); not signed in to what it reads; a holiday. */
export type WidgetState = "ready" | "empty" | "signedOut" | "holiday";

/** A widget with nothing of its own to show, the same on all eight: its name, one sentence that's true, one thing to tap. */
export interface WidgetQuiet {
  state: Exclude<WidgetState, "ready">;
  /** The widget's own name: "Tenggat". */
  name: string;
  /** One sentence. */
  label: string;
  /** The same in a word or two, for a cell that holds no more: "Libur". */
  short: string;
  /** The one thing to tap, in its words: "Masuk", "Buka Jadwal". */
  action: string;
  open: WidgetTarget;
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
  const cls = context ? classLine(snapshot, card, context, f, t) : null;
  const actions = actionLines(snapshot, card, now, f, t);
  const needs = context ? needsLines(snapshot, context, card, f, t) : null;
  const today = context ? todayLines(snapshot, context, f, t) : null;
  const schedule = context?.schedule ?? null;
  // A holiday: SIX's timetable is read and holds no class in the week ahead.
  const holiday = schedule !== null && !card?.class && !card?.meeting && !schedule.some((s) => s.end > now && s.start - now <= 7 * DAY_MS);
  const names = { now: t("mobile.widget.name.now"), today: t("home.today") };
  const status = widgetStatus(snapshot, f, t);
  const signedOut = (name: string): WidgetQuiet => quietOf(t, name, "signedOut", context ? "six" : null);
  return {
    theme: snapshot.settings.theme,
    // The text and whether it's a problem, as before (the iPhone reads these two); `offline` only when it is.
    status: { text: status.text, problem: status.problem, ...(status.offline ? { offline: true } : {}) },
    quiet: {
      now: !context
        ? signedOut(names.now)
        : holiday && !actions.length
          ? quietOf(t, names.now, "holiday")
          : schedule === null && !actions.length && !needs?.items.length
            ? signedOut(names.now)
            : null,
      today: !context || schedule === null ? signedOut(names.today) : holiday ? quietOf(t, names.today, "holiday") : null,
    },
    now: cls,
    actions,
    needs,
    // The card turning over, a class of today's starting or ending, and midnight ("Besok 08:00" becomes "Mulai 08:00").
    changesAt: earliest(earliest(changesAt(card, now), context ? todayTurnsAt(context, now) : null), context ? nextMidnight(now) : null),
    today,
  };
}

/**
 * The foot, one form on every widget: when the data was last right ("Diperbarui pukul 14:05", with the day when it
 * isn't today), or what's wrong. Never "Memperbarui…": a widget is a picture, and that word would stay on it.
 */
export function widgetStatus(snapshot: Pick<Snapshot, "datasets" | "statuses">, f: Format, t: Translate): WidgetStatus {
  const line = statusLine(snapshot, f, t);
  const sources = snapshot.statuses.filter((status) => (status.source === "edunex" || status.source === "six") && status.state !== "signed-out");
  const at = Math.max(0, ...sources.map((status) => status.updatedAt ?? 0)) || null;
  const today = at !== null && f.dayOffset(at) === 0;
  const offline = sources.some((status) => status.state === "offline");
  // What comes before "offline" in the app's own order: a source to sign in to again, or one that wants the Student.
  const other = sources.some((status) => status.state === "changed" || status.state === "expired" || status.state === "action-needed");
  const ended = (["edunex", "six"] as const).some(
    (source) =>
      !sources.some((status) => status.source === source) && snapshotDataset(snapshot, source === "edunex" ? "edunex.account" : "six.student") !== undefined,
  );
  if (offline && !other && !ended)
    return {
      text: at === null ? t("status.offline") : t("mobile.widget.offline", { when: today ? f.time(at) : f.dayTimeWord(at) }),
      problem: true,
      offline: true,
      at,
    };
  if (line.problem?.type === "item") return { text: line.problem.label, problem: true, at };
  return { text: at === null ? "" : today ? t("tray.updatedAt", { time: f.time(at) }) : t("status.updated", { when: f.dayTimeWord(at) }), problem: false, at };
}

/** The shared words of a widget with nothing to show (WidgetQuiet). `source`: what to sign in to (null: either). */
function quietOf(
  t: Translate,
  name: string,
  state: WidgetQuiet["state"],
  source: "six" | "edunex" | null = null,
  empty?: { label: string; short: string; place: string; open: WidgetTarget },
): WidgetQuiet {
  if (state === "signedOut")
    return {
      state,
      name,
      label: source ? t("mobile.widget.signedOut", { source: t(`source.${source}`) }) : t("mobile.widget.signedOutAny"),
      short: t("mobile.widget.signedOutShort"),
      action: t("action.signIn"),
      open: HOME,
    };
  if (state === "holiday" || !empty)
    return {
      state: "holiday",
      name,
      label: t("mobile.widget.holiday"),
      short: t("mobile.widget.holidayShort"),
      action: t("mobile.widget.open", { place: t("nav.schedule") }),
      open: { kind: "route", route: { screen: "schedule" } },
    };
  return { state, name, label: empty.label, short: empty.short, action: t("mobile.widget.open", { place: empty.place }), open: empty.open };
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
  const courses = snapshotTermCourses(snapshot) ?? [];
  const codes = courses.map((c) => c.code);
  const row = (session: ClassSession): WidgetTodayClass => ({
    time: f.timeRange(session.start, session.end),
    start: f.time(session.start),
    end: f.time(session.end),
    code: session.courseCode,
    name: courses.find((c) => c.code === session.courseCode)?.name ?? session.courseName ?? null,
    room: session.room ?? null,
    live: session.start <= now && now < session.end,
    past: session.end <= now,
    tone: toneOf(snapshot, codes, session.courseCode),
    open: { kind: "class", sessionId: session.id } as WidgetTarget,
  });
  const classes = plan.classes.map(({ session }) => row(session));
  // The next day with classes, within a week: what a taller widget goes on to, and what's left to say once today's are over.
  const tomorrow = nextMidnight(now);
  const ahead = context.schedule.filter((s) => s.start >= tomorrow && s.start - now <= 7 * DAY_MS).sort((a, b) => a.start - b.start);
  const nextDay = ahead.length ? ahead.filter((s) => wibDay(s.start) === wibDay(ahead[0]!.start)) : [];
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
    next: nextDay.length ? { heading: f.relativeDay(nextDay[0]!.start), classes: nextDay.map(row) } : null,
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
    lead: live
      ? t("tray.now")
      : f.dayOffset(slot.start) === 0
        ? t("mobile.widget.starts", { time: f.time(slot.start) })
        : `${f.relativeDay(slot.start)} ${f.time(slot.start)}`,
    ends: t("mobile.widget.ends", { time: f.time(slot.end) }),
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
      short: t("mobile.notification.checkIn"),
      detail: s.courseCode,
      a11y: t("home.now.openSixLabel", { course: s.courseCode }),
      open: { kind: "checkIn", meetingId: s.id },
    });
  const presence = card?.presence;
  if (presence)
    lines.push({
      label: presence.noSix ? t("home.need.presenceNoSix", { course: presence.code }) : t("home.need.presence", { course: presence.code }),
      // The button's word, as on every screen: the class it's for is named right above it.
      short: t("presence.open.fill"),
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

/** The foot line: "Diperbarui pukul 14:05", or what's wrong (offline, signed out: `problem`, fixed in the app). */
export interface WidgetStatus {
  text: string;
  problem: boolean;
  /** When the newest read finished (ms), for a widget that writes its own "last read at". */
  at: number | null;
  /** Not reached at the last try: the data stays, the foot says from when, and nothing that needs the network is offered. */
  offline?: boolean;
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
  const sources = snapshot.statuses.filter((status) => status.state !== "signed-out");
  const signed = (source: "six" | "edunex") => sources.some((status) => status.source === source);
  return {
    now,
    lang,
    t,
    f,
    snapshot,
    context,
    card: context ? nowCard(context) : null,
    status: widgetStatus(snapshot, f, t),
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
  /** The course's name, whole; null when SIX doesn't list it. */
  name: string | null;
  /** "Hari ini, 23:59", "Jum, 13 Nov, 23:59". */
  when: string;
  /** What a row leads with: "Hari ini", "Besok", "Jum, 16 Okt"; then "23:59". */
  day: string;
  time: string;
  /** Due today or tomorrow: marked. */
  mark: "today" | "tomorrow" | null;
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
  /** Nothing to list: the shared layout's words. */
  quiet: WidgetQuiet | null;
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
    // Signed in, the Tasks not read yet: "no data yet", not a list that claims there are none.
    const quiet = facts.signedIn.edunex
      ? quietOf(t, base.heading, "empty", null, { label: t("status.neverUpdated"), short: t("status.neverUpdated"), place: t("mobile.tab.tasks"), open: all })
      : quietOf(t, base.heading, "signedOut", "edunex");
    return { ...base, state: quiet.state, rows: [], quiet, empty: { label: quiet.label, open: quiet.open }, changesAt: null };
  }
  const courses = snapshotTermCourses(snapshot) ?? [];
  const open = tasks.filter((task) => task.dueAt !== null && task.dueAt > now && isOpenStatus(taskStatus(task, now))).sort((a, b) => a.dueAt! - b.dueAt!);
  const rows = open.map((task) => ({
    title: task.title,
    code: task.courseCode,
    tone: toneOf(snapshot, facts.codes, task.courseCode),
    name: courses.find((c) => c.code === task.courseCode)?.name ?? null,
    when: f.dueLabel(task.dueAt!),
    day: f.relativeDay(task.dueAt!),
    time: f.time(task.dueAt!),
    mark: f.dayOffset(task.dueAt!) === 0 ? ("today" as const) : f.dayOffset(task.dueAt!) === 1 ? ("tomorrow" as const) : null,
    soon: task.dueAt! - now <= DUE_NOW,
    open: { kind: "route", route: { screen: "task", taskId: task.id } } as WidgetTarget,
  }));
  // A deadline passing drops its row, one coming within a day turns it amber, midnight changes "Besok" to "Hari ini".
  const moments = open.flatMap((task) => [task.dueAt!, task.dueAt! - DUE_NOW]).filter((at) => at > now);
  const quiet = rows.length
    ? null
    : quietOf(t, base.heading, "empty", null, {
        label: t("mobile.widget.dueNone"),
        short: t("mobile.widget.dueNone"),
        place: t("mobile.tab.tasks"),
        open: all,
      });
  return {
    ...base,
    state: rows.length ? "ready" : "empty",
    rows,
    quiet,
    empty: quiet ? { label: quiet.label, open: quiet.open } : null,
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
  /** The marks a row draws: the absences this term allows and how many are used (both null without a count), and how many past it. */
  allowed: number | null;
  used: number | null;
  over: number;
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
  quiet: WidgetQuiet | null;
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
    const quiet = quietOf(t, base.heading, "signedOut", "six");
    return { ...base, state: "signedOut", rows: [], quiet, empty: { label: quiet.label, open: quiet.open } };
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
          allowed: budget?.allowed ?? null,
          used: budget?.used ?? null,
          over: budget?.over ?? 0,
          label,
          short,
          open: { kind: "route", route: { screen: "course", code: course.code } } as WidgetTarget,
        },
      ];
    })
    .sort((a, b) => RISK[a.state] - RISK[b.state] || (a.left ?? 99) - (b.left ?? 99) || a.code.localeCompare(b.code));
  const quiet = rows.length
    ? null
    : quietOf(t, base.heading, "empty", null, { label: t("presence.empty"), short: t("presence.empty"), place: t("mobile.tab.courses"), open: all });
  return { ...base, state: rows.length ? "ready" : "empty", rows, quiet, empty: quiet ? { label: quiet.label, open: quiet.open } : null };
}

// ---------------------------------------------------------------- Ujian ("Exam")

export interface ExamWidget {
  state: WidgetState;
  /** The next exam, at its next sitting (a window at its close); null with none dated. */
  next: {
    /** "UTS DK4073". */
    title: string;
    /** "UTS": the exam's kind alone, said before the course's name. */
    kind: string;
    code: string;
    /** The course's name, whole; null when SIX doesn't list the course. */
    name: string | null;
    tone: string | undefined;
    /** Whole days from today to it: 0 today, 1 tomorrow. */
    days: number;
    /** The big word: "5" with "hari lagi", or "Hari ini" / "Besok" alone (`unit` null). */
    big: string;
    unit: string | null;
    /** "Sen, 12 Okt, 08:00 · R.9009". */
    when: string;
    /** What the widget leads with: "Kam, 15 Okt" ("Besok", "Hari ini"), then "11:00". True all day, unlike a count. */
    day: string;
    time: string;
    room: string | null;
    /** The count, quiet beside the day: "7 hari lagi"; null today and tomorrow (the day says it). */
    left: string | null;
    open: WidgetTarget;
  } | null;
  /** The exams after it, soonest first, for a taller widget. */
  more: { title: string; kind: string; name: string | null; code: string; tone: string | undefined; day: string; time: string; open: WidgetTarget }[];
  quiet: WidgetQuiet | null;
  empty: WidgetLine | null;
  status: WidgetStatus;
  changesAt: number | null;
}

export function examWidget(facts: WidgetFacts): ExamWidget {
  const { t, f, now, context, snapshot } = facts;
  const base = { status: facts.status };
  const widgetName = t("mobile.widget.name.exam");
  if (!context) {
    const quiet = quietOf(t, widgetName, "signedOut");
    return { ...base, state: "signedOut", next: null, more: [], quiet, empty: { label: quiet.label, open: quiet.open }, changesAt: null };
  }
  const courses = snapshotTermCourses(snapshot) ?? [];
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
    const quiet = quietOf(t, widgetName, "empty", null, {
      label: t("mobile.widget.examNone"),
      short: t("mobile.widget.examNone"),
      place: t("mobile.tab.tasks"),
      open: { kind: "route", route: { screen: "tasks" } },
    });
    return { ...base, state: "empty", next: null, more: [], quiet, empty: { label: quiet.label, open: quiet.open }, changesAt: null };
  }
  const startOf = (part: (typeof parts)[number]["part"]) => (part.kind === "window" ? (part.opensAt ?? part.at) : part.at);
  const { exam, part } = first;
  const start = part.kind === "window" ? (part.opensAt ?? part.at) : part.at;
  const days = Math.max(0, f.dayOffset(start));
  const room = "room" in part ? part.room : null;
  return {
    ...base,
    state: "ready",
    next: {
      title: `${t(`exam.kind.${exam.kind}`)} ${exam.courseCode}`,
      kind: t(`exam.kind.${exam.kind}`),
      code: exam.courseCode,
      name: courses.find((c) => c.code === exam.courseCode)?.name ?? null,
      tone: toneOf(snapshot, facts.codes, exam.courseCode),
      day: f.relativeDay(start),
      time: f.time(start),
      room: room ?? null,
      left: days <= 1 ? null : `${days} ${t("mobile.calendar.daysLeft", { count: days })}`,
      days,
      big: days <= 1 ? f.relativeDay(start) : String(days),
      unit: days <= 1 ? null : t("mobile.calendar.daysLeft", { count: days }),
      when: [f.dueLabel(start), room].filter(Boolean).join(" · "),
      open: { kind: "route", route: { screen: "exam", examId: exam.id } },
    },
    more: parts.slice(1).map((one) => ({
      title: `${t(`exam.kind.${one.exam.kind}`)} ${one.exam.courseCode}`,
      kind: t(`exam.kind.${one.exam.kind}`),
      name: courses.find((c) => c.code === one.exam.courseCode)?.name ?? null,
      code: one.exam.courseCode,
      tone: toneOf(snapshot, facts.codes, one.exam.courseCode),
      day: f.relativeDay(startOf(one.part)),
      time: f.time(startOf(one.part)),
      open: { kind: "route", route: { screen: "exam", examId: one.exam.id } } as WidgetTarget,
    })),
    quiet: null,
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
    /** The big word: the time, or "Tandai Hadir" while it's open. */
    big: string;
    code: string;
    /** The course's name, whole, for a cell big enough to say it. */
    name: string | null;
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
  quiet: WidgetQuiet | null;
  empty: WidgetLine | null;
  status: WidgetStatus;
  changesAt: number | null;
}

export function nextWidget(facts: WidgetFacts): NextWidget {
  const { t, f, now, snapshot, card } = facts;
  const base = { status: facts.status };
  const schedule = facts.context?.schedule ?? null;
  const widgetName = t("mobile.widget.name.next");
  if (schedule === null) {
    const quiet = quietOf(t, widgetName, "signedOut", facts.context ? "six" : null);
    return { ...base, state: "signedOut", next: null, quiet, empty: { label: quiet.label, short: quiet.short, open: quiet.open }, changesAt: null };
  }
  const checkIns = snapshotDataset(snapshot, "six.checkIn") ?? {};
  const live = schedule.find((s) => checkIns[s.id]?.state === "open" && checkingIn(s, now));
  const slot = live ? { kind: "checkIn" as const, session: live } : upcoming(card, schedule, now);
  if (!slot) {
    const quiet = quietOf(t, widgetName, "holiday");
    return { ...base, state: "holiday", next: null, quiet, empty: { label: quiet.label, short: quiet.short, open: quiet.open }, changesAt: nextMidnight(now) };
  }
  const { start, end, code, room } =
    slot.kind === "meeting"
      ? {
          ...slot.meeting,
          code: slot.code,
          room: t(slot.meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: slot.meeting.number }),
        }
      : { start: slot.session.start, end: slot.session.end, code: slot.session.courseCode, room: slot.session.room };
  const offset = f.dayOffset(start);
  const open: WidgetTarget =
    slot.kind === "checkIn"
      ? { kind: "checkIn", meetingId: slot.session.id }
      : slot.kind === "class"
        ? { kind: "class", sessionId: slot.session.id }
        : { kind: "route", route: { screen: "course", code, tab: "meetings" } };
  return {
    ...base,
    state: "ready",
    next: {
      time: f.time(start),
      big: slot.kind === "checkIn" ? t("mobile.notification.checkIn") : f.time(start),
      code,
      name: (snapshotTermCourses(snapshot) ?? []).find((c) => c.code === code)?.name ?? null,
      room,
      tone: toneOf(snapshot, facts.codes, code),
      day: offset === 0 ? null : f.relativeDay(start),
      checkIn: slot.kind === "checkIn",
      open,
      a11y:
        slot.kind === "checkIn"
          ? t("home.now.openSixLabel", { course: code })
          : [f.relativeDay(start), f.timeRange(start, end), code, room].filter(Boolean).join(", "),
    },
    quiet: null,
    empty: null,
    // It starts (the next one takes over once it has), or its check-in closes; a day's word turns over at midnight.
    changesAt: earliest(slot.kind === "checkIn" ? end : start, offset === 0 ? null : nextMidnight(now)),
  };
}

type Upcoming =
  | { kind: "class"; session: ClassSession }
  | { kind: "meeting"; code: string; meeting: { start: number; end: number; number: number; online: boolean } };

/**
 * The next class to start, as "Sekarang" picks it (a meeting only Edunex announced counts too): the card's own when it
 * isn't on yet, else SIX's next after the one on now, within a week.
 */
function upcoming(card: NowCard | null, schedule: readonly ClassSession[], now: number): Upcoming | null {
  if (card && card.state !== "live") {
    if (card.class && card.class.session.start > now) return { kind: "class", session: card.class.session };
    if (card.meeting && card.meeting.meeting.start > now) return { kind: "meeting", code: card.meeting.code, meeting: card.meeting.meeting };
  }
  const ahead = schedule.filter((s) => s.start > now && s.start - now <= 7 * DAY_MS).sort((a, b) => a.start - b.start)[0];
  return ahead ? { kind: "class", session: ahead } : null;
}

// ---------------------------------------------------------------- Pintasan ("Services")

/** The four places a student goes most, each with its Fluent icon (drawn by the view) and its own colour. */
export type ServiceIcon = "calendar" | "tasks" | "courses" | "grades";

export interface ServicesWidget {
  items: {
    label: string;
    icon: ServiceIcon;
    /** The tile's one live figure: classes left today, Tasks due within a week, courses at or past their absence limit, the IPK. Null when it isn't known (the tile is then its icon and word), or when it's zero and `good`. */
    figure: string | null;
    /** Nothing left, nothing due, no course at its limit: a mark, never a "0". */
    good: boolean;
    /** What TalkBack says: "Jadwal, 2 kuliah lagi hari ini". */
    a11y: string;
    open: WidgetTarget;
  }[];
  status: WidgetStatus;
  changesAt: number | null;
}

export function servicesWidget(facts: Pick<WidgetFacts, "t"> & Partial<WidgetFacts>): ServicesWidget {
  const { t, context, snapshot, now, f } = facts;
  const go = (route: Route): WidgetTarget => ({ kind: "route", route });
  const known = context !== undefined && now !== undefined;
  // Classes of today's not over yet (null without SIX's timetable).
  const classes = known && context.schedule !== null ? todayPlan(context).classes.filter(({ session }) => session.end > now) : null;
  const tasks = known && snapshot && snapshotDataset(snapshot, "edunex.tasks") !== undefined ? context.tasks : null;
  const due =
    tasks && known
      ? tasks.filter((task) => task.dueAt !== null && task.dueAt > now && task.dueAt - now <= 7 * DAY_MS && isOpenStatus(taskStatus(task, now)))
      : null;
  const health = known && context.schedule !== null ? context.courses.flatMap((course) => context.health.get(course.code) ?? []) : null;
  const atLimit = health?.length ? health.filter((one) => one.state === "none" || one.state === "out").length : null;
  const transcript = snapshot ? snapshotDataset(snapshot, "six.transcript") : undefined;
  const ipk = transcript ? (transcript.ipk.six ?? transcript.ipk.computed) : null;
  const tile = (label: string, icon: ServiceIcon, count: number | null, said: string, route: Route) => ({
    label,
    icon,
    figure: count === null || count === 0 ? null : String(count),
    good: count === 0,
    a11y: count === null ? label : `${label}, ${said}`,
    open: go(route),
  });
  const moments = known
    ? [
        ...(classes ?? []).map(({ session }) => session.end),
        ...(due ?? []).map((task) => task.dueAt!),
        ...(tasks ?? []).map((task) => (task.dueAt ?? 0) - 7 * DAY_MS),
      ].filter((at) => at > now)
    : [];
  return {
    items: [
      tile(t("nav.schedule"), "calendar", classes ? classes.length : null, t("mobile.widget.svc.classes", { count: classes?.length ?? 0 }), {
        screen: "schedule",
      }),
      tile(t("mobile.tab.tasks"), "tasks", due ? due.length : null, t("mobile.widget.svc.due", { count: due?.length ?? 0 }), { screen: "tasks" }),
      tile(t("mobile.tab.courses"), "courses", atLimit, t("mobile.widget.svc.limit", { count: atLimit ?? 0 }), { screen: "presence" }),
      {
        label: t("nav.grades"),
        icon: "grades",
        figure: typeof ipk === "number" && f ? f.number(ipk) : null,
        good: false,
        a11y: typeof ipk === "number" && f ? `${t("nav.grades")}, ${t("mobile.widget.svc.ipk", { value: f.number(ipk) })}` : t("nav.grades"),
        open: go({ screen: "grades" }),
      },
    ],
    status: facts.status ?? { text: "", problem: false, at: null },
    // A class of today's ending, a deadline passing or coming within the week, and midnight (today's classes are tomorrow's).
    changesAt: known ? earliest(moments.length ? Math.min(...moments) : null, nextMidnight(now)) : null,
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
  /** Its next class: "Besok, 08:00–10:00 · R.9009", opening its sheet on Jadwal; `short` "Besok 08:00" for a narrow widget. */
  next: (WidgetLine & { short: string }) | null;
  /** Its absences ("Sisa jatah absen 2×", or "Sisa 2×" narrow), in the state's ink. */
  absences: { label: string; short: string; state: AttendanceState } | null;
  /** The same as marks: the absences the term allows, how many are used, how many past the limit. Null without SIX's count. */
  marks: { allowed: number; used: number; over: number } | null;
  /** Its next open Task: the title, "Tenggat Besok, 23:59". */
  task: WidgetLine | null;
  quiet: WidgetQuiet | null;
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
    const name = t("mobile.widget.name.course");
    const quiet = context
      ? quietOf(t, name, "empty", null, {
          label: t("presence.empty"),
          short: t("presence.empty"),
          place: t("mobile.tab.courses"),
          open: { kind: "route", route: { screen: "presence" } },
        })
      : quietOf(t, name, "signedOut");
    return {
      ...base,
      state: quiet.state,
      course: null,
      next: null,
      absences: null,
      marks: null,
      task: null,
      quiet,
      empty: { label: quiet.label, open: quiet.open },
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
      ? {
          // On now: "Sedang berlangsung" with when it ends, never a bare "Hari ini, 08:00" that reads as still to come.
          label: [
            session.start <= now ? `${t("tray.now")} · ${t("mobile.widget.ends", { time: f.time(session.end) })}` : f.dayTimeRange(session.start, session.end),
            session.room,
          ]
            .filter(Boolean)
            .join(" · "),
          short:
            session.start <= now
              ? `${t("tray.now")} · ${t("mobile.widget.ends", { time: f.time(session.end) })}`
              : f.dayOffset(session.start) === 0
                ? t("mobile.widget.starts", { time: f.time(session.start) })
                : `${f.relativeDay(session.start)} ${f.time(session.start)}`,
          open: { kind: "class", sessionId: session.id },
        }
      : null,
    marks: budget ? { allowed: budget.allowed, used: budget.used, over: budget.over } : null,
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
            short:
              health.state === "none"
                ? t("mobile.widget.absencesNone")
                : health.state === "out"
                  ? t("mobile.widget.absencesOver", { count: budget?.over ?? 0 })
                  : budget
                    ? t("mobile.widget.absencesLeft", { count: budget.left })
                    : "-",
          }
        : null,
    task: task
      ? { label: task.title, detail: `${t("home.today.due")} ${f.dueLabel(task.dueAt!)}`, open: { kind: "route", route: { screen: "task", taskId: task.id } } }
      : null,
    quiet: null,
    empty: null,
    changesAt: earliest(earliest(session ? (session.start > now ? session.start : session.end) : null, task?.dueAt ?? null), nextMidnight(now)),
  };
}
