import { describe, expect, it, vi } from "vitest";
import type { FeedSnapshot } from "../shared/feeds";
import type { ShellSettings } from "../shared/shell";

const electronMocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: electronMocks.exposeInMainWorld },
  ipcRenderer: {
    invoke: electronMocks.invoke,
    on: electronMocks.on,
    removeListener: electronMocks.removeListener,
  },
}));

import "./preload";

const bridge = electronMocks.exposeInMainWorld.mock.calls[0][1] as {
  getFeed(feed: "todo" | "courses" | "exams"): Promise<FeedSnapshot | null>;
  onFeedUpdated(callback: (snapshot: FeedSnapshot) => void): () => void;
};

describe("preload feed bridge", () => {
  it("reads a feed through main's cache IPC channel", async () => {
    const snapshot: FeedSnapshot = {
      feed: "todo",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: { tasks: [], exams: [], questions: [], modules: [] },
    };
    electronMocks.invoke.mockResolvedValueOnce(snapshot);

    await expect(bridge.getFeed("todo")).resolves.toEqual(snapshot);
    expect(electronMocks.invoke).toHaveBeenCalledWith("sync:get-feed", "todo");
  });

  it("forwards cache updates and removes the listener on unsubscribe", () => {
    const callback = vi.fn();
    const unsubscribe = bridge.onFeedUpdated(callback);
    const listener = electronMocks.on.mock.calls.at(-1)?.[1] as (
      event: unknown,
      snapshot: FeedSnapshot,
    ) => void;
    const snapshot: FeedSnapshot = {
      feed: "courses",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [],
    };

    listener({}, snapshot);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(snapshot);
    expect(electronMocks.removeListener).toHaveBeenCalledWith("sync:feed-updated", listener);
  });

  it("reads a cached course collection with its captured JSON-API shape", async () => {    const snapshot: FeedSnapshot = {
      feed: "courses",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: {
        meta: { page: { limit: 9, offset: 0 } },
        data: [
          {
            type: "course",
            id: "401",
            attributes: {
              code: "II4091",
              name: "Final Project Proposal",
              class_name: "II4091-01",
              semester: 1,
              year: "2026-1",
              modules: 16,
            },
          },
        ],
      },
    };
    electronMocks.invoke.mockClear();
    electronMocks.invoke.mockResolvedValueOnce(snapshot);

    await expect(bridge.getFeed("courses")).resolves.toEqual(snapshot);
    expect(electronMocks.invoke).toHaveBeenCalledWith("sync:get-feed", "courses");
  });

  it("reads a cached exams feed through the same cache IPC channel", async () => {
    const snapshot: FeedSnapshot = {
      feed: "exams",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [
        {
          type: "exam",
          code: "II4091",
          course: "Final Project Proposal",
          name: "UTS — Final Project Proposal",
          time: "2026-10-13T02:00:00.000Z",
          id: 7001,
        },
      ],
    };
    electronMocks.invoke.mockClear();
    electronMocks.invoke.mockResolvedValueOnce(snapshot);

    await expect(bridge.getFeed("exams")).resolves.toEqual(snapshot);
    expect(electronMocks.invoke).toHaveBeenCalledWith("sync:get-feed", "exams");
  });
});

describe("preload shell-settings bridge", () => {
  const shellBridge = electronMocks.exposeInMainWorld.mock.calls[0][1] as {
    getShellSettings(): Promise<ShellSettings>;
    setViewHidden(view: string, hidden: boolean): Promise<ShellSettings>;
    setQuitOnClose(quitOnClose: boolean): Promise<ShellSettings>;
    onShellSettings(callback: (settings: ShellSettings) => void): () => void;
  };

  it("reads settings and writes hide/quit changes through main's IPC channels", async () => {
    const stored: ShellSettings = { hiddenViews: [], quitOnClose: false };
    electronMocks.invoke.mockClear();
    electronMocks.invoke.mockResolvedValueOnce(stored);
    await expect(shellBridge.getShellSettings()).resolves.toEqual(stored);
    expect(electronMocks.invoke).toHaveBeenCalledWith("shell:get-settings");

    const updated: ShellSettings = { hiddenViews: ["exams"], quitOnClose: true };
    electronMocks.invoke.mockResolvedValueOnce(updated);
    await expect(shellBridge.setViewHidden("exams", true)).resolves.toEqual(updated);
    expect(electronMocks.invoke).toHaveBeenCalledWith("shell:set-view-hidden", "exams", true);

    electronMocks.invoke.mockResolvedValueOnce(updated);
    await expect(shellBridge.setQuitOnClose(true)).resolves.toEqual(updated);
    expect(electronMocks.invoke).toHaveBeenCalledWith("shell:set-quit-on-close", true);
  });

  it("forwards settings pushes and removes the listener on unsubscribe", () => {
    const callback = vi.fn();
    const unsubscribe = shellBridge.onShellSettings(callback);
    const listener = electronMocks.on.mock.calls.at(-1)?.[1] as (
      event: unknown,
      settings: ShellSettings,
    ) => void;
    const next: ShellSettings = { hiddenViews: ["todo"], quitOnClose: false };

    listener({}, next);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(next);
    expect(electronMocks.removeListener).toHaveBeenCalledWith("shell:settings-updated", listener);
  });
});
