// "Remind me later" (Ingatkan nanti) for Beranda's items ("Perlu perhatianmu",
// and the deadlines in "Hari ini") and a course's attendance banner: what
// identifies an item, the facts that bring it back when they change, the
// moments it can be put off until, and which items a list still shows. Every snooze ends: at the moment chosen, at the item's own
// last useful moment (a deadline's last hours, a class about to start), and
// never later than two weeks out. Nothing here is "don't remind me again".
// OS notifications and the bell don't look at snoozes: they stay the safety net.
import type { AttendanceHealth } from "./attendance";
import { wibDay } from "./course-meetings";
import type { SnoozeEntry } from "./models";
import { DUE_NOW, type NeedDraft, STARTING_SOON } from "./needs";
import { dayStart } from "./schedule";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** No snooze outlasts this, whatever was chosen. */
export const LONGEST = 14 * DAY;
/** A choice sooner than this isn't worth the click. */
const SOONEST = 30 * MINUTE;
/** The morning a "tomorrow morning" snooze ends, WIB. */
const MORNING = 7 * HOUR;
/** How many saved snoozes are kept, newest last. */
const KEPT = 200;

/** An item as a snooze knows it: who it is, and what it says now. */
export interface SnoozeKey {
  id: string;
  facts: string;
}

/** The moments an item fits: "when it opens", "the day before it's due", "before the next class". */
export type SnoozeMoment = "opens" | "dayBefore" | "dayBeforeDue" | "beforeClass";
export type SnoozeKind = "hours" | "morning" | SnoozeMoment | "change";

export interface SnoozeChoice {
  kind: SnoozeKind;
  until: number;
}

/** What a screen tells the snooze about an item it lets the Student put off. */
export interface Snoozable {
  key: SnoozeKey;
  /** The last moment hiding it is harmless: by then it's back, whatever was chosen. null: none (two weeks at most). */
  cap: number | null;
  /** The moment that fits this item, when there is one. */
  moment: { kind: SnoozeMoment; at: number } | null;
  /** "Until something changes" makes sense: not for what needs the Student right now. */
  untilChange: boolean;
}

/** 07:00 WIB on the day before `at`. */
const dayBefore = (at: number) => dayStart(wibDay(at)) - DAY + MORNING;

/**
 * The id and facts of a Beranda item. Turning urgent ("now") is a fact, so it
 * brings the item back; the steps before that (coming up, then soon) aren't,
 * so a snooze isn't cut short on the way to the time it promised.
 */
export function snoozeKey(need: NeedDraft): SnoozeKey {
  const facts = (...parts: unknown[]) => parts.map((part) => (part === null || part === undefined ? "" : String(part))).join("|");
  const urgent = need.band === "now" ? "urgent" : "";
  switch (need.kind) {
    case "presence":
      return { id: need.id, facts: facts(need.open ? "open" : "ahead", urgent, need.session.opensAt, need.session.closesAt, need.activity, need.countedIn) };
    case "task":
      return need.reason === "edited"
        ? { id: need.id, facts: facts("edited", need.task.editedAt) }
        : { id: need.id, facts: facts(need.reason, urgent, need.task.dueAt, need.task.lateAllowed, need.task.closed) };
    case "exam":
      return {
        id: need.id,
        // The take-home's deadline is on the row ("Take-home tenggat Kam 22 Okt"): a new one is news.
        facts: facts(urgent, need.sitting.source, need.sitting.start, need.sitting.end, need.sitting.room, need.disagree, need.takeHomeDue),
      };
    case "attendance":
      return attendanceKey(need.health.code, need.health);
    case "meeting":
      return { id: need.id, facts: facts(urgent, need.meeting.start, need.meeting.end, need.meeting.link) };
    case "krs":
      return { id: need.id, facts: facts(urgent, need.open, need.at, need.closesAt) };
    case "bill":
      return { id: need.id, facts: facts(urgent, need.overdue, need.bill.nextDueAt, (need.bill.amount ?? 0) - (need.bill.paid ?? 0)) };
    case "class":
      return { id: need.id, facts: facts(urgent, need.session.start, need.session.room) };
  }
}

/**
 * When an item that isn't urgent yet turns urgent by time alone (needs.ts's
 * thresholds). That brings it back, so nothing is offered past it. null: it
 * doesn't (a Presence window ahead ends at its opening, attendance at a new count).
 */
function turnsUrgent(need: NeedDraft): number | null {
  if (need.band === "now") return null;
  switch (need.kind) {
    case "task":
      return need.reason === "due" && need.task.dueAt !== null ? need.task.dueAt - DUE_NOW : null;
    case "exam":
      return need.sitting.start - DUE_NOW;
    case "meeting":
      return need.meeting.start - STARTING_SOON;
    case "class":
      return need.session.start - STARTING_SOON;
    case "krs":
      return need.open ? need.closesAt - DUE_NOW : null;
    case "bill":
      return need.bill.nextDueAt === null ? null : need.bill.nextDueAt - DUE_NOW;
    default:
      return null;
  }
}

/**
 * A course's attendance, the same on Beranda and on the course page, so
 * putting off one puts off both. Back when SIX records another meeting, the
 * state changes or the course's target does (its own, or the default).
 */
export function attendanceKey(code: string, health: Pick<AttendanceHealth, "state" | "attended" | "held" | "target">): SnoozeKey {
  return { id: `attendance:${code}`, facts: `${health.state}|${health.attended ?? ""}/${health.held ?? ""}|${health.target}` };
}

/** What a Beranda item can be put off until: never past the moment it turns urgent. */
export function snoozable(need: NeedDraft, now: number): Snoozable {
  const item = ownTerms(need, now);
  const urgent = turnsUrgent(need);
  return urgent !== null && (item.cap === null || urgent < item.cap) ? { ...item, cap: urgent } : item;
}

/** An item's own last useful moment and the moment that fits it. */
function ownTerms(need: NeedDraft, now: number): Snoozable {
  const key = snoozeKey(need);
  const later = need.band !== "now";
  switch (need.kind) {
    case "presence": {
      const { opensAt, closesAt } = need.session;
      if (!need.open) return { key, cap: opensAt, moment: { kind: "opens", at: opensAt }, untilChange: later };
      // Where SIX counts it's optional: hiding it until it closes costs nothing. Otherwise back before it closes.
      return { key, cap: need.countedIn === "six" ? closesAt : closesAt - 15 * MINUTE, moment: null, untilChange: false };
    }
    case "task": {
      const { task } = need;
      // Checked the lecturer's edit: hidden until another edit, or until it leaves the list a week on.
      if (need.reason === "edited") return { key, cap: (task.editedAt ?? now) + 7 * DAY, moment: null, untilChange: true };
      if (need.reason === "overdue" || task.dueAt === null) return { key, cap: null, moment: null, untilChange: false };
      return { key, cap: task.dueAt - 3 * HOUR, moment: { kind: "dayBeforeDue", at: dayBefore(task.dueAt) }, untilChange: later };
    }
    case "exam": {
      const { start } = need.sitting;
      const morning = dayStart(wibDay(start)) + 6 * HOUR;
      return { key, cap: morning > now ? morning : start - HOUR, moment: { kind: "dayBefore", at: dayBefore(start) }, untilChange: later };
    }
    case "attendance": {
      const next = need.health.left.next;
      return { key, cap: null, moment: next ? { kind: "beforeClass", at: next.start - HOUR } : null, untilChange: true };
    }
    case "meeting":
      return { key, cap: need.meeting.start - HOUR, moment: null, untilChange: later };
    case "krs":
      return need.open
        ? { key, cap: need.closesAt - DAY, moment: null, untilChange: later }
        : { key, cap: need.at, moment: need.at === null ? null : { kind: "opens", at: need.at }, untilChange: later };
    case "bill": {
      const due = need.bill.nextDueAt;
      if (need.overdue || due === null) return { key, cap: null, moment: null, untilChange: false };
      return { key, cap: dayStart(wibDay(due - 1)) + MORNING, moment: { kind: "dayBeforeDue", at: dayBefore(due - 1) }, untilChange: later };
    }
    case "class":
      return { key, cap: need.session.start - 30 * MINUTE, moment: null, untilChange: false };
  }
}

/** A course banner's attendance: until the next class, a morning, or the count changing. */
export function attendanceSnoozable(code: string, health: AttendanceHealth): Snoozable {
  const next = health.left.next;
  return {
    key: attendanceKey(code, health),
    cap: null,
    moment: next ? { kind: "beforeClass", at: next.start - HOUR } : null,
    untilChange: true,
  };
}

/** The next 07:00 WIB worth calling "tomorrow morning" (before 04:00, it's this morning's). */
function nextMorning(now: number): number {
  const today = dayStart(wibDay(now)) + MORNING;
  return now < today - 3 * HOUR ? today : today + DAY;
}

/** The last 07:00 WIB at or before `at`. */
function morningBefore(at: number): number {
  const morning = dayStart(wibDay(at)) + MORNING;
  return morning <= at ? morning : morning - DAY;
}

/**
 * The choices offered, soonest first: in three hours, tomorrow morning, the
 * item's own moment, and until something changes (which still ends at the
 * item's last useful moment, or on a morning two weeks out at most). A choice
 * past that, or less than half an hour away, isn't offered; nor is a second one
 * ending at the same time. None: the item is too close to put off.
 */
export function snoozeChoices(item: Snoozable, now: number): SnoozeChoice[] {
  const limit = Math.min(item.cap ?? Number.POSITIVE_INFINITY, morningBefore(now + LONGEST));
  const fits = (at: number) => at - now >= SOONEST && at <= limit;
  const timed: SnoozeChoice[] = [
    { kind: "hours", until: now + 3 * HOUR },
    { kind: "morning", until: nextMorning(now) },
    ...(item.moment ? [{ kind: item.moment.kind, until: item.moment.at }] : []),
  ];
  const choices: SnoozeChoice[] = [];
  for (const choice of timed.filter((c) => fits(c.until)).sort((a, b) => a.until - b.until))
    if (!choices.some((c) => c.until === choice.until)) choices.push(choice);
  if (item.untilChange && fits(limit) && !choices.some((c) => c.until === limit)) choices.push({ kind: "change", until: limit });
  return choices;
}

/** The snooze holding an item back now, if any: same id, same facts, not over yet. */
export function activeSnooze(key: SnoozeKey, entries: readonly SnoozeEntry[], now: number): SnoozeEntry | undefined {
  return entries.find((entry) => entry.id === key.id && entry.facts === key.facts && entry.until > now);
}

/** A list split into what it still shows and what's snoozed (with until when). */
export function partitionSnoozed<T>(
  items: readonly T[],
  keyOf: (item: T) => SnoozeKey,
  entries: readonly SnoozeEntry[],
  now: number,
): { shown: T[]; snoozed: { item: T; entry: SnoozeEntry }[] } {
  const shown: T[] = [];
  const snoozed: { item: T; entry: SnoozeEntry }[] = [];
  for (const item of items) {
    const entry = activeSnooze(keyOf(item), entries, now);
    if (entry) snoozed.push({ item, entry });
    else shown.push(item);
  }
  return { shown, snoozed };
}

/** The saved snoozes still hiding one of these items: one whose item has changed or gone hides nothing. */
export function holding(entries: readonly SnoozeEntry[], keys: readonly SnoozeKey[], now: number): SnoozeEntry[] {
  return entries.filter((entry) => entry.until > now && keys.some((key) => key.id === entry.id && key.facts === entry.facts));
}

/** The saved list without what's over, newest kept. */
export function pruneSnoozes(entries: readonly SnoozeEntry[], now: number): SnoozeEntry[] {
  return entries.filter((entry) => entry.until > now).slice(-KEPT);
}
