// "Sudah beres" (Handled): Beranda items the Student puts away for good, where
// only they can know it's dealt with: a lecturer's change they checked, a
// class's warning they've seen, a group hand-in or a payment the app can't
// see, a Task handed in another way or not handed in at all. Kept on this
// computer ("local.done"). An entry holds while its item keeps the facts it
// had: only a new fact brings it back (another edit, a moved deadline, a new
// target), never time alone, except a bill turning overdue (the safety net).
// What the app can see (the Student's own hand-in, a Presence, the KRS) clears
// itself, so those items have no "handled". The Task page, the Tasks list,
// Today, the badges and the deadline reminders read the same entries, through
// the same keys, so they always agree.
import type { AttendanceHealth } from "./attendance";
import { wibDay } from "./course-meetings";
import type { Bill, DoneEntry, DoneHow, Task } from "./models";
import type { NeedDraft } from "./needs";
import type { SnoozeKey } from "./snooze";

const DAY = 24 * 3_600_000;
/** How many saved entries are kept, newest kept. */
const KEPT = 300;
/** An entry older than this is let go: no term lasts that long. */
const KEEP_FOR = 180 * DAY;

const facts = (...parts: unknown[]) => parts.map((part) => (part === null || part === undefined ? "" : String(part))).join("|");

/**
 * A Task's two things to put away: the lecturer's edit ("edited", back with
 * another edit) and the Task itself ("due": handed in another way, not
 * handed in, or handed in by the group; back when its deadline, its late
 * rule or Edunex's own state moves, or the lecturer edits it again).
 */
export function taskDoneKey(task: Pick<Task, "id" | "dueAt" | "lateAllowed" | "closed" | "editedAt">, kind: "edited" | "due"): SnoozeKey {
  return kind === "edited"
    ? { id: `task:${task.id}:edited`, facts: facts("edited", task.editedAt) }
    : { id: `task:${task.id}`, facts: facts(task.dueAt, task.lateAllowed, task.closed, task.editedAt) };
}

/** What a Beranda item is put away under, and which "handled" its ✓ says (null: no ✓ on the row, as for a Task of the Student's own). */
export interface DoneTerms {
  key: SnoozeKey;
  how: DoneHow | null;
}

/**
 * The facts are narrower than a snooze's: turning urgent isn't news, and
 * neither is SIX's attendance count for a target already out of reach.
 * null: the item clears itself when it's done (a Presence, a class, an exam,
 * a meeting, the KRS).
 */
export function doneTerms(need: NeedDraft): DoneTerms | null {
  switch (need.kind) {
    case "task":
      if (need.reason === "edited") return { key: taskDoneKey(need.task, "edited"), how: "checked" };
      // Only the group's hand-in can't be seen: the Student's own shows on Edunex, or is marked on the Task page.
      return { key: taskDoneKey(need.task, "due"), how: need.task.group ? "groupDone" : null };
    case "attendance": {
      const { health } = need;
      if (health.state === "out") return { key: outOfReachKey(need.course ?? "", health), how: "gotIt" };
      // The warning for one class: the next class has its own. With no class known, it's back when SIX counts another.
      return need.at !== null
        ? { key: { id: `attendance:${need.course}:class:${wibDay(need.at)}`, facts: facts("none", health.target) }, how: "gotIt" }
        : { key: { id: `attendance:${need.course}:none`, facts: facts("none", health.target, `${health.attended ?? ""}/${health.held ?? ""}`) }, how: "gotIt" };
    }
    case "bill":
      return { key: billDoneKey(need.bill, need.overdue), how: "paid" };
    default:
      return null;
  }
}

/**
 * A course whose target is out of reach, the same on Beranda and on the
 * course's banner, so "Sudah tahu" in either clears both. Back only when the
 * target changes: another meeting counted is no news once it can't be reached.
 */
export function outOfReachKey(code: string, health: Pick<AttendanceHealth, "target">): SnoozeKey {
  return { id: `attendance:${code}`, facts: facts("out", health.target) };
}

/** A bill marked paid where SIX doesn't show it yet. Turning overdue brings it back: a payment SIX still hasn't shown by then is worth a second look. */
export function billDoneKey(bill: Pick<Bill, "term" | "amount" | "paid" | "nextDueAt">, overdue: boolean): SnoozeKey {
  return { id: `bill:${bill.term}`, facts: facts(bill.amount, bill.paid, bill.nextDueAt, overdue) };
}

/** The entry putting this item away now, if any: same id, same facts. */
export function activeDone(key: SnoozeKey, entries: readonly DoneEntry[]): DoneEntry | undefined {
  return entries.find((entry) => entry.id === key.id && entry.facts === key.facts);
}

/** A list split into what it still shows and what the Student has handled. */
export function partitionDone<T>(
  items: readonly T[],
  keyOf: (item: T) => SnoozeKey | null,
  entries: readonly DoneEntry[],
): { shown: T[]; done: { item: T; entry: DoneEntry }[] } {
  const shown: T[] = [];
  const done: { item: T; entry: DoneEntry }[] = [];
  for (const item of items) {
    const key = keyOf(item);
    const entry = key ? activeDone(key, entries) : undefined;
    if (entry) done.push({ item, entry });
    else shown.push(item);
  }
  return { shown, done };
}

/** A Beranda item's own entry, when it has one: `partitionDone`'s key. */
export const needDoneKey = (need: NeedDraft): SnoozeKey | null => doneTerms(need)?.key ?? null;

/**
 * Whether the Student put this Task away themselves: handed in another way,
 * not handing it in, or handed in by the group, with its facts unchanged. Its
 * deadline reminders stop, Beranda and the Tasks badge leave it out, and the
 * Tasks list files a Task not handed in under Done.
 */
export function taskPutAway(task: Pick<Task, "id" | "dueAt" | "lateAllowed" | "closed" | "editedAt">, entries: readonly DoneEntry[]): DoneEntry | undefined {
  return activeDone(taskDoneKey(task, "due"), entries);
}

/** A Task the Student said they won't hand in: the Tasks list files it under Done, with the others no longer to do. */
export function notHandingIn(task: Pick<Task, "id" | "dueAt" | "lateAllowed" | "closed" | "editedAt">, entries: readonly DoneEntry[]): boolean {
  return taskPutAway(task, entries)?.how === "notHandingIn";
}

/** What's still known, so entries about something gone can go. Each only while its dataset is loaded. */
export interface DoneSubjects {
  tasks?: ReadonlySet<number>;
  courses?: ReadonlySet<string>;
  bills?: ReadonlySet<string>;
}

/**
 * The saved list without what can't matter any more: entries over 180 days
 * old, and ones whose Task, course or bill has left its dataset. Never because
 * an item isn't in Beranda's list right now: the Task page, Today, the badges
 * and the reminders read the same entries for much longer than a row lives.
 */
export function pruneDone(entries: readonly DoneEntry[], now: number, subjects: DoneSubjects = {}): DoneEntry[] {
  const known = (entry: DoneEntry) => {
    const [kind, subject] = entry.id.split(":");
    if (kind === "task" && subjects.tasks) return subjects.tasks.has(Number(subject));
    if (kind === "attendance" && subjects.courses) return subjects.courses.has(subject ?? "");
    if (kind === "bill" && subjects.bills) return subjects.bills.has(entry.id.slice("bill:".length));
    return true;
  };
  return entries.filter((entry) => now - entry.at < KEEP_FOR && known(entry)).slice(-KEPT);
}

/** The list with this item put away now (replacing any earlier entry for it), newest last. */
export function putAway(entries: readonly DoneEntry[], key: SnoozeKey, how: DoneHow, now: number): DoneEntry[] {
  return [...entries.filter((entry) => entry.id !== key.id), { id: key.id, facts: key.facts, at: now, how }];
}
