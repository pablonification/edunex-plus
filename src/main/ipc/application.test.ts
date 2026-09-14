import { Effect } from "effect";
import { expect, it } from "@effect/vitest";
import { vi } from "vitest";
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
    auth: {
      status: () => Effect.succeed(null),
      startLogin: () => Effect.succeed(undefined),
      signOut: () => Effect.succeed(undefined),
      accountId: () => Effect.succeed(null),
    },
    sync: { read: () => Effect.succeed(null) },
    materialDownloadService: { download: () => Effect.succeed({ ok: false, error: "Download failed" }) },
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
    notifications: {
      service: {
        list: () => Effect.succeed([]),
        markRead: () => Effect.succeed([]),
        markAllRead: () => Effect.succeed([]),
      },
    },
    taskAnswerService: {
      saveDraft: () => Effect.succeed({ ok: true, status: 201, created: true, answerId: "1" }),
      submit: () => Effect.succeed({ ok: true, status: 200 }),
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
  await expect(handlers.get("tasks:save-draft")!(event, { taskId: 42, answer: "draft" })).resolves.toEqual({
    ok: false,
    status: 400,
    created: false,
    answerId: null,
  });
  await expect(handlers.get("tasks:submit")!(event, { answerId: 42 })).resolves.toEqual({
    ok: false,
    status: 400,
  });

  adapter.unregister();
  await runtime.shutdown();
});

it("runs the managed task/material services only after IPC input validation", async () => {
  const handlers = new Map<string, IpcHandlerService>();
  const ipcMain: IpcMainService = {
    handle: (channel, handler) => handlers.set(channel, handler),
    removeHandler: (channel) => handlers.delete(channel),
  };
  const runtime = createApplicationRuntime();
  const materialDownload = vi.fn(() =>
    Effect.succeed({ ok: true as const, filePath: "/tmp/material.pdf" }),
  );
  const saveDraft = vi.fn(() =>
    Effect.succeed({ ok: true, status: 201, created: true, answerId: "1" }),
  );
  const submit = vi.fn(() => Effect.succeed({ ok: true, status: 200 }));
  const adapter = registerApplicationIpc({
    ipcMain,
    runtime,
    showTestNotification: () => undefined,
    getAppInfo: () => ({
      version: "test",
      platform: "linux",
      trayActive: false,
      notificationsSupported: false,
    }),
    auth: {
      status: () => Effect.succeed("signed-in"),
      startLogin: () => Effect.succeed(undefined),
      signOut: () => Effect.succeed(undefined),
      accountId: () => Effect.succeed("190136"),
    },
    materialDownloadService: { download: materialDownload },
    shell: {
      getSettings: () => ({ hiddenViews: [], quitOnClose: false }),
      setViewHidden: () => ({ hiddenViews: [], quitOnClose: false }),
      setQuitOnClose: () => ({ hiddenViews: [], quitOnClose: false }),
    },
    notifications: {
      service: {
        list: () => Effect.succeed([]),
        markRead: () => Effect.succeed([]),
        markAllRead: () => Effect.succeed([]),
      },
    },
    taskAnswerService: { saveDraft, submit },
  });

  const event = { sender: "renderer" };
  await expect(
    handlers.get("materials:download")!(event, {
      fileUrl: "/files/material.pdf",
      fileName: "material.pdf",
    }),
  ).resolves.toEqual({ ok: true, filePath: "/tmp/material.pdf" });
  await expect(
    handlers.get("tasks:save-draft")!(event, { taskId: "113986", answer: "draft" }),
  ).resolves.toEqual({ ok: true, status: 201, created: true, answerId: "1" });
  await expect(handlers.get("tasks:submit")!(event, { answerId: "1" })).resolves.toEqual({
    ok: true,
    status: 200,
  });

  await expect(handlers.get("materials:download")!(event, { fileUrl: 1, fileName: "x" })).resolves.toEqual({
    ok: false,
    error: "This material has no downloadable file.",
  });
  await expect(handlers.get("tasks:save-draft")!(event, { taskId: 1, answer: "draft" })).resolves.toEqual({
    ok: false,
    status: 400,
    created: false,
    answerId: null,
  });
  await expect(handlers.get("tasks:submit")!(event, { answerId: 1 })).resolves.toEqual({
    ok: false,
    status: 400,
  });

  expect(materialDownload).toHaveBeenCalledTimes(1);
  expect(saveDraft).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1);
  adapter.unregister();
  await runtime.shutdown();
});
