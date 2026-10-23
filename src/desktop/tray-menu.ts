// What the tray (menu bar on macOS) menu says: what the Student needs to know
// now, without opening the window. Built from the engine's snapshot with the
// same core reasoning Beranda uses (src/core/needs.ts, held-back.ts), so the
// menu and Beranda never disagree. Pure: the data, the moment and the
// language in, the lines and what each click does out; src/desktop/tray.ts
// turns them into the system's own menu. Only times of day and days, never
// "in 5 minutes": a menu left open doesn't tick.
//
//   status        Diperbarui pukul 14:05, or what's wrong (it opens the window, where the fix is)
//   the class     on now, or next (today, else the next day), Tandai Hadir open in SIX, the Presence to fill in
//   needs you     Beranda's list with "Hari ini"'s deadlines in, the first few, without what's put off or away
//   alerts        new notifications, opening the bell
//   actions       open, refresh, Edunex and SIX in the browser, Settings; quit last

import { rupiah } from "../core/academic";
import { checkingIn } from "../core/check-in";
import { type Format, makeFormat } from "../core/format";
import { heldBack } from "../core/held-back";
import { snapshotDataset, snapshotHomeWorld, snapshotTermCourses } from "../core/home-world";
import { EDUNEX_WEB, SIX_WEB } from "../core/links";
import type { Lang, SourceStatus } from "../core/models";
import { attentionWithToday, homeContext, type NeedDraft, type NowCard, needsRange, nowCard } from "../core/needs";
import type { Route } from "../core/route";
import type { Snapshot } from "../core/snapshot";
import { type StringKey, translate, type Vars } from "../core/strings";
import type { TermCourseBase } from "../core/term-courses";

/** What a line does when clicked. */
export type TrayAction =
  /** The window, as it was. */
  | { kind: "window" }
  /** The window, on a screen. */
  | { kind: "route"; route: Route }
  /** The window, with Settings or the bell open over it. */
  | { kind: "command"; command: "settings" | "alerts" }
  /** An official page (Edunex, SIX, a Presence) in the browser. */
  | { kind: "url"; url: string }
  /** SIX on the class's popup, for its "Tandai Hadir", as the app's own button does. */
  | { kind: "checkIn"; meetingId: string }
  /** Edunex and SIX read again now, as the window's own refresh. */
  | { kind: "refresh" }
  | { kind: "quit" };

export type TrayEntry =
  | { type: "separator" }
  /** A quiet label over its section. */
  | { type: "header"; label: string }
  /** `action` null: a line to read, not to click. `detail`: the when and where, in small grey type under it (macOS), else after it. */
  | { type: "item"; label: string; detail?: string; action: TrayAction | null }
  /** A line that opens a few more, so the menu stays short. */
  | { type: "submenu"; label: string; entries: TrayEntry[] };

export interface TrayMenu {
  tooltip: string;
  entries: TrayEntry[];
}

/** How many of "Perlu perhatianmu" the menu lists; past that, a line to Beranda. */
export const NEEDS_SHOWN = 3;
/** The longest title and detail, in characters: a long Task title or course name is cut, so the menu stays narrow. */
const TITLE = 36;
const DETAIL = 40;

type Translate = (key: StringKey, vars?: Vars) => string;

export function trayMenu(snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">, now: number): TrayMenu {
  const lang: Lang = snapshot.settings.lang;
  const t: Translate = (key, vars) => translate(lang, key, vars);
  const f = makeFormat(lang, now);
  const world = snapshotHomeWorld(snapshot, now);
  const context = world ? homeContext(world) : undefined;
  const courses = snapshotTermCourses(snapshot) ?? [];
  const card = context ? nowCard(context) : null;
  const needs = context ? needsSection(snapshot, context, card, f, t) : null;

  // All well: no line about it, only when the data was read, under "Perbarui sekarang". Something wrong: it comes first.
  const status = statusLine(snapshot, f, t);
  const entries: TrayEntry[] = status.problem ? [status.problem] : [];
  const section = (lines: TrayEntry[]) => {
    if (!lines.length) return;
    if (entries.length) entries.push({ type: "separator" });
    entries.push(...lines);
  };
  section(classSection(snapshot, card, courses, now, f, t));
  section(needs?.entries ?? []);
  section(alertsLine(snapshot, t));
  const signedIn = snapshot.statuses.some((status) => (status.source === "edunex" || status.source === "six") && status.state !== "signed-out");
  section([
    { type: "item", label: t("tray.open"), action: { kind: "window" } },
    { type: "item", label: t("sync.refreshNow"), ...(status.updated ? { detail: status.updated } : {}), action: signedIn ? { kind: "refresh" } : null },
    {
      type: "submenu",
      label: t("tray.openInBrowser"),
      entries: [
        { type: "item", label: t("source.edunex"), action: { kind: "url", url: EDUNEX_WEB } },
        { type: "item", label: t("source.six"), action: { kind: "url", url: SIX_WEB } },
      ],
    },
    { type: "item", label: t("menu.settings"), action: { kind: "command", command: "settings" } },
  ]);
  section([{ type: "item", label: t("tray.quit"), action: { kind: "quit" } }]);
  const count = needs?.count ?? 0;
  return { tooltip: count > 0 ? t("tray.tooltip", { count }) : "Edunex Plus", entries };
}

// ---------------------------------------------------------------- status

const SIGNED_OUT = (source: SourceStatus["source"]): SourceStatus => ({ source, state: "signed-out", updatedAt: null, detail: null });

/**
 * As the window's top bar and banner say it: the problem, a line whose click
 * opens the window, where its banner has the fix (sign in again, try again);
 * else when the data was last read.
 */
function statusLine(snapshot: Pick<Snapshot, "datasets" | "statuses">, f: Format, t: Translate): { problem: TrayEntry | null; updated: string | null } {
  const status = (source: "edunex" | "six") => snapshot.statuses.find((entry) => entry.source === source) ?? SIGNED_OUT(source);
  const sources = [status("edunex"), status("six")];
  const name = (entry: SourceStatus) => t(`source.${entry.source}`);
  const saved = { edunex: snapshotDataset(snapshot, "edunex.account") !== undefined, six: snapshotDataset(snapshot, "six.student") !== undefined } as const;
  const signedIn = sources.filter((entry) => entry.state !== "signed-out");
  const fix = (label: string) => ({ problem: { type: "item", label, action: { kind: "window" } } as TrayEntry, updated: null });
  const quiet = (updated: string) => ({ problem: null, updated });
  // Signed in to neither, nothing kept: the window's welcome is where to start.
  if (!signedIn.length && !saved.edunex && !saved.six) return fix(t("welcome.continueHint"));
  const changed = signedIn.find((entry) => entry.state === "changed");
  if (changed) return fix(t("status.changed", { source: name(changed) }));
  const ended = sources.find((entry) => entry.state === "expired" || (entry.state === "signed-out" && saved[entry.source as "edunex" | "six"]));
  if (ended)
    return fix(
      ended.state === "expired" ? `${t("sync.expired", { source: name(ended) })} · ${t("action.signInAgain")}` : t("action.signInTo", { source: name(ended) }),
    );
  const updatedAt = Math.max(0, ...signedIn.map((entry) => entry.updatedAt ?? 0)) || null;
  const at = (ms: number) => (f.dayOffset(ms) === 0 ? f.time(ms) : f.dayTimeWord(ms));
  const offline = signedIn.filter((entry) => entry.state === "offline");
  if (offline.length)
    return fix(
      offline.length < signedIn.length
        ? t("sync.offlineOne", { source: name(offline[0]!) })
        : updatedAt
          ? t("tray.offline", { when: at(updatedAt) })
          : t("status.offline"),
    );
  if (signedIn.some((entry) => entry.state === "connecting")) return quiet(t("sync.checking"));
  if (!updatedAt) return quiet(t("status.neverUpdated"));
  return quiet(f.dayOffset(updatedAt) === 0 ? t("tray.updatedAt", { time: f.time(updatedAt) }) : t("status.updated", { when: f.dayTimeWord(updatedAt) }));
}

// ---------------------------------------------------------------- the class

/**
 * Beranda's "Sekarang": the class on now or next (a meeting only Edunex
 * announced counts), "Tandai Hadir" while SIX shows it for a class on now,
 * and the Edunex Presence to fill in for it when doing so counts.
 */
function classSection(
  snapshot: Pick<Snapshot, "datasets">,
  card: NowCard | null,
  courses: readonly TermCourseBase[],
  now: number,
  f: Format,
  t: Translate,
): TrayEntry[] {
  const lines: TrayEntry[] = [];
  const session = card?.class?.session ?? null;
  const meeting = card?.meeting ?? null;
  const slot = session ?? meeting?.meeting ?? null;
  if (card && slot) {
    const code = session?.courseCode ?? meeting!.code;
    const course = courses.find((c) => c.code === code);
    lines.push({
      type: "header",
      // On now: its time is on the line under it.
      label: card.state === "live" ? t("tray.now") : t("home.now.later", { day: f.relativeDay(slot.start) }),
    });
    const what = session
      ? [session.room, /^kuliah$/i.test(session.activity) ? null : session.activity]
      : [t(meeting!.meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting!.meeting.number })];
    const name = course?.name ?? session?.courseName ?? null;
    lines.push({
      type: "item",
      label: cut(name ? `${code} ${name}` : code, TITLE),
      detail: cut([f.timeRange(slot.start, slot.end), ...what.filter((part): part is string => Boolean(part))].join(" · "), DETAIL),
      action: { kind: "route", route: course?.edunex ? { screen: "course", code, tab: "meetings" } : { screen: "presence" } },
    });
  }
  // SIX's button, for any class on now (as Presensi and its badge count them): the app read it, it never presses it.
  const student = snapshotDataset(snapshot, "six.student");
  const checkIns = snapshotDataset(snapshot, "six.checkIn") ?? {};
  const open = student ? (snapshotDataset(snapshot, "six.schedule") ?? []).filter((s) => checkIns[s.id]?.state === "open" && checkingIn(s, now)) : [];
  for (const s of open) lines.push({ type: "item", label: t("tray.checkIn"), detail: s.courseCode, action: { kind: "checkIn", meetingId: s.id } });
  // Optional where SIX counts: Beranda says so quietly, and the menu leaves it out.
  const presence = card?.presence;
  if (presence && presence.counts !== false) {
    if (!slot) lines.unshift({ type: "header", label: t("home.now.presenceOnly") });
    const title = presence.noSix ? t("home.need.presenceNoSix", { course: presence.code }) : t("home.need.presence", { course: presence.code });
    lines.push({
      type: "item",
      label: title,
      detail: capital(t("home.need.presence.closes", { time: f.dayTime(presence.session.closesAt) })),
      // Recorded by handing in a Task: that Task in the app, as Beranda's button; else the Presence on Edunex.
      action:
        presence.activity === "assignment" && presence.task
          ? { kind: "route", route: { screen: "task", taskId: presence.task.id } }
          : { kind: "url", url: presence.url },
    });
  }
  return lines;
}

// ---------------------------------------------------------------- needs you

function needsSection(
  snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">,
  context: ReturnType<typeof homeContext>,
  card: NowCard | null,
  f: Format,
  t: Translate,
): { entries: TrayEntry[]; count: number } | null {
  // Until Edunex's Tasks arrive, an empty list would claim more than the app knows (as on Beranda).
  const edunex = snapshot.statuses.find((status) => status.source === "edunex");
  if (snapshotDataset(snapshot, "edunex.tasks") === undefined && (edunex?.state ?? "signed-out") !== "signed-out") return null;
  const snoozes = snapshotDataset(snapshot, "local.snoozes") ?? [];
  const handled = snapshotDataset(snapshot, "local.done") ?? [];
  const { shown, snoozed, done } = heldBack(attentionWithToday(context, card), [], snoozes, handled, context.now);
  const entries: TrayEntry[] = [{ type: "header", label: t("home.needs") }];
  if (!shown.length) {
    // Beranda's empty list, in its words: never "nothing due" while something is only put off, handled or not listed.
    const range = needsRange(context);
    const label = snoozed.length
      ? t("home.needs.allSnoozed")
      : done.length
        ? t("home.needs.allHandled")
        : range.next !== null
          ? t("home.needs.noneElse")
          : t("home.needs.none", { count: range.days });
    entries.push({ type: "item", label, action: { kind: "route", route: { screen: "home" } } });
    return { entries, count: 0 };
  }
  for (const need of shown.slice(0, NEEDS_SHOWN)) entries.push({ type: "item", ...needLine(need, f, t), action: needAction(need) });
  if (shown.length > NEEDS_SHOWN)
    entries.push({ type: "item", label: t("tray.needs.all", { count: shown.length }), action: { kind: "route", route: { screen: "home" } } });
  return { entries, count: shown.length };
}

/** Where Beranda's row goes: a screen, or the official page. */
function needAction(need: NeedDraft): TrayAction {
  return need.action.kind === "go" ? { kind: "route", route: need.action.route } : { kind: "url", url: need.action.url };
}

/** Beranda's row, short: what it is, and when (with the course where the title doesn't say it). */
function needLine(need: NeedDraft, f: Format, t: Translate): { label: string; detail?: string } {
  const course = need.course ?? "";
  const line = (label: string, ...detail: (string | null | undefined)[]) => {
    const parts = detail.filter((part): part is string => Boolean(part));
    return parts.length ? { label: cut(label, TITLE), detail: cut(capital(parts.join(" · ")), DETAIL) } : { label: cut(label, TITLE) };
  };
  switch (need.kind) {
    case "task": {
      const { task } = need;
      if (need.reason === "edited") return line(task.title, course, t("tray.edited"));
      if (need.reason === "overdue" || task.dueAt === null) return line(task.title, course, t("home.need.task.overdue"));
      return line(task.title, course, t("home.need.task.due", { when: f.dueLabel(task.dueAt) }));
    }
    case "presence": {
      if (!need.open) {
        const title = need.task ? need.task.title : t("home.need.presenceAhead", { course });
        return line(title, need.task ? course : null, t("tray.opens", { when: f.dueLabel(need.session.opensAt) }));
      }
      const title =
        need.countedIn === "noSix"
          ? t("home.need.presenceNoSix", { course })
          : need.countedIn === "six"
            ? t("home.need.presenceOptional", { course })
            : t("home.need.presence", { course });
      return line(title, t("home.need.presence.closes", { time: f.dayTime(need.session.closesAt) }));
    }
    case "exam": {
      const { exam, sitting } = need;
      const title = t("home.need.exam", { kind: t(`exam.kind.${exam.kind}`), course: exam.courseCode });
      // Open for days on Edunex: it runs out when it closes, like a deadline.
      if (need.window && sitting.end !== null) return line(title, t("home.need.exam.closes", { when: f.dueLabel(sitting.end) }));
      return line(title, f.dueLabel(sitting.start));
    }
    case "attendance": {
      const { health } = need;
      const key = health.state === "out" ? "tray.attendance.out" : need.at !== null ? "tray.attendance.tomorrow" : "tray.attendance.none";
      return line(t("tray.attendance", { course }), t(key, { target: health.target }));
    }
    case "meeting": {
      const { meeting } = need;
      return line(
        t(meeting.online ? "tray.meeting.online" : "tray.meeting", { course }),
        `${f.relativeDay(meeting.start)}, ${f.timeRange(meeting.start, meeting.end)}`,
      );
    }
    case "krs": {
      const at = need.open ? need.closesAt - 1 : need.at!;
      const date = `${f.weekdayShort(at)} ${f.dayMonth(at)}`;
      return line(t("home.need.krs"), t(need.open ? "home.need.krs.closes" : "home.need.krs.opens", { date }));
    }
    case "bill": {
      const { bill } = need;
      const date = `${f.weekdayShort(bill.nextDueAt! - 1)} ${f.dayMonth(bill.nextDueAt! - 1)}`;
      const left = rupiah(Math.max(0, (bill.amount ?? 0) - (bill.paid ?? 0)));
      return line(t("home.need.bill", { amount: left }), t(need.overdue ? "home.need.bill.overdue" : "home.need.bill.due", { date }));
    }
    case "class":
      return line(need.session.courseName);
  }
}

// ---------------------------------------------------------------- alerts

/** "3 notifikasi baru": raised since the bell was last opened, as its badge counts them. */
function alertsLine(snapshot: Pick<Snapshot, "datasets">, t: Translate): TrayEntry[] {
  const history = snapshotDataset(snapshot, "app.alerts");
  const unread = (history?.items ?? []).filter((item) => item.at > (history?.readAt ?? 0)).length;
  return unread > 0 ? [{ type: "item", label: t("alert.group.other", { count: unread }), action: { kind: "command", command: "alerts" } }] : [];
}

// ---------------------------------------------------------------- lines

/** "Tutup 09:30" under a title: a detail starts as a sentence does. */
function capital(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** Cut to `max` characters with an ellipsis, at a word where one is near. */
export function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, Math.max(1, max - 1));
  const space = head.lastIndexOf(" ");
  const word = space >= max * 0.6 ? head.slice(0, space) : head;
  return `${word.replace(/[\s,.;:·–-]+$/, "")}…`;
}
