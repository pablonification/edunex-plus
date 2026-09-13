import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

interface StoredLedger {
  version: 1;
  accountId: string;
  seenIds: string[];
}

/**
 * The persisted seen-ledger (#23): every Task id the app has ever baselined
 * or notified for one account. The file's existence is the first-sync flag —
 * a missing file means this account has never synced, so the next tick
 * baselines silently instead of replaying the whole backlog.
 */
export interface SeenLedger {
  readonly accountId: string;
  /** True once the ledger file has been created (baseline taken). */
  readonly initialized: boolean;
  has(id: string): boolean;
  readonly size: number;
  /** Adds ids; returns the ids that were actually new. */
  add(ids: Iterable<string>): string[];
  save(): void;
}

export function ledgerFileFor(rootDir: string, accountId: string): string {
  return path.join(rootDir, safePathSegment(accountId), "seen-tasks.json");
}

export function createSeenLedger(rootDir: string, accountId: string): SeenLedger {
  const filePath = ledgerFileFor(rootDir, accountId);
  const seen = new Set<string>();
  let initialized = false;

  try {
    const stored = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (isStoredLedger(stored, accountId)) {
      for (const id of stored.seenIds) seen.add(id);
      initialized = true;
    }
  } catch {
    // Missing or unreadable ledger — treated as first sync (silent baseline).
  }

  return {
    accountId,
    get initialized() {
      return initialized;
    },
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
      const stored: StoredLedger = {
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
      initialized = true;
    },
  };
}

function isStoredLedger(value: unknown, accountId: string): value is StoredLedger {
  if (typeof value !== "object" || value === null) return false;
  const stored = value as Partial<StoredLedger>;
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
