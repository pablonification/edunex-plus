import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import type { FeedKey, FeedSnapshot } from "../../shared/feeds";
import {
  Clock,
  FileSystem,
  Path,
  Random,
  type ClockService,
  type FileSystemService,
  type PathService,
  type RandomService,
} from "../platform/services";

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
  readonly fileSystem: FileSystemService;
  readonly path: PathService;
  readonly clock: ClockService;
  readonly random: RandomService;
}

/**
 * One JSON file per account/feed. The account id comes from the authenticated
 * API session, while the file contents retain the exact vendor response for
 * offline reading and the next sync's diff baseline.
 */
export function createSnapshotCache(
  rootDir: string,
  services: SnapshotCacheServices,
): SnapshotCache {
  const { fileSystem, path: pathService, clock, random } = services;

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

export type SnapshotEffect<A> = EffectModule.Effect.Effect<A, never, never>;

/** Effect-facing port for the per-account, per-feed JSON snapshot cache. */
export interface SnapshotCacheServiceShape {
  readonly read: (accountId: string, feed: FeedKey) => SnapshotEffect<FeedSnapshot | null>;
  readonly get: (accountId: string, feed: FeedKey) => SnapshotEffect<FeedSnapshot | null>;
  readonly write: (
    accountId: string,
    feed: FeedKey,
    data: unknown,
    fetchedAt?: string,
  ) => SnapshotEffect<FeedSnapshot>;
}

/** Explicit Context key for persisted Student feed snapshots. */
export class SnapshotCacheService extends effectRuntime.Context.Service<
  SnapshotCacheService,
  SnapshotCacheServiceShape
>()("EdunexPlus/SnapshotCacheService") {}

// Domain-oriented aliases share one Context key.
export const SnapshotService = SnapshotCacheService;
export const FeedCacheService = SnapshotCacheService;
export const CacheService = SnapshotCacheService;
export type SnapshotServiceShape = SnapshotCacheServiceShape;
export type FeedCacheServiceShape = SnapshotCacheServiceShape;

/** Lift the existing synchronous cache seam into Effects. */
export function createSnapshotCacheService(cache: SnapshotCache): SnapshotCacheServiceShape {
  const read = (accountId: string, feed: FeedKey): SnapshotEffect<FeedSnapshot | null> =>
    effectRuntime.Effect.sync(() => {
      try {
        // SnapshotCache.read already treats missing/corrupt files as absent;
        // this outer guard keeps that contract true for injected test ports.
        return cache.read(accountId, feed);
      } catch {
        return null;
      }
    });

  return {
    read,
    get: read,
    write: (accountId, feed, data, fetchedAt) =>
      effectRuntime.Effect.sync(() => cache.write(accountId, feed, data, fetchedAt)),
  };
}

/**
 * Live cache layer. The root directory and all filesystem effects are supplied
 * explicitly; no cache operation reaches Node globals when this layer is used.
 */
export function createSnapshotCacheLayer(options: {
  readonly rootDir: string;
}): EffectModule.Layer.Layer<
  SnapshotCacheService,
  never,
  FileSystem | Path | Clock | Random
> {
  return effectRuntime.Layer.effect(
    SnapshotCacheService,
    effectRuntime.Effect.gen(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const clock = yield* Clock;
      const random = yield* Random;
      const cache = createSnapshotCache(options.rootDir, {
        fileSystem,
        path,
        clock,
        random,
      });
      return createSnapshotCacheService(cache);
    }),
  ) as EffectModule.Layer.Layer<
    SnapshotCacheService,
    never,
    FileSystem | Path | Clock | Random
  >;
}

/** Composition helper when a cache has already been made with test doubles. */
export function createSnapshotCacheLayerFromCache(
  cache: SnapshotCache,
): EffectModule.Layer.Layer<SnapshotCacheService, never, never> {
  return effectRuntime.Layer.succeed(SnapshotCacheService, createSnapshotCacheService(cache));
}

export const SnapshotCacheServiceLive = createSnapshotCacheLayer;
export const SnapshotServiceLive = createSnapshotCacheLayer;
export const createSnapshotServiceLayer = createSnapshotCacheLayer;
export const createFeedCacheLayer = createSnapshotCacheLayer;
