import { nodeFileSystem, nodePath, systemClock, systemRandom } from "../platform/node";
import type { ClockService, FileSystemService, PathService, RandomService } from "../platform/services";

interface StoredLedger {
  version: 1;
  accountId: string;
  seenIds: string[];
}

/** The validated on-disk state used by the Effect notification persistence service. */
export interface SeenLedgerSnapshot {
  readonly initialized: boolean;
  readonly seenIds: readonly string[];
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

export function ledgerFileFor(
  rootDir: string,
  accountId: string,
  pathService: PathService = nodePath,
): string {
  return pathService.join(rootDir, safePathSegment(accountId), "seen-tasks.json");
}

export interface SeenLedgerServices {
  readonly fileSystem?: FileSystemService;
  readonly path?: PathService;
  readonly clock?: ClockService;
  readonly random?: RandomService;
}

/**
 * Reads the existing version-1 task ledger format. Missing, malformed, or
 * account-mismatched files intentionally look like an uninitialized ledger so
 * the first valid sync can baseline silently.
 */
export function readSeenLedger(
  rootDir: string,
  accountId: string,
  services: SeenLedgerServices = {},
): SeenLedgerSnapshot {
  const fileSystem = services.fileSystem ?? nodeFileSystem;
  const pathService = services.path ?? nodePath;
  try {
    const stored = JSON.parse(
      fileSystem.readText(ledgerFileFor(rootDir, accountId, pathService)),
    ) as unknown;
    if (isStoredLedger(stored, accountId)) {
      return { initialized: true, seenIds: [...stored.seenIds] };
    }
  } catch {
    // Missing or unreadable ledger — treated as first sync.
  }
  return { initialized: false, seenIds: [] };
}

/** Writes the existing version-1 task ledger using the platform atomic-write port. */
export function writeSeenLedger(
  rootDir: string,
  accountId: string,
  seenIds: Iterable<string>,
  services: SeenLedgerServices = {},
): void {
  const fileSystem = services.fileSystem ?? nodeFileSystem;
  const pathService = services.path ?? nodePath;
  const clock = services.clock ?? systemClock;
  const random = services.random ?? systemRandom;
  const stored: StoredLedger = {
    version: 1,
    accountId,
    seenIds: [...seenIds],
  };
  fileSystem.atomicWrite(
    ledgerFileFor(rootDir, accountId, pathService),
    JSON.stringify(stored),
    `${clock.now()}-${random.next()}`,
  );
}

export function createSeenLedger(
  rootDir: string,
  accountId: string,
  services: SeenLedgerServices = {},
): SeenLedger {
  const fileSystem = services.fileSystem ?? nodeFileSystem;
  const pathService = services.path ?? nodePath;
  const clock = services.clock ?? systemClock;
  const random = services.random ?? systemRandom;
  const snapshot = readSeenLedger(rootDir, accountId, {
    fileSystem,
    path: pathService,
    clock,
    random,
  });
  const seen = new Set(snapshot.seenIds);
  let initialized = snapshot.initialized;

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
      writeSeenLedger(rootDir, accountId, seen, {
        fileSystem,
        path: pathService,
        clock,
        random,
      });
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
