import type { InAppNotification } from "../../shared/notifications";
import { nodeFileSystem, nodePath, systemClock, systemRandom } from "../platform/node";
import type { ClockService, FileSystemService, PathService, RandomService } from "../platform/services";

interface StoredFeed {
  version: 1;
  accountId: string;
  entries: InAppNotification[];
}

/** Cap so the fallback feed never grows without bound on-device. */
export const MAX_IN_APP_NOTIFICATIONS = 100;

export function notificationFeedFileFor(
  rootDir: string,
  accountId: string,
  pathService: PathService = nodePath,
): string {
  return pathService.join(rootDir, safePathSegment(accountId), "notifications.json");
}

/**
 * The persisted in-app fallback feed (#23): every notification the sinks
 * fanned out, newest first. The renderer reads it over IPC so a missed or
 * failed OS notification still leaves a trace to check.
 */
export interface NotificationStore {
  readonly accountId: string;
  list(): InAppNotification[];
  append(entry: InAppNotification): InAppNotification[];
  markRead(ids: Iterable<string>): InAppNotification[];
  markAllRead(): InAppNotification[];
}

export interface NotificationStoreServices {
  readonly fileSystem?: FileSystemService;
  readonly path?: PathService;
  readonly clock?: ClockService;
  readonly random?: RandomService;
}

export function createNotificationStore(
  rootDir: string,
  accountId: string,
  services: NotificationStoreServices = {},
): NotificationStore {
  const fileSystem = services.fileSystem ?? nodeFileSystem;
  const pathService = services.path ?? nodePath;
  const clock = services.clock ?? systemClock;
  const random = services.random ?? systemRandom;
  const filePath = notificationFeedFileFor(rootDir, accountId, pathService);

  function load(): InAppNotification[] {
    try {
      const stored = JSON.parse(fileSystem.readText(filePath)) as unknown;
      if (!isStoredFeed(stored, accountId)) return [];
      return stored.entries;
    } catch {
      return [];
    }
  }

  function persist(entries: InAppNotification[]) {
    const stored: StoredFeed = {
      version: 1,
      accountId,
      entries: entries.slice(0, MAX_IN_APP_NOTIFICATIONS),
    };
    fileSystem.atomicWrite(filePath, JSON.stringify(stored), `${clock.now()}-${random.next()}`);
    return stored.entries;
  }

  return {
    accountId,
    list: () => load(),
    append(entry) {
      const entries = load().filter((existing) => existing.id !== entry.id);
      entries.unshift(entry);
      return persist(entries);
    },
    markRead(ids) {
      const wanted = new Set(ids);
      return persist(load().map((entry) => (wanted.has(entry.id) ? { ...entry, read: true } : entry)));
    },
    markAllRead() {
      return persist(load().map((entry) => ({ ...entry, read: true })));
    },
  };
}

function isStoredFeed(value: unknown, accountId: string): value is StoredFeed {
  if (typeof value !== "object" || value === null) return false;
  const stored = value as Partial<StoredFeed>;
  return (
    stored.version === 1 &&
    stored.accountId === accountId &&
    Array.isArray(stored.entries) &&
    stored.entries.every(isInAppNotification)
  );
}

export function isInAppNotification(value: unknown): value is InAppNotification {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<InAppNotification>;
  const kindOk =
    entry.kind === undefined ||
    entry.kind === "single" ||
    entry.kind === "digest" ||
    entry.kind === "presence";
  const taskIdsOk =
    Array.isArray(entry.taskIds) &&
    entry.taskIds.every((id): id is string => typeof id === "string");
  const presenceIdsOk =
    entry.presenceIds === undefined ||
    (Array.isArray(entry.presenceIds) &&
      entry.presenceIds.every((id): id is string => typeof id === "string"));
  const presenceShapeOk = entry.kind !== "presence" || Array.isArray(entry.presenceIds);
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.body === "string" &&
    taskIdsOk &&
    kindOk &&
    presenceIdsOk &&
    presenceShapeOk &&
    typeof entry.createdAt === "string" &&
    typeof entry.read === "boolean"
  );
}

function safePathSegment(value: string): string {
  if (value !== "." && value !== ".." && /^[a-zA-Z0-9._-]+$/.test(value)) return value;
  return `encoded-${encodeURIComponent(value)}`;
}
