import type { PresenceWindowInfo } from "../../shared/notifications";

/**
 * Presence-open detection (#24): clock computation on the explicit
 * presence-window fields in the API payload. The notification feed carries
 * no presence type, so presence is computed, not observed — a window is
 * open when now ∈ [start, end] by the clock, never by diffing.
 *
 * Window sources (all normalized here, main-process-safe):
 * - Explicit presence windows (`presence_start`/`presence_end`, `open_at`/
 *   `close_at` and narrow aliases) — the sync-spike's proven shape and the
 *   future `/course/presences/list` upcoming-window mapping.
 * - Agenda meetings (`start_at`/`end_at`) — the class meetings during which
 *   Presence opens. The agenda feed is already synced, so v1 alerts on it;
 *   when the upcoming-windows endpoint is mapped, its records flow through
 *   the same extractor with no caller change.
 *
 * History-shaped presence records (a lone `date` with a Hadir/Alpa status
 * and no end) are deliberately NOT windows — they describe the past, and
 * promoting them would false-positive on every sync.
 */

const START_KEYS = [
  "presence_start",
  "presenceStart",
  "presence_start_at",
  "open_at",
  "openAt",
  "window_start",
  "windowStart",
  "start_at",
  "startAt",
  "start_time",
  "meeting_start",
] as const;

const END_KEYS = [
  "presence_end",
  "presenceEnd",
  "presence_end_at",
  "close_at",
  "closeAt",
  "window_end",
  "windowEnd",
  "end_at",
  "endAt",
  "end_time",
  "meeting_end",
  "end",
] as const;

const ID_KEYS = [
  "id",
  "presence_id",
  "meeting_id",
  "agenda_id",
  "window_id",
] as const;

export interface PresenceWindow extends PresenceWindowInfo {
  /** Parsed open instant (ms since epoch) — timezone-correct via Date.parse. */
  startMs: number;
  /** Parsed close instant (ms since epoch). */
  endMs: number;
}

/** Extracts openable Presence windows from a raw feed payload, in feed order. */
export function extractPresenceWindows(data: unknown): PresenceWindow[] {
  const rows = topLevelRows(data);
  const windows: PresenceWindow[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    // Per-course rows (presences/list shape) carry a nested meetings array —
    // each nested record is a candidate window with the row's course context.
    const nested = nestedMeetings(row);
    if (nested.length > 0) {
      const courseCode =
        readString(row, ["course_code", "code", "courseCode"]) ?? "";
      const courseName =
        readString(row, [
          "courses_name",
          "course_name",
          "course",
          "courseName",
          "name",
        ]) ?? "";
      for (const [meetingIndex, meeting] of nested.entries()) {
        const window = toWindow(meeting, {
          courseCode,
          courseName,
          rowIndex,
          meetingIndex,
        });
        if (window) windows.push(window);
      }
      continue;
    }
    // Flat meeting records (agenda shape, explicit presence windows).
    const window = toWindow(row, { rowIndex });
    if (window) windows.push(window);
  }
  return windows;
}

/** True when the window is open at nowMs: start ≤ now ≤ end. */
export function isWindowOpen(window: PresenceWindow, nowMs: number): boolean {
  return nowMs >= window.startMs && nowMs <= window.endMs;
}

/** Windows open at nowMs, in feed order. */
export function openWindows(
  windows: PresenceWindow[],
  nowMs: number,
): PresenceWindow[] {
  return windows.filter((window) => isWindowOpen(window, nowMs));
}

export interface PresenceDelay {
  delayMs: number;
  /** The future window the tick aligned to, if any. */
  alignedWindowId: string | null;
}

/**
 * Event-aligned next tick (#24, proven in the sync spike): never sleep past
 * a window opening by more than a grace, otherwise keep the regular
 * jittered cadence. Returns the regular delay unless a future window opens
 * sooner (opening + grace still beats the regular tick).
 */
export function nextPresenceDelay(
  windows: PresenceWindow[],
  nowMs: number,
  regularDelayMs: number,
  graceMs = 1500,
): PresenceDelay {
  let next: PresenceWindow | null = null;
  for (const window of windows) {
    if (window.startMs <= nowMs) continue;
    if (!next || window.startMs < next.startMs) next = window;
  }
  if (!next) return { delayMs: regularDelayMs, alignedWindowId: null };
  const aligned = Math.max(1000, next.startMs - nowMs + graceMs);
  if (aligned < regularDelayMs) {
    return { delayMs: Math.round(aligned), alignedWindowId: next.id };
  }
  return { delayMs: regularDelayMs, alignedWindowId: null };
}

interface WindowContext {
  courseCode?: string;
  courseName?: string;
  rowIndex: number;
  meetingIndex?: number;
}

function toWindow(
  record: Record<string, unknown>,
  context: WindowContext,
): PresenceWindow | null {
  const startRaw = readString(record, [...START_KEYS]);
  const endRaw = readString(record, [...END_KEYS]);
  if (!startRaw || !endRaw) return null;
  const startMs = Date.parse(startRaw);
  const endMs = Date.parse(endRaw);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  if (endMs < startMs) return null;

  const courseCode =
    context.courseCode ??
    readString(record, ["course_code", "code", "courseCode"]) ??
    "";
  const courseName =
    context.courseName ??
    readString(record, [
      "courses_name",
      "course_name",
      "course",
      "courseName",
    ]) ??
    "";
  const meeting =
    readString(record, [
      "name",
      "title",
      "meeting_name",
      "meetingName",
      "topic",
      "meeting",
      "week",
      "pertemuan",
      "description",
      "label",
    ]) ?? "Meeting";

  const explicitId = readId(record);
  // Composite fallback is stable across ticks (course + meeting + start
  // never shift on reorder, unlike a positional index), so id-less windows
  // can still alert exactly once. Task detection (#23) has no such stable
  // composite and correctly skips id-less rows instead.
  const id =
    explicitId ??
    `${courseCode}|${courseName}|${meeting}|${startRaw}`;
  void context.rowIndex;
  void context.meetingIndex;

  return {
    id,
    courseCode,
    courseName,
    meeting,
    startAt: startRaw,
    endAt: endRaw,
    startMs,
    endMs,
  };
}

function topLevelRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(asRecordValue);
  const root = asRecord(data);
  if (!root) return [];
  for (const key of ["data", "agenda", "meetings", "presences", "courses", "windows"]) {
    if (Array.isArray(root[key])) {
      return (root[key] as unknown[]).flatMap(asRecordValue);
    }
  }
  return [];
}

function nestedMeetings(row: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["presences", "meetings", "records", "items", "windows", "attendance"]) {
    const value = row[key];
    if (Array.isArray(value)) {
      const records = (value as unknown[]).flatMap(asRecordValue);
      // Only treat the nested array as window candidates when at least one
      // record carries an explicit start field — otherwise this is a
      // history-shaped row (date + status) and must not become windows.
      if (records.some((record) => readString(record, [...START_KEYS]) !== null)) {
        return records;
      }
      return [];
    }
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecordValue(value: unknown): Record<string, unknown>[] {
  const record = asRecord(value);
  return record ? [record] : [];
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function readId(record: Record<string, unknown>): string | null {
  for (const key of ID_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}
