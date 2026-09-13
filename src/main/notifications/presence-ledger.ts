import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

interface StoredPresenceLedger {
  version: 1;
  accountId: string;
  seenIds: string[];
}

/**
 * The persisted presence ledger (#24): every Presence window id the app has
 * notified for one account. Unlike the Task seen-ledger (#23) there is no
 * silent first-sync baseline — a window open right now is actionable even
 * on the first tick after login. The ledger exists only to guarantee
 * at-most-once per window across restarts (no "closing soon" reminders).
 */
export interface PresenceLedger {
  readonly accountId: string;
  has(id: string): boolean;
  readonly size: number;
  add(ids: Iterable<string>): string[];
  save(): void;
}

export function presenceLedgerFileFor(rootDir: string, accountId: string): string {
  return path.join(rootDir, safePathSegment(accountId), "seen-presence.json");
}

export function createPresenceLedger(rootDir: string, accountId: string): PresenceLedger {
  const filePath = presenceLedgerFileFor(rootDir, accountId);
  const seen = new Set<string>();

  try {
    const stored = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (isStoredLedger(stored, accountId)) {
      for (const id of stored.seenIds) seen.add(id);
    }
  } catch {
    // Missing or unreadable ledger — start empty; open windows notify.
  }

  return {
    accountId,
    has: (id) => seen.has(id),
    get size() {
      return seen.size;
    },
    add(ids) {
      const added: string[] = [];
      for (const id of ids) {
        if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
        seen.add(id);
        added.push(id);
      }
      return added;
    },
    save() {
      const stored: StoredPresenceLedger = {
        version: 1,
        accountId,
        seenIds: [...seen],
      };
      const directory = path.dirname(filePath);
      const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      mkdirSync(directory, { recursive: true });
      try {
        writeFileSync(temporary, JSON.stringify(stored));
        renameSync(temporary, filePath);
      } catch (error) {
        if (existsSync(temporary)) unlinkSync(temporary);
        throw error;
      }
    },
  };
}

function isStoredLedger(value: unknown, accountId: string): value is StoredPresenceLedger {
  if (typeof value !== "object" || value === null) return false;
  const stored = value as Partial<StoredPresenceLedger>;
  return (
    stored.version === 1 &&
    stored.accountId === accountId &&
    Array.isArray(stored.seenIds) &&
    stored.seenIds.every((id): id is string => typeof id === "string")
  );
}

function safePathSegment(value: string): string {
  if (value !== "." && value !== ".." && /^[a-zA-Z0-9._-]+$/.test(value)) return value;
  return `encoded-${encodeURIComponent(value)}`;
}
