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
import { checkingIn } from "../../../src/core/check-in";
import { courseTone, legacyAutomatic, resolveCourseColors } from "../../../src/core/course-colors";
import { makeFormat } from "../../../src/core/format";
import { heldBack } from "../../../src/core/held-back";
import { snapshotDataset, snapshotHomeWorld, snapshotTermCourses } from "../../../src/core/home-world";
import type { Lang, Settings } from "../../../src/core/models";
import { attentionWithToday, type HomeContext, homeContext, type NowCard, needsRange, nowCard } from "../../../src/core/needs";
import type { Route } from "../../../src/core/route";
import type { Snapshot } from "../../../src/core/snapshot";
import { type StringKey, translate, type Vars } from "../../../src/core/strings";
import { needAction, needLine, statusLine, type TrayAction } from "../../../src/desktop/tray-menu";

/** Where a tap goes: a screen of the app, an official page or a lecturer's link in the browser, SIX's check-in page, or the app as it was. */
export type WidgetTarget = { kind: "route"; route: Route } | { kind: "url"; url: string } | { kind: "checkIn"; meetingId: string } | { kind: "app" };

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
    changesAt: changesAt(card, now),
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
function toneOf(snapshot: Pick<Snapshot, "datasets">, codes: readonly string[], code: string): string | undefined {
  if (!codes.includes(code)) return undefined;
  const saved = snapshotDataset(snapshot, "local.courseColors") ?? { picks: {}, automatic: legacyAutomatic(codes) };
  const color = resolveCourseColors(codes, saved).colors.get(code);
  return color ? courseTone(color.id) : undefined;
}

/** SIX's "Tandai Hadir" for any class on now, then the Edunex Presence for the card's class when doing it counts (as the tray lists them). */
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
  if (presence && presence.counts !== false)
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
