// What a lecturer changed in a Task, edit by edit. Edunex only moves a Task's
// updated_at when the lecturer edits it, so the engine compares the app's
// earlier copy with the new one whenever that moves, and keeps what differs
// ("edunex.taskEdits", newest 3 per Task). Pure: the engine passes in how to
// read the instructions' text out of their HTML. The screens read the records
// as three states: unknown (no earlier copy: a new install, a fresh sign-in,
// an edit from before this was kept), none (Edunex marked it changed, but
// nothing the app compares differs) and known (what changed since the version
// the Student last checked).
import { taskDoneKey } from "./done";
import type { DoneEntry, Task, TaskChange, TaskEdit, TaskFile } from "./models";
import { editedAfterSubmit } from "./tasks";

/** Records kept per Task, newest first, and overall. */
const PER_TASK = 3;
const KEPT = 300;
/** The schema's caps: loading validates, so nothing written may exceed them. */
const TEXT_CAP = 20_000;
const FILES_CAP = 50;

/** Whitespace as a reader sees it: runs of spaces are one, blank lines at most one, none at the ends. */
export function normalText(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const capped = (text: string) => (text.length > TEXT_CAP ? { text: text.slice(0, TEXT_CAP), cut: true } : { text, cut: false });

function fileChange(before: readonly TaskFile[], after: readonly TaskFile[]): TaskChange | null {
  const urls = (files: readonly TaskFile[]) => new Set(files.map((file) => file.url));
  const had = urls(before);
  const has = urls(after);
  const added = after.filter((file) => !had.has(file.url));
  const removed = before.filter((file) => !has.has(file.url));
  if (!added.length && !removed.length) return null;
  return { kind: "files", added: added.slice(0, FILES_CAP), removed: removed.slice(0, FILES_CAP) };
}

/**
 * What differs between two copies of a Task, in the order a reader wants it:
 * when it's due and opens, the instructions (by their text: markup alone isn't
 * a change), the lecturer's files (by link), the title, then the hand-in
 * rules. Not compared, as they move without an edit: Edunex's own state
 * (closed), the answer, the score, the module.
 */
export function taskChanges(old: Task, next: Task, textOf: (html: string) => string): TaskChange[] {
  const changes: TaskChange[] = [];
  if (old.dueAt !== next.dueAt) changes.push({ kind: "deadline", from: old.dueAt, to: next.dueAt });
  if (old.opensAt !== next.opensAt) changes.push({ kind: "opens", from: old.opensAt, to: next.opensAt });
  const before = normalText(textOf(old.instructions));
  const after = normalText(textOf(next.instructions));
  if (before !== after) {
    const was = capped(before);
    const now = capped(after);
    changes.push({ kind: "instructions", before: was.text, after: now.text, ...(was.cut || now.cut ? { cut: true } : {}) });
  }
  const files = fileChange(old.files, next.files);
  if (files) changes.push(files);
  if (old.title !== next.title) changes.push({ kind: "title", from: old.title, to: next.title });
  if (old.lateAllowed !== next.lateAllowed) changes.push({ kind: "lateAllowed", from: old.lateAllowed, to: next.lateAllowed });
  if (old.fileRequired !== next.fileRequired) changes.push({ kind: "fileRequired", from: old.fileRequired, to: next.fileRequired });
  // Read only since group Tasks were: a copy from before says nothing about it.
  if (old.group !== undefined && next.group !== undefined && old.group !== next.group) changes.push({ kind: "group", from: old.group, to: next.group });
  if (old.kind !== next.kind) changes.push({ kind: "examKind", from: old.kind, to: next.kind });
  return changes;
}

/**
 * The records after a new copy of the Tasks: one more for each Task whose
 * edit time moved (the condition the edit alert has), against the copy kept
 * until now. Newest first, 3 per Task, 300 at most, none for a Task that's
 * gone. With no earlier copy there's nothing to compare: callers don't ask.
 */
export function nextEdits(
  edits: readonly TaskEdit[],
  stored: readonly Task[],
  tasks: readonly Task[],
  now: number,
  textOf: (html: string) => string,
): TaskEdit[] {
  const before = new Map(stored.map((task) => [task.id, task]));
  const fresh: TaskEdit[] = [];
  for (const task of tasks) {
    const old = before.get(task.id);
    if (!old || task.editedAt === null || task.editedAt === old.editedAt) continue;
    fresh.push({ taskId: task.id, at: task.editedAt, since: old.editedAt ?? old.postedAt, seenAt: now, changes: taskChanges(old, task, textOf) });
  }
  const ids = new Set(tasks.map((task) => task.id));
  const all = [...fresh, ...edits.filter((edit) => ids.has(edit.taskId) && !fresh.some((f) => f.taskId === edit.taskId && f.at === edit.at))].sort(
    (a, b) => b.at - a.at || a.taskId - b.taskId,
  );
  const perTask = new Map<number, number>();
  const kept: TaskEdit[] = [];
  for (const edit of all) {
    const count = perTask.get(edit.taskId) ?? 0;
    if (count >= PER_TASK || kept.length >= KEPT) continue;
    perTask.set(edit.taskId, count + 1);
    kept.push(edit);
  }
  return kept;
}

/**
 * Several edits as one: what differs between the first one's earlier copy and
 * the last one's. A field changed and changed back drops out; the
 * instructions go from the oldest text to the newest; files added then
 * removed (or the other way round) cancel out. Oldest first in, the usual
 * order out.
 */
export function mergeEdits(edits: readonly TaskEdit[]): TaskChange[] {
  const ordered = [...edits].sort((a, b) => a.at - b.at);
  const first = new Map<TaskChange["kind"], TaskChange>();
  const last = new Map<TaskChange["kind"], TaskChange>();
  const added = new Map<string, TaskFile>();
  const removed = new Map<string, TaskFile>();
  for (const edit of ordered)
    for (const change of edit.changes) {
      if (change.kind === "files") {
        for (const file of change.added) removed.has(file.url) ? removed.delete(file.url) : added.set(file.url, file);
        for (const file of change.removed) added.has(file.url) ? added.delete(file.url) : removed.set(file.url, file);
        continue;
      }
      if (!first.has(change.kind)) first.set(change.kind, change);
      last.set(change.kind, change);
    }
  const out: TaskChange[] = [];
  for (const kind of ORDER) {
    if (kind === "files") {
      if (added.size || removed.size) out.push({ kind: "files", added: [...added.values()], removed: [...removed.values()] });
      continue;
    }
    const from = first.get(kind);
    const to = last.get(kind);
    if (!from || !to) continue;
    const merged = mergeOne(from, to);
    if (merged) out.push(merged);
  }
  return out;
}

const ORDER: readonly TaskChange["kind"][] = ["deadline", "opens", "instructions", "files", "title", "lateAllowed", "fileRequired", "group", "examKind"];

function mergeOne(from: TaskChange, to: TaskChange): TaskChange | null {
  if (from.kind === "instructions" && to.kind === "instructions") {
    if (from.before === to.after) return null;
    return { kind: "instructions", before: from.before, after: to.after, ...(from.cut || to.cut ? { cut: true } : {}) };
  }
  if ("from" in from && "to" in to) {
    if (from.from === to.to) return null;
    return { ...to, from: from.from } as TaskChange;
  }
  return to;
}

/** What the screens know about a Task's newest edit, and what changed since the Student last checked. */
export interface EditView {
  /** unknown: no record of the newest edit; none: nothing compared changed since the version last checked; known: some did. */
  state: "unknown" | "none" | "known";
  /** The newest edit's record, when there is one. */
  record: TaskEdit | null;
  /** Every record of the Task, newest first: History tells each. */
  records: TaskEdit[];
  /** What differs from the version last checked (all of it, never checked). */
  changes: TaskChange[];
  /** The Student checked this very version ("Sudah kucek"). */
  checked: DoneEntry | undefined;
  /** Edited after the Student handed it in. */
  afterSubmit: boolean;
}

/** A Task's edit as the screens tell it; null while it was never edited. */
export function editView(task: Task, edits: readonly TaskEdit[] | undefined, done: readonly DoneEntry[]): EditView | null {
  if (task.editedAt === null) return null;
  const records = (edits ?? []).filter((edit) => edit.taskId === task.id).sort((a, b) => b.at - a.at);
  const record = records.find((edit) => edit.at === task.editedAt) ?? null;
  const key = taskDoneKey(task, "edited");
  const checked = done.find((entry) => entry.id === key.id && entry.facts === key.facts);
  // An earlier version checked: only what came after it is news.
  const older = done.find((entry) => entry.id === key.id && entry.facts !== key.facts);
  const since = older ? Number(older.facts.split("|")[1]) : Number.NEGATIVE_INFINITY;
  const changes = mergeEdits(records.filter((edit) => edit.at > (Number.isFinite(since) ? since : Number.NEGATIVE_INFINITY)));
  return {
    state: record === null ? "unknown" : changes.length ? "known" : "none",
    record,
    records,
    changes,
    checked,
    afterSubmit: editedAfterSubmit(task),
  };
}

/** One change that is a date moving (the deadline, the opening): said by name, a fact rather than a diff. */
export function dateMove(changes: readonly TaskChange[]): Extract<TaskChange, { kind: "deadline" | "opens" }> | null {
  const [only] = changes;
  return changes.length === 1 && only && (only.kind === "deadline" || only.kind === "opens") ? only : null;
}

/** A change only to the title: before hand-in, History alone tells it. */
export const titleOnly = (changes: readonly TaskChange[]) => changes.length > 0 && changes.every((change) => change.kind === "title");
