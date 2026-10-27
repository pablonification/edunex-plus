// The app's own log (ADR 0014): what it did in the last hour, so a problem report says what led up
// to it (a sign-in that went round, a read that failed, a notification that never showed, the
// window breaking). In memory only, never on disk, 300 entries at most; a report takes it scrubbed
// with its own rules (./report/report.ts). Main writes to it too: the window's errors, the updater.
import type { LogEntry, LogLevel } from "../core/models";

/** As long as a report looks back. */
const KEEP_MS = 60 * 60_000;
const MAX_ENTRIES = 300;
const MAX_MESSAGE = 500;
const MAX_AREA = 40;

const cut = (text: string, max: number) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** Writes lines about one area ("phone", "update"): what a part of the app is handed instead of the whole log. */
export type AreaLog = (level: LogLevel, message: string) => void;

export class AppLog {
  private readonly kept: LogEntry[] = [];

  constructor(private readonly now: () => number) {}

  /** What happened, in a line: `area` is what it's about ("six.bills", "sign-in", "window"). */
  add(level: LogLevel, area: string, message: string): void {
    this.kept.push({ at: this.now(), level, area: cut(area, MAX_AREA), message: cut(message, MAX_MESSAGE) });
    this.drop();
  }

  /** Lines about `area`, for a part of the app that writes only those. */
  for(area: string): AreaLog {
    return (level, message) => this.add(level, area, message);
  }

  /** Signing out, or another Student's data arriving: what the app did for the last one isn't this one's to send. */
  clear(): void {
    this.kept.length = 0;
  }

  /** The last hour, the oldest first. */
  entries(): LogEntry[] {
    this.drop();
    return this.kept.map((entry) => ({ ...entry }));
  }

  private drop(): void {
    const since = this.now() - KEEP_MS;
    let old = 0;
    while (old < this.kept.length && (this.kept[old]!.at < since || this.kept.length - old > MAX_ENTRIES)) old++;
    if (old) this.kept.splice(0, old);
  }
}

/** An error as a line of the log: its kind or name, then its message. Never its stack (it names this computer's folders). */
export function errorLine(error: unknown): string {
  if (error instanceof Error) return `${"kind" in error && typeof error.kind === "string" ? error.kind : error.name}: ${error.message}`;
  return String(error);
}
