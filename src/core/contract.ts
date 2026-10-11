// The bridge between the screens and the engine: one typed list of actions
// (renderer → main, request/response) and events (main → renderer). Both
// sides check every message against these schemas.
import { z } from "zod";
import { Lang, Settings, SourceId, SourceStatus, Theme } from "./models";

export const ErrorKind = z.enum(["Offline", "Unauthorized", "VendorChanged", "Rejected", "Failed"]);
export type ErrorKind = z.infer<typeof ErrorKind>;

export const BridgeError = z.object({ kind: ErrorKind, message: z.string() });
export type BridgeError = z.infer<typeof BridgeError>;

const DatasetPayload = z.object({ name: z.string(), value: z.unknown(), fetchedAt: z.number(), hash: z.string() });
export type DatasetPayload = z.infer<typeof DatasetPayload>;

export const Snapshot = z.object({
  version: z.string(),
  datasets: z.array(DatasetPayload),
  statuses: z.array(SourceStatus),
  settings: Settings,
});
export type Snapshot = z.infer<typeof Snapshot>;

/** What the window gets at start: the engine's snapshot plus facts about this computer. */
export const AppSnapshot = Snapshot.extend({
  platform: z.enum(["darwin", "win32", "linux"]),
  /** "memory" when the OS offers no secure storage: sessions last until the app quits. */
  vault: z.enum(["encrypted", "memory"]),
});
export type AppSnapshot = z.infer<typeof AppSnapshot>;

export const Actions = {
  /** Everything saved, for the first render. Never waits on the network. */
  "app.snapshot": { input: z.object({}), output: AppSnapshot },
  /** The first render is on screen: show the window. */
  "app.ready": { input: z.object({}), output: z.object({}) },
  "auth.signIn": { input: z.object({ source: SourceId }), output: z.object({ signedIn: z.boolean() }) },
  /** Without a source: sign out of everything and remove every trace. */
  "auth.signOut": { input: z.object({ source: SourceId.optional() }), output: z.object({}) },
  "sync.refresh": { input: z.object({ source: SourceId.optional() }), output: z.object({}) },
  "settings.update": { input: z.object({ theme: Theme.optional(), lang: Lang.optional() }), output: Settings },
  /** Opens an official page (EduNex, SIX, ITB) in the system browser. Other hosts are refused. */
  "shell.openExternal": { input: z.object({ url: z.string().url() }), output: z.object({}) },
} as const;
export type ActionName = keyof typeof Actions;
export type ActionInput<N extends ActionName> = z.input<(typeof Actions)[N]["input"]>;
export type ActionOutput<N extends ActionName> = z.infer<(typeof Actions)[N]["output"]>;

export const Event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dataset"), dataset: DatasetPayload }),
  z.object({ type: z.literal("dataset.removed"), name: z.string() }),
  z.object({ type: z.literal("status"), status: SourceStatus }),
  z.object({ type: z.literal("settings"), settings: Settings }),
  /** A menu item or global shortcut the window should act on. */
  z.object({ type: z.literal("command"), command: z.enum(["settings", "refresh"]) }),
]);
export type Event = z.infer<typeof Event>;

/** What crosses the IPC boundary for an action: a result or a typed error, never a thrown Error. */
export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: BridgeError };

/** Hosts the app may open in the browser. */
export const OFFICIAL_HOSTS = [/(^|\.)itb\.ac\.id$/, /^api-edunex\.cognisia\.id$/, /^teams\.microsoft\.com$/, /(^|\.)zoom\.us$/, /^meet\.google\.com$/];
