import type { NewTaskInfo } from "../../shared/notifications";

/**
 * New-Task detection (#23): id-diff of the `/todo` tasks array against the
 * snapshot cache, filtered through the persisted seen-ledger so nothing
 * replays across restarts. Pure and main-process-safe — the renderer keeps
 * its own view-model mapping in feed-data.ts; this module owns the
 * notification copy of that shape.
 */

/** Extracts the pending Tasks from a raw `/todo` payload, in feed order. */
export function extractTodoTasks(data: unknown): NewTaskInfo[] {
  const root = asRecord(data);
  if (!root) return [];
  const values = root.tasks;
  if (!Array.isArray(values)) return [];
  return values.flatMap((value, index) => {
    const item = asRecord(value);
    if (!item) return [];
    // Only stable vendor ids participate in detection: a positional fallback
    // (`task-${index}`) would shift on reorder/insert, phantom-notifying and
    // poisoning the ledger with unstable keys. Id-less rows stay visible in
    // the To Do screen (which keeps its own display fallback) but never notify.
    void index;
    const id = scalarString(item.id);
    if (!id) return [];
    return [
      {
        id,
        title: readString(item, ["name", "title"]) ?? "Untitled task",
        courseCode: readString(item, ["code", "course_code"]) ?? "",
        courseName: readString(item, ["course", "course_name"]) ?? "",
        dueAt: readString(item, ["time", "due_at", "deadline"]),
      },
    ];
  });
}

export function taskIdsOf(data: unknown): Set<string> {
  return new Set(extractTodoTasks(data).map((task) => task.id));
}

/**
 * New tasks in this tick: present now, absent from the pre-write cache
 * snapshot, and never seen in the persisted ledger. The ledger filter is
 * what keeps a cache wipe (or a reinstall that kept userData) from
 * replaying history as notifications.
 */
export function diffNewTasks(
  prevData: unknown,
  nextData: unknown,
  seenIds: ReadonlySet<string>,
): NewTaskInfo[] {
  const prevIds = taskIdsOf(prevData);
  return extractTodoTasks(nextData).filter(
    (task) => !prevIds.has(task.id) && !seenIds.has(task.id),
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function scalarString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}
