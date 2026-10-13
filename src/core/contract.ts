// The bridge between the screens and the engine: one typed list of actions
// (renderer → main, request/response) and events (main → renderer). Both
// sides check every message against these schemas. Each area keeps its
// actions in its own file under ./actions; this file joins them.
import { z } from "zod";
import { alertsActions } from "./actions/alerts";
import { coreActions } from "./actions/core";
import { coursePageActions } from "./actions/course-page";
import { filesActions } from "./actions/files";
import { scheduleActions } from "./actions/schedule";
import { sixActions } from "./actions/six";
import { tasksActions } from "./actions/tasks";
import { updatesActions } from "./actions/updates";
import { Settings, SourceStatus } from "./models";
import { Route } from "./route";
import { DatasetPayload } from "./snapshot";

export { AppSnapshot, DatasetPayload, Snapshot } from "./snapshot";

export const ErrorKind = z.enum(["Offline", "Unauthorized", "VendorChanged", "Rejected", "Failed"]);
export type ErrorKind = z.infer<typeof ErrorKind>;

export const BridgeError = z.object({ kind: ErrorKind, message: z.string() });
export type BridgeError = z.infer<typeof BridgeError>;

export const Actions = {
  ...coreActions,
  ...tasksActions,
  ...coursePageActions,
  ...filesActions,
  ...sixActions,
  ...alertsActions,
  ...updatesActions,
  ...scheduleActions,
} as const satisfies Record<string, { input: z.ZodType; output: z.ZodType }>;
export type ActionName = keyof typeof Actions;
export type ActionInput<N extends ActionName> = z.input<(typeof Actions)[N]["input"]>;
export type ActionOutput<N extends ActionName> = z.infer<(typeof Actions)[N]["output"]>;

export const Event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dataset"), dataset: DatasetPayload }),
  z.object({ type: z.literal("dataset.removed"), name: z.string() }),
  z.object({ type: z.literal("status"), status: SourceStatus }),
  z.object({ type: z.literal("settings"), settings: Settings }),
  /** A menu item or global shortcut the window should act on. */
  z.object({ type: z.literal("command"), command: z.enum(["settings", "refresh", "search"]) }),
  /** Open a screen: the Student clicked an OS notification. */
  z.object({ type: z.literal("navigate"), route: Route }),
]);
export type Event = z.infer<typeof Event>;

/** What crosses the IPC boundary for an action: a result or a typed error, never a thrown Error. */
export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: BridgeError };
