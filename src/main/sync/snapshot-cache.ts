import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { FeedKey, FeedSnapshot } from "../../shared/feeds";

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

/**
 * One JSON file per account/feed. The account id comes from the authenticated
 * API session, while the file contents retain the exact vendor response for
 * offline reading and the next sync's diff baseline.
 */
export function createSnapshotCache(rootDir: string): SnapshotCache {
  function filePath(accountId: string, feed: FeedKey) {
    return path.join(rootDir, safePathSegment(accountId), `${feed}.json`);
  }

  return {
    read(accountId, feed) {
      try {
        const stored = JSON.parse(readFileSync(filePath(accountId, feed), "utf8")) as unknown;
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

    write(accountId, feed, data, fetchedAt = new Date().toISOString()) {
      const snapshot: FeedSnapshot = { feed, accountId, fetchedAt, data };
      const stored: StoredSnapshot = { version: 1, ...snapshot };
      const target = filePath(accountId, feed);
      const directory = path.dirname(target);
      const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;

      mkdirSync(directory, { recursive: true });
      try {
        writeFileSync(temporary, JSON.stringify(stored));
        renameSync(temporary, target);
      } catch (error) {
        if (existsSync(temporary)) unlinkSync(temporary);
        throw error;
      }

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
