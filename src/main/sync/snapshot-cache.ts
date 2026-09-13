import type { FeedKey, FeedSnapshot } from "../../shared/feeds";
import { nodeFileSystem, nodePath, systemClock, systemRandom } from "../platform/node";
import type { ClockService, FileSystemService, PathService, RandomService } from "../platform/services";

interface StoredSnapshot {
  version: 1;
  feed: FeedKey;
  accountId: string;
  fetchedAt: string;
  data: unknown;
}

export interface SnapshotCache {
  read(accountId: string, feed: FeedKey): FeedSnapshot | null;
  write(
    accountId: string,
    feed: FeedKey,
    data: unknown,
    fetchedAt?: string,
  ): FeedSnapshot;
}

export interface SnapshotCacheServices {
  readonly fileSystem?: FileSystemService;
  readonly path?: PathService;
  readonly clock?: ClockService;
  readonly random?: RandomService;
}

/**
 * One JSON file per account/feed. The account id comes from the authenticated
 * API session, while the file contents retain the exact vendor response for
 * offline reading and the next sync's diff baseline.
 */
export function createSnapshotCache(
  rootDir: string,
  services: SnapshotCacheServices = {},
): SnapshotCache {
  const fileSystem = services.fileSystem ?? nodeFileSystem;
  const pathService = services.path ?? nodePath;
  const clock = services.clock ?? systemClock;
  const random = services.random ?? systemRandom;

  function filePath(accountId: string, feed: FeedKey) {
    return pathService.join(rootDir, safePathSegment(accountId), `${feed}.json`);
  }

  return {
    read(accountId, feed) {
      try {
        const stored = JSON.parse(fileSystem.readText(filePath(accountId, feed))) as unknown;
        if (!isStoredSnapshot(stored, accountId, feed)) return null;
        return {
          feed: stored.feed,
          accountId: stored.accountId,
          fetchedAt: stored.fetchedAt,
          data: stored.data,
        };
      } catch {
        return null;
      }
    },

    write(accountId, feed, data, fetchedAt = new Date(clock.now()).toISOString()) {
      const snapshot: FeedSnapshot = { feed, accountId, fetchedAt, data };
      const stored: StoredSnapshot = { version: 1, ...snapshot };
      const target = filePath(accountId, feed);
      fileSystem.atomicWrite(target, JSON.stringify(stored), `${clock.now()}-${random.next()}`);

      return snapshot;
    },
  };
}

function isStoredSnapshot(
  value: unknown,
  accountId: string,
  feed: FeedKey,
): value is StoredSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const stored = value as Partial<StoredSnapshot>;
  return (
    stored.version === 1 &&
    stored.accountId === accountId &&
    stored.feed === feed &&
    typeof stored.fetchedAt === "string" &&
    "data" in stored
  );
}

function safePathSegment(value: string): string {
  if (value !== "." && value !== ".." && /^[a-zA-Z0-9._-]+$/.test(value)) return value;
  return `encoded-${encodeURIComponent(value)}`;
}
