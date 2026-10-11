// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): what the screens show,
// derived from the real data at the demo moment. Nothing here is hard-coded
// content; it is only sorting, grouping and picking.
import type { ClassSession, DesignData, PresenceWindow, Task, TaskStatus } from "./data";
import type { Format, Lang } from "./i18n";

export const isDone = (s: TaskStatus) => s === "submitted" || s === "in_review";
export const isOpen = (s: TaskStatus) => s === "not_started" || s === "draft" || s === "overdue";
/** EduNex titles often carry double spaces and stray whitespace. */
export const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
export const ms = (iso: string) => new Date(iso).getTime();
/** SIX marks regular lectures "Kuliah"; anything else (UTS, UAS, …) is worth calling out. */
export const isSpecial = (activity: string) => activity.trim() !== "" && activity.trim().toLowerCase() !== "kuliah";

export type Phase = "past" | "now" | "next";
export interface Day<T> {
  key: string;
  iso: string;
  items: T[];
}
export type AgendaItem =
  | { kind: "task"; iso: string; task: Task }
  | { kind: "class"; iso: string; session: ClassSession };

export function byDay<T>(items: T[], iso: (item: T) => string, f: Format): Day<T>[] {
  const days: Day<T>[] = [];
  for (const item of items) {
    const key = f.dayKey(iso(item));
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(item);
    else days.push({ key, iso: iso(item), items: [item] });
  }
  return days;
}

export function buildModel(data: DesignData, now: Date, f: Format, lang: Lang, preview: Task) {
  const t0 = now.getTime();
  const locale = lang === "id" ? "id-ID" : "en-GB";

  // The Task page may preview a status (?status=); lists show the same preview
  // so going back from the Task page stays consistent.
  const tasks = data.tasks.map((t) => (t.id === preview.id ? preview : t));

  const courses = new Map(data.courses.map((c) => [c.code, c]));
  const course = (code: string) => courses.get(code);
  /** One canonical (SIX) name per course; EduNex sometimes uses an English one. */
  const courseName = (code: string, fallback?: string) => courses.get(code)?.name ?? fallback ?? code;
  const color = (code: string) => courses.get(code)?.color ?? "#8E8E93";

  const sessions = [...data.sessions].sort((a, b) => ms(a.start) - ms(b.start));
  const phase = (s: ClassSession): Phase => (t0 >= ms(s.end) ? "past" : t0 >= ms(s.start) ? "now" : "next");
  const sessionsOn = (offset: number) => sessions.filter((s) => f.dayOffset(s.start) === offset);

  const isOpenWindow = (w: PresenceWindow) => ms(w.opensAt) <= t0 && t0 < ms(w.closesAt);
  const presenceOpen = data.presence.find(isOpenWindow) ?? null;

  const dueMs = (t: Task) => (t.dueAt ? ms(t.dueAt) : Number.POSITIVE_INFINITY);
  const byDue = (a: Task, b: Task) => dueMs(a) - dueMs(b);
  const stamp = (t: Task) => (t.submittedAt ? ms(t.submittedAt) : t.dueAt ? ms(t.dueAt) : 0);

  const open = tasks.filter((t) => isOpen(t.status)).sort(byDue);
  const overdue = open.filter((t) => t.status === "overdue");
  const pending = open.filter((t) => t.status !== "overdue");
  const logbook = tasks.filter((t) => isDone(t.status)).sort((a, b) => stamp(b) - stamp(a));
  const closed = tasks.filter((t) => t.status === "closed").sort((a, b) => byDue(b, a));

  /** Today's "Due": everything due today (any status) plus anything overdue. */
  const dueToday = tasks
    .filter((t) => t.status === "overdue" || (t.dueAt !== null && f.dayOffset(t.dueAt) === 0))
    .sort(byDue);

  const within = (iso: string, from: number, to: number) => {
    const d = f.dayOffset(iso);
    return d >= from && d <= to;
  };
  const agendaItems = (from: number, to: number, classes: "all" | "special"): AgendaItem[] =>
    [
      ...pending
        .filter((t) => t.dueAt !== null && within(t.dueAt, from, to))
        .map((task) => ({ kind: "task" as const, iso: task.dueAt as string, task })),
      ...sessions
        .filter((s) => within(s.start, from, to) && (classes === "all" || isSpecial(s.activity)))
        .map((session) => ({ kind: "class" as const, iso: session.start, session })),
    ].sort((a, b) => ms(a.iso) - ms(b.iso));

  /** Today's "Coming up": the next two weeks' deadlines and exams — not the routine lectures. */
  const comingUp = agendaItems(1, 14, "special");
  /** The Upcoming list: four weeks of classes and deadlines, day by day. */
  const agenda = byDay(agendaItems(1, 28, "all"), (i) => i.iso, f);

  const progress = (code: string) => {
    const own = tasks.filter((t) => t.courseCode === code);
    return { done: own.filter((t) => isDone(t.status)).length, total: own.length };
  };

  const courseSessions = (code: string) => sessions.filter((s) => s.courseCode === code && ms(s.end) > t0);
  const courseTasks = (code: string) => {
    const own = tasks.filter((t) => t.courseCode === code);
    return [
      ...own.filter((t) => isOpen(t.status)).sort(byDue),
      ...own.filter((t) => !isOpen(t.status)).sort((a, b) => byDue(b, a)),
    ];
  };
  const courseMaterials = (code: string) =>
    data.materials
      .filter((x) => x.courseCode === code)
      .sort((a, b) => (b.updatedAt ? ms(b.updatedAt) : 0) - (a.updatedAt ? ms(a.updatedAt) : 0));
  const coursePresence = (code: string) => {
    const own = data.presence.filter((w) => w.courseCode === code).sort((a, b) => ms(a.opensAt) - ms(b.opensAt));
    return {
      open: own.find(isOpenWindow) ?? null,
      next: own.find((w) => ms(w.opensAt) > t0) ?? null,
      past: own.filter((w) => ms(w.closesAt) <= t0).reverse(),
    };
  };

  /** The course's usual slot in SIX: the most common weekday + time + room. */
  const slot = (code: string): ClassSession | null => {
    const counts = new Map<string, { n: number; s: ClassSession }>();
    for (const s of sessions.filter((x) => x.courseCode === code)) {
      const key = `${f.weekday(s.start)}|${f.timeRange(s.start, s.end)}|${s.room}`;
      const hit = counts.get(key);
      if (hit) hit.n += 1;
      else counts.set(key, { n: 1, s });
    }
    let best: { n: number; s: ClassSession } | null = null;
    for (const v of counts.values()) if (!best || v.n > best.n) best = v;
    return best?.s ?? null;
  };

  /** What needs the student today: an open Presence window and unsubmitted Tasks due today. */
  const todayCount = (presenceOpen ? 1 : 0) + dueToday.filter((t) => isOpen(t.status)).length;

  /** A course that posts online-meeting links: a class with no SIX room is an online one. */
  const meets = new Set(data.materials.filter((x) => x.kind === "meeting").map((x) => x.courseCode));
  const online = (code: string) => meets.has(code);

  /**
   * "Fri, 16 Oct, 23:59 · in 8 days" — but no echo: "Yesterday, 06:12", not
   * "Yesterday, 06:12 · yesterday".
   */
  const when = (iso: string) => {
    const far = Math.abs(ms(iso) - t0) >= 86_400_000;
    const echo = far && Math.abs(f.dayOffset(iso)) <= 1;
    return echo ? f.dueLabel(iso) : `${f.dueLabel(iso)} · ${f.fromNow(iso)}`;
  };

  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "Asia/Jakarta" });
  const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  return {
    tasks,
    course,
    courseName,
    color,
    phase,
    sessionsOn,
    presenceOpen,
    open,
    overdue,
    pending,
    logbook,
    closed,
    dueToday,
    comingUp,
    agenda,
    progress,
    courseSessions,
    courseTasks,
    courseMaterials,
    coursePresence,
    slot,
    todayCount,
    online,
    when,
    month: (iso: string) => monthFmt.format(new Date(iso)),
    monthKey: (iso: string) => f.dayKey(iso).slice(0, 7),
    num: (n: number) => numFmt.format(n),
    dayNumber: (iso: string) => Number(f.dayKey(iso).slice(8)),
    /** The older of the two sources' last sync: "synced" only claims what both are. */
    syncedAt: [data.sources.edunex.updatedAt, data.sources.six.updatedAt].sort((a, b) => ms(a) - ms(b))[0],
  };
}

export type Model = ReturnType<typeof buildModel>;
