import type { FeedKey } from "../../shared/feeds";
import type { MaterialDownloadRequest } from "../../shared/materials";
import type { InAppNotification } from "../../shared/notifications";
import type { AppInfo, NavKey, ShellSettings } from "../../shared/shell";
import type {
  SubmitAnswerInput,
} from "../../shared/submission";
import type { MaterialDownloadServiceShape } from "../materials/download";
import type { TaskAnswerServiceShape } from "../tasks/task-answers";
import type { AuthServiceShape } from "../auth/auth-service";
import type { NotificationServiceShape } from "../notifications/notification-service";
import type { SyncServiceShape } from "../sync/sync-engine";
import type { ApplicationRuntime } from "../effect/runtime";
import { effectRuntime } from "../effect/effect-runtime";
import type { IpcMainService } from "../platform/services";
import { registerIpcOperations, type IpcAdapter } from "./adapter";

export interface ApplicationIpcDependencies {
  readonly ipcMain: IpcMainService;
  readonly runtime: ApplicationRuntime<any, any>;
  showTestNotification(): void;
  getAppInfo(): AppInfo;
  readonly auth: {
    status: AuthServiceShape["status"];
    startLogin: AuthServiceShape["startLogin"];
    accountId: AuthServiceShape["accountId"];
  };
  readonly sync: {
    read: SyncServiceShape["read"];
  };
  readonly materialDownloadService: Pick<MaterialDownloadServiceShape, "download">;
  readonly shell: {
    getSettings(): ShellSettings;
    setViewHidden(view: NavKey, hidden: boolean): ShellSettings;
    setQuitOnClose(quitOnClose: boolean): ShellSettings;
  };
  readonly notifications: {
    readonly service: Pick<NotificationServiceShape, "list" | "markRead" | "markAllRead">;
  };
  readonly taskAnswerService: Pick<TaskAnswerServiceShape, "saveDraft" | "submit">;
}

/** Registers all renderer-facing request channels in one place. */
export function registerApplicationIpc(deps: ApplicationIpcDependencies): IpcAdapter {
  const Schema = effectRuntime.Schema;
  const noInput = Schema.Void;
  const unknownOutput = Schema.Unknown;
  const appInfo = Schema.Struct({
    version: Schema.String,
    platform: Schema.String,
    trayActive: Schema.Boolean,
    notificationsSupported: Schema.Boolean,
  });
  const shellSettings = Schema.Struct({
    hiddenViews: Schema.Array(Schema.String),
    quitOnClose: Schema.Boolean,
  });
  const feedSnapshot = Schema.Struct({
    feed: Schema.Literals(["todo", "courses", "exams", "agenda", "presences", "materials"]),
    accountId: Schema.String,
    fetchedAt: Schema.String,
    data: Schema.Unknown,
  });
  const notification = Schema.Struct({
    id: Schema.String,
    title: Schema.String,
    body: Schema.String,
    taskIds: Schema.Array(Schema.String),
    presenceIds: Schema.optional(Schema.Array(Schema.String)),
    kind: Schema.optional(Schema.Literals(["single", "digest", "presence"])),
    createdAt: Schema.String,
    read: Schema.Boolean,
  });
  const materialResult = Schema.Union([
    Schema.Struct({ ok: Schema.Literal(true), filePath: Schema.String }),
    Schema.Struct({
      ok: Schema.Literal(false),
      error: Schema.String,
      cancelled: Schema.optional(Schema.Boolean),
    }),
  ]);
  const saveDraftResult = Schema.Struct({
    ok: Schema.Boolean,
    status: Schema.Number,
    created: Schema.Boolean,
    answerId: Schema.NullOr(Schema.String),
  });
  const submitResult = Schema.Struct({ ok: Schema.Boolean, status: Schema.Number });

  const operations = [
    operation({
      channel: "notifications:test",
      operation: "notifications.test",
      inputSchema: noInput,
      outputSchema: unknownOutput,
      handle: () => deps.showTestNotification(),
      onInvalidInput: () => undefined,
      onFailure: () => undefined,
    }),
    operation({
      channel: "app:info",
      operation: "app.info",
      inputSchema: noInput,
      outputSchema: appInfo,
      handle: () => deps.getAppInfo(),
      onInvalidInput: () => safeAppInfo(),
      onFailure: () => safeAppInfo(),
    }),
    operation({
      channel: "auth:get-state",
      operation: "auth.get-state",
      inputSchema: noInput,
      outputSchema: Schema.NullOr(Schema.Literals(["signed-out", "authenticating", "signed-in", "session-expired"])),
      handle: () => deps.runtime.runPromise(deps.auth.status()),
      onInvalidInput: () => null,
      onFailure: () => null,
    }),
    operation({
      channel: "auth:start-login",
      operation: "auth.start-login",
      inputSchema: noInput,
      outputSchema: unknownOutput,
      handle: () => deps.runtime.runPromise(deps.auth.startLogin()),
      onInvalidInput: () => undefined,
      onFailure: () => undefined,
    }),
    operation({
      channel: "sync:get-feed",
      operation: "sync.get-feed",
      inputSchema: Schema.Literals(["todo", "courses", "exams", "agenda", "presences", "materials"]),
      outputSchema: Schema.NullOr(feedSnapshot),
      handle: (feed) => deps.runtime.runPromise(deps.sync.read(feed as FeedKey)),
      onInvalidInput: () => null,
      onFailure: () => null,
    }),
    operation({
      channel: "materials:download",
      operation: "materials.download",
      inputSchema: Schema.Struct({ fileUrl: Schema.String, fileName: Schema.String }),
      outputSchema: materialResult,
      handle: (request) => {
        const value = request as MaterialDownloadRequest;
        return deps.runtime.runPromise(deps.materialDownloadService.download(value));
      },
      onInvalidInput: () => ({ ok: false, error: "This material has no downloadable file." }),
      onFailure: () => ({ ok: false, error: "Download failed — check your connection and try again." }),
    }),
    operation({
      channel: "shell:get-settings",
      operation: "shell.get-settings",
      inputSchema: noInput,
      outputSchema: shellSettings,
      handle: () => deps.shell.getSettings(),
      onInvalidInput: () => deps.shell.getSettings(),
      onFailure: () => deps.shell.getSettings(),
    }),
    operation({
      channel: "shell:set-view-hidden",
      operation: "shell.set-view-hidden",
      inputSchema: Schema.Struct({ view: Schema.String, hidden: Schema.Boolean }),
      outputSchema: shellSettings,
      decodeArgs: ([view, hidden]) => ({ view, hidden }),
      handle: (input) => {
        const value = input as { view: string; hidden: boolean };
        return deps.shell.setViewHidden(value.view as NavKey, value.hidden);
      },
      onInvalidInput: () => deps.shell.getSettings(),
      onFailure: () => deps.shell.getSettings(),
    }),
    operation({
      channel: "shell:set-quit-on-close",
      operation: "shell.set-quit-on-close",
      inputSchema: Schema.Boolean,
      outputSchema: shellSettings,
      handle: (value) => deps.shell.setQuitOnClose(value === true),
      onInvalidInput: () => deps.shell.getSettings(),
      onFailure: () => deps.shell.getSettings(),
    }),
    operation({
      channel: "notifications:get",
      operation: "notifications.get",
      inputSchema: noInput,
      outputSchema: Schema.Array(notification),
      handle: () => runNotificationEffect(deps, (accountId) => deps.notifications.service.list(accountId)),
      onInvalidInput: () => [],
      onFailure: () => [],
    }),
    operation({
      channel: "notifications:mark-read",
      operation: "notifications.mark-read",
      inputSchema: Schema.Array(Schema.String),
      outputSchema: Schema.Array(notification),
      handle: (ids) => runNotificationEffect(deps, (accountId) =>
        deps.notifications.service.markRead(accountId, ids as string[]),
      ),
      onInvalidInput: () => [],
      onFailure: () => [],
    }),
    operation({
      channel: "notifications:mark-all-read",
      operation: "notifications.mark-all-read",
      inputSchema: noInput,
      outputSchema: Schema.Array(notification),
      handle: () => runNotificationEffect(deps, (accountId) =>
        deps.notifications.service.markAllRead(accountId),
      ),
      onInvalidInput: () => [],
      onFailure: () => [],
    }),
    operation({
      channel: "tasks:save-draft",
      operation: "tasks.save-draft",
      inputSchema: Schema.Struct({
        taskId: Schema.String,
        answer: Schema.String,
        answerId: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      outputSchema: saveDraftResult,
      handle: (input) => {
        const value = input as { taskId: string; answer: string; answerId?: string | null };
        const command = {
          taskId: value.taskId,
          answer: value.answer,
          answerId: value.answerId ?? null,
        };
        return deps.runtime.runPromise(deps.taskAnswerService.saveDraft(command));
      },
      onInvalidInput: () => ({ ok: false, status: 400, created: false, answerId: null }),
      onFailure: (_context, input) => {
        const answerId =
          typeof input === "object" && input !== null && "answerId" in input &&
          (typeof input.answerId === "string" || input.answerId === null)
            ? input.answerId
            : null;
        return { ok: false, status: 0, created: answerId == null, answerId };
      },
    }),
    operation({
      channel: "tasks:submit",
      operation: "tasks.submit",
      inputSchema: Schema.Struct({ answerId: Schema.String }),
      outputSchema: submitResult,
      handle: (input) => {
        const value = input as SubmitAnswerInput;
        return deps.runtime.runPromise(deps.taskAnswerService.submit(value));
      },
      onInvalidInput: () => ({ ok: false, status: 400 }),
      onFailure: () => ({ ok: false, status: 0 }),
    }),
  ];

  return registerIpcOperations(operations, {
    ipcMain: deps.ipcMain,
    runtime: deps.runtime,
  });
}

function operation(
  value: Omit<import("./adapter").IpcOperation, "decodeArgs"> & {
    readonly decodeArgs?: (args: readonly unknown[]) => unknown;
  },
): import("./adapter").IpcOperation {
  return value;
}

function safeAppInfo(): AppInfo {
  return {
    version: "unknown",
    platform: "unknown",
    trayActive: false,
    notificationsSupported: false,
  };
}

function runNotificationEffect(
  deps: ApplicationIpcDependencies,
  operation: (accountId: string | null) => import("../notifications/notification-service").NotificationEffect<InAppNotification[]>,
): Promise<InAppNotification[]> {
  return deps.runtime.runPromise(
    effectRuntime.Effect.gen(function* () {
      const accountId = yield* deps.auth.accountId();
      return yield* operation(accountId);
    }),
  );
}
