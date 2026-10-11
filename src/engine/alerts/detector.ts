// What an alert detector is. A detector is a small module that looks at the
// datasets it watches and says what the Student should be told: right away
// when something changed (a new Task), or at a moment (24 hours before a
// deadline, the minute a Presence window opens). The alert center does the
// rest: never twice, a silent first sync, grouping, Settings, the history.
import type { Alert, DatasetName, DatasetValue } from "../../core/models";

/** An alert a detector proposes. Its id must be stable: the same event, the same id, every time. */
export interface AlertDraft extends Omit<Alert, "at"> {
  /** Delivered the moment it's raised and never grouped (Presence opening, short-window Tasks). */
  urgent?: boolean;
}

/** An alert tied to a moment. The center raises it at `at`, and not at all once `until` has passed. */
export interface PlannedAlert extends AlertDraft {
  at: number;
  until: number;
}

/** What a detector can read: the current datasets and the engine's clock. */
export interface DetectorContext {
  now: number;
  get<N extends DatasetName>(name: N): DatasetValue<N> | undefined;
}

/** One dataset changed. `previous` is undefined for its first value after sign-in (that one is the silent baseline). */
export type DatasetChange = { [N in DatasetName]: { name: N; previous: DatasetValue<N> | undefined; next: DatasetValue<N> } }[DatasetName];

export interface Detector {
  name: string;
  /** The datasets it looks at: it runs, and its plan is redone, whenever one of them changes. */
  watches: readonly DatasetName[];
  /** Alerts for what just changed. */
  changed?(change: DatasetChange, context: DetectorContext): AlertDraft[];
  /** Every alert tied to a moment that the current data implies, past or future. */
  plan?(context: DetectorContext): PlannedAlert[];
}

/** "23:59" on this computer's clock: alert text names times the way the Student reads them. */
export function clockTime(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
