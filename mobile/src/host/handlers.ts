// The phone's end of the bridge: the desktop's actions (src/core/contract.ts), answered in the
// app's own JS thread instead of Electron's main process. Each mirrors its desktop handler
// (src/desktop/handlers); what only a window can do (a sign-in page, SIX's timetable) is handed
// to the screens through `ui`. An action the phone has no answer for is refused, never faked.
import { Linking, Platform } from "react-native";
import type { z } from "zod";
import { type ActionName, type ActionOutput, type ActionResult, Actions, type ErrorKind } from "../../../src/core/contract";
import { isOfficialUrl, isWebLink } from "../../../src/core/links";
import type { AppLog } from "../../../src/engine/app-log";
import { errorLine } from "../../../src/engine/app-log";
import type { Engine } from "../../../src/engine/engine";
import { EngineError, isEngineError } from "../../../src/engine/errors";

export type Handlers = { [N in ActionName]: (input: z.infer<(typeof Actions)[N]["input"]>) => Promise<ActionOutput<N>> };

/** What only the screens can do: show a page the Student acts on. */
export interface HostUi {
  /** ITB's sign-in page for one system; resolves with whether the Student got signed in. */
  signIn(source: "edunex" | "six"): Promise<boolean>;
  /** SIX's timetable with this class's popup, signed in, for "Tandai Hadir". */
  openCheckIn(meetingId: string): Promise<void>;
}

export interface HandlerContext {
  engine: Engine;
  ui: HostUi;
  log: AppLog;
  /** The screens drew their first frame: the splash can go and syncing starts. */
  ready(): void;
  /** Everything this app kept, gone (signing out of everything). */
  forgetEverything(): Promise<void>;
  /** The phone shows notifications at all (permission given). */
  notificationsAllowed(): Promise<boolean>;
  showTestNotification(): Promise<boolean>;
  demo: boolean;
}

/** Opens a page in the phone's browser. The demo opens nothing, like the desktop's. */
async function openInBrowser(context: HandlerContext, url: string): Promise<void> {
  if (context.demo) return;
  await Linking.openURL(url);
}

export function phoneHandlers(context: HandlerContext): Partial<Handlers> {
  const { engine } = context;
  return {
    "app.snapshot": async () => ({
      ...engine.snapshot(),
      // Android is a Linux: the phone draws no desktop chrome from it.
      platform: "linux",
      vault: "encrypted",
      update: { blocked: "notPackaged", step: "idle", version: null, progress: null, problem: null },
    }),
    "app.ready": async () => {
      context.ready();
      return {};
    },
    "sync.refresh": async ({ source }) => {
      await engine.refresh(source);
      return {};
    },
    "settings.update": (patch) => engine.updateSettings(patch),
    "shell.openExternal": async ({ url }) => {
      if (!isOfficialUrl(url)) throw new EngineError("Rejected", "Only official pages open from the app");
      await openInBrowser(context, url);
      return {};
    },
    "shell.openLink": async ({ url }) => {
      if (!isWebLink(url)) throw new EngineError("Rejected", "Only web pages open from a lecturer's link");
      await openInBrowser(context, url);
      return {};
    },
    "local.set": async ({ name, value }) => {
      await engine.setLocal(name, value);
      return {};
    },
    "auth.signIn": async ({ source }) => {
      if (source === "edunex" || source === "six") return { signedIn: await context.ui.signIn(source) };
      throw new EngineError("Rejected", `${source} has no sign-in`);
    },
    "auth.signOut": async ({ source }) => {
      await engine.signOut(source);
      if (!source) await context.forgetEverything();
      return {};
    },
    "auth.signInDone": async () => ({}),
    "six.openCheckIn": async ({ meetingId }) => {
      await context.ui.openCheckIn(meetingId);
      return {};
    },
    "alerts.markRead": async () => {
      await engine.markAlertsRead();
      return {};
    },
    "alerts.test": async () => ({ shown: await context.showTestNotification() }),
    "app.checkUpdate": async () => ({ found: await engine.checkForUpdates() }),
  };
}

const failure = (kind: ErrorKind, message: string): ActionResult<never> => ({ ok: false, error: { kind, message } });

/** Answers one action like the desktop's registerBridge (src/desktop/ipc.ts): input checked, errors as typed values. */
export async function answer(handlers: Partial<Handlers>, log: AppLog, name: unknown, input: unknown): Promise<ActionResult<unknown>> {
  if (typeof name !== "string" || !Object.hasOwn(Actions, name)) return failure("Rejected", "Unknown action");
  const action = name as ActionName;
  const handler = handlers[action] as ((input: unknown) => Promise<unknown>) | undefined;
  if (!handler) return failure("Rejected", `${action} isn't on the phone`);
  const parsed = Actions[action].input.safeParse(input ?? {});
  if (!parsed.success) return failure("Rejected", `Bad input for ${action}`);
  try {
    return { ok: true, value: await handler(parsed.data) };
  } catch (error) {
    if (isEngineError(error)) return failure(error.kind, error.message);
    console.error(`[bridge] ${action} failed:`, error);
    log.for("app")("error", `${action} failed on ${Platform.OS}: ${errorLine(error)}`);
    return failure("Failed", "Something went wrong in the app");
  }
}
