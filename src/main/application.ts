import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import type { AuthStatus } from "../shared/auth";
import type { FeedSnapshot } from "../shared/feeds";
import type { InAppNotification, OutboundNotification } from "../shared/notifications";
import {
  AuthService,
  createAuthLayer,
  edunexUserAgent,
  EDUNEX_API_BASE_URL,
  type AuthServiceShape,
} from "./auth/auth-service";
import {
  CognisiaService,
  createCognisiaLayer,
  type CognisiaServiceShape,
} from "./api/api-service";
import {
  createMaterialDownloadLayer,
  MaterialDownloadService,
  type MaterialDownloadServiceShape,
} from "./materials/download";
import {
  createNotificationLayer,
  NotificationService,
  type NotificationServiceShape,
} from "./notifications/notification-service";
import {
  createApplicationRuntime,
  composeApplicationLayer,
  RuntimeEffect,
  type ApplicationRuntime,
} from "./effect/runtime";
import { effectRuntime } from "./effect/effect-runtime";
import {
  createSnapshotCacheLayer,
  SnapshotCacheService,
  type SnapshotCacheServiceShape,
} from "./sync/snapshot-cache";
import {
  createSyncServiceLayer,
  SyncService,
  type SyncServiceShape,
} from "./sync/sync-engine";
import {
  createTaskAnswerLayer,
  TaskAnswerService,
  type TaskAnswerServiceShape,
} from "./tasks/task-answers";
import type { LivePlatform } from "./platform/live";

/** Host callbacks are the only values the application composition publishes. */
export interface ApplicationCompositionOptions {
  readonly platform: LivePlatform;
  readonly sessionStorePath: string;
  readonly snapshotRoot: string;
  readonly seenLedgerRoot: string;
  readonly notificationFeedRoot: string;
  readonly onAuthState?: (status: AuthStatus) => void;
  readonly onFeedUpdated?: (snapshot: FeedSnapshot) => void;
  readonly onNotificationClicked?: (notification: OutboundNotification) => void;
  readonly onNotificationsUpdated?: (accountId: string, entries: InAppNotification[]) => void;
}

export interface ApplicationServices {
  readonly auth: AuthServiceShape;
  readonly cognisia: CognisiaServiceShape;
  readonly snapshotCache: SnapshotCacheServiceShape;
  readonly taskAnswers: TaskAnswerServiceShape;
  readonly materialDownloads: MaterialDownloadServiceShape;
  readonly notifications: NotificationServiceShape;
  readonly sync: SyncServiceShape;
}

/**
 * The complete production application graph and its one managed runtime.
 *
 * The composition owns Layer construction and service resolution. Callers do
 * not provide individual feature layers or create another runtime; they use
 * the resolved service bundle and call `shutdown` at the process boundary.
 */
export interface ApplicationComposition {
  readonly runtime: ApplicationRuntime<never, never>;
  readonly services: ApplicationServices;
  readonly shutdown: () => Promise<void>;
}

interface RuntimeBridge {
  readonly runSync: <A>(effect: EffectModule.Effect.Effect<A, never, never>) => A | undefined;
  readonly forkSync: <A>(
    effect: EffectModule.Effect.Effect<A, never, never>,
  ) => EffectModule.Fiber.Fiber<A, never> | undefined;
  setRuntime(runtime: ApplicationRuntime<never, never>): void;
}

function createRuntimeBridge(): RuntimeBridge {
  let runtime: ApplicationRuntime<never, never> | null = null;

  return {
    setRuntime(next) {
      runtime = next;
    },
    runSync(effect) {
      if (!runtime || runtime.isShutdown()) return;
      return runtime.runSync(effect);
    },
    forkSync(effect) {
      if (!runtime || runtime.isShutdown()) return;
      return runtime.forkSync(effect);
    },
  };
}

/** Builds the production service graph exactly once for the process. */
export function createApplicationComposition(
  options: ApplicationCompositionOptions,
): ApplicationComposition {
  const { platform } = options;
  const bridge = createRuntimeBridge();
  let syncService: SyncServiceShape | null = null;

  const authLayer = createAuthLayer({
    sessionStorePath: options.sessionStorePath,
    appVersion: platform.services.electron.appVersion,
    broadcast: (status) => {
      try {
        options.onAuthState?.(status);
      } catch {
        // A destroyed renderer must not make a valid auth transition fail.
      }

      const sync = syncService;
      if (!sync) return;
      try {
        bridge.runSync(status === "signed-in" ? sync.start() : sync.stop());
      } catch {
        // Lifecycle callbacks are best effort at the host boundary.
      }
    },
    // Webview capture is a long-lived callback from Electron. Its polling
    // fiber is forked into this process runtime's managed scope.
    forkEffect: bridge.forkSync,
  });

  const taskAnswerLayer = createTaskAnswerLayer().pipe(
    effectRuntime.Layer.provide(authLayer),
  );
  const materialDownloadLayer = createMaterialDownloadLayer({
    baseUrl: EDUNEX_API_BASE_URL,
    userAgent: edunexUserAgent(platform.services.electron.appVersion),
  }).pipe(effectRuntime.Layer.provide(authLayer));

  const notificationLayer = createNotificationLayer({
    ledgerRoot: options.seenLedgerRoot,
    feedRoot: options.notificationFeedRoot,
    onClicked: options.onNotificationClicked,
    broadcast: options.onNotificationsUpdated,
  });

  const readAndCacheLayer = effectRuntime.Layer.mergeAll(
    createCognisiaLayer(),
    createSnapshotCacheLayer({ rootDir: options.snapshotRoot }),
  ).pipe(effectRuntime.Layer.provideMerge(authLayer));

  const syncDependenciesLayer = effectRuntime.Layer.mergeAll(
    authLayer,
    readAndCacheLayer,
    notificationLayer,
  ).pipe(effectRuntime.Layer.provideMerge(platform.layer));
  const syncLayer = createSyncServiceLayer({
    onFeedUpdated: options.onFeedUpdated,
  }).pipe(effectRuntime.Layer.provide(syncDependenciesLayer));

  // This is the only production composition boundary. Every feature layer is
  // present here and receives the same platform adapters and runtime scope.
  const applicationLayer = effectRuntime.Layer.mergeAll(
    authLayer,
    taskAnswerLayer,
    materialDownloadLayer,
    readAndCacheLayer,
    notificationLayer,
    syncLayer,
  ).pipe(effectRuntime.Layer.provideMerge(platform.layer));
  const runtime = createApplicationRuntime(composeApplicationLayer(applicationLayer));
  bridge.setRuntime(runtime);

  const services: ApplicationServices = {
    auth: runtime.runSync(RuntimeEffect.service(AuthService)),
    cognisia: runtime.runSync(RuntimeEffect.service(CognisiaService)),
    snapshotCache: runtime.runSync(RuntimeEffect.service(SnapshotCacheService)),
    taskAnswers: runtime.runSync(RuntimeEffect.service(TaskAnswerService)),
    materialDownloads: runtime.runSync(RuntimeEffect.service(MaterialDownloadService)),
    notifications: runtime.runSync(RuntimeEffect.service(NotificationService)),
    sync: runtime.runSync(RuntimeEffect.service(SyncService)),
  };
  syncService = services.sync;

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = Promise.resolve()
      .then(() => {
        try {
          runtime.runSync(services.sync.stop());
        } catch {
          // Runtime disposal below is still the final interruption boundary.
        }
        return runtime.shutdown();
      })
      .then(() => undefined);
    return shutdownPromise;
  };

  return { runtime, services, shutdown };
}

/** Naming alias for hosts that call the composition a production graph. */
export const createApplicationGraph = createApplicationComposition;
