import { expect, it } from "@effect/vitest";
import { createApplicationRuntime } from "../effect/runtime";
import type { IpcHandlerService, IpcMainService } from "../platform/services";
import type { ShellSettings } from "../../shared/shell";
import { registerApplicationIpc } from "./application";

it("keeps shell settings behavior behind validated IPC operations", async () => {
  const handlers = new Map<string, IpcHandlerService>();
  const ipcMain: IpcMainService = {
    handle: (channel, handler) => handlers.set(channel, handler),
    removeHandler: (channel) => handlers.delete(channel),
  };
  const runtime = createApplicationRuntime();
  let settings: ShellSettings = { hiddenViews: [], quitOnClose: false };
  const adapter = registerApplicationIpc({
    ipcMain,
    runtime,
    showTestNotification: () => undefined,
    getAppInfo: () => ({
      version: "test",
      platform: "linux",
      trayActive: true,
      notificationsSupported: false,
    }),
    auth: { status: () => "signed-out", startLogin: () => undefined },
    sync: { read: () => null },
    downloadMaterial: async () => ({ ok: false, error: "Download failed" }),
    shell: {
      getSettings: () => settings,
      setViewHidden: (view, hidden) => {
        if (view === "todo") settings = { ...settings, hiddenViews: hidden ? ["todo"] : [] };
        return settings;
      },
      setQuitOnClose: (quitOnClose) => {
        settings = { ...settings, quitOnClose };
        return settings;
      },
    },
    notifications: { get: () => [], markRead: () => [], markAllRead: () => [] },
    tasks: {
      saveDraft: async () => ({ ok: true, status: 201, created: true, answerId: "1" }),
      submit: async () => ({ ok: true, status: 200 }),
    },
  });

  const event = { sender: "renderer" };
  await expect(handlers.get("shell:get-settings")!(event)).resolves.toEqual(settings);
  await expect(handlers.get("shell:set-view-hidden")!(event, "todo", true)).resolves.toEqual({
    hiddenViews: ["todo"],
    quitOnClose: false,
  });
  await expect(handlers.get("shell:set-view-hidden")!(event, "home", true)).resolves.toEqual({
    hiddenViews: ["todo"],
    quitOnClose: false,
  });
  await expect(handlers.get("shell:set-quit-on-close")!(event, true)).resolves.toEqual({
    hiddenViews: ["todo"],
    quitOnClose: true,
  });

  adapter.unregister();
  await runtime.shutdown();
});
