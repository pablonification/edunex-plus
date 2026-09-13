import { nodeFileSystem, nodePath, systemClock, systemRandom } from "../platform/node";
import type { ClockService, FileSystemService, PathService, RandomService } from "../platform/services";

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

export function presenceLedgerFileFor(
  rootDir: string,
  accountId: string,
  pathService: PathService = nodePath,
): string {
  return pathService.join(rootDir, safePathSegment(accountId), "seen-presence.json");
}

export interface PresenceLedgerServices {
  readonly fileSystem?: FileSystemService;
  readonly path?: PathService;
  readonly clock?: ClockService;
  readonly random?: RandomService;
}

export function createPresenceLedger(
  rootDir: string,
  accountId: string,
  services: PresenceLedgerServices = {},
): PresenceLedger {
  const fileSystem = services.fileSystem ?? nodeFileSystem;
  const pathService = services.path ?? nodePath;
  const clock = services.clock ?? systemClock;
  const random = services.random ?? systemRandom;
  const filePath = presenceLedgerFileFor(rootDir, accountId, pathService);
  const seen = new Set<string>();

  try {
    const stored = JSON.parse(fileSystem.readText(filePath)) as unknown;
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
      fileSystem.atomicWrite(filePath, JSON.stringify(stored), `${clock.now()}-${random.next()}`);
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
