// Main's end of the bridge. A request is answered only when it comes from the
// app's own page in the main window, names a known action, and carries input
// that matches the contract. Errors cross as typed values, never as thrown
// Errors with stack traces.
import { type BrowserWindow, ipcMain } from "electron";
import type { z } from "zod";
import { CHANNEL_INVOKE } from "../core/channels";
import { type ActionName, type ActionOutput, type ActionResult, Actions, type ErrorKind } from "../core/contract";
import { isEngineError } from "../engine/errors";

export type Handlers = { [N in ActionName]: (input: z.infer<(typeof Actions)[N]["input"]>) => Promise<ActionOutput<N>> };

const failure = (kind: ErrorKind, message: string): ActionResult<never> => ({ ok: false, error: { kind, message } });

export function registerBridge(options: { window: () => BrowserWindow | null; isAppUrl: (url: string) => boolean; handlers: Handlers }): void {
  ipcMain.handle(CHANNEL_INVOKE, async (event, name: unknown, input: unknown): Promise<ActionResult<unknown>> => {
    const window = options.window();
    const frame = event.senderFrame;
    if (!window || event.sender !== window.webContents || !frame || frame.parent || !options.isAppUrl(frame.url)) {
      return failure("Rejected", "Only the app's own page may ask the engine");
    }
    if (typeof name !== "string" || !Object.hasOwn(Actions, name)) return failure("Rejected", "Unknown action");
    const action = name as ActionName;
    const parsed = Actions[action].input.safeParse(input ?? {});
    if (!parsed.success) return failure("Rejected", `Bad input for ${action}`);
    try {
      const handler = options.handlers[action] as (input: unknown) => Promise<unknown>;
      return { ok: true, value: await handler(parsed.data) };
    } catch (error) {
      if (isEngineError(error)) return failure(error.kind, error.message);
      console.error(`[bridge] ${action} failed:`, error);
      return failure("Failed", "Something went wrong in the app");
    }
  });
}
