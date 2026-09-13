import { describe, expect, it, vi } from "vitest";
import type { FeedSnapshot } from "../shared/feeds";
import type { InAppNotification } from "../shared/notifications";
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
  getFeed(feed: "todo" | "courses" | "exams" | "agenda" | "presences"): Promise<FeedSnapshot | null>;
  onFeedUpdated(callback: (snapshot: FeedSnapshot) => void): () => void;
  getNotifications(): Promise<InAppNotification[]>;
  markNotificationsRead(ids: string[]): Promise<InAppNotification[]>;
  markAllNotificationsRead(): Promise<InAppNotification[]>;
  onNotificationsUpdated(callback: (entries: InAppNotification[]) => void): () => void;
  onNotificationClicked(
    callback: (payload: { taskIds: string[]; presenceIds?: string[] }) => void,
  ): () => void;
  saveDraft(input: { taskId: string; answer: string; answerId?: string | null }): Promise<{
    ok: boolean;
    status: number;
    created: boolean;
    answerId: string | null;
  }>;
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

  it("reads a cached course collection with its captured JSON-API shape", async () => {
    const snapshot: FeedSnapshot = {
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

  it("reads a cached agenda through main's cache IPC channel", async () => {
    const snapshot: FeedSnapshot = {
      feed: "agenda",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [
        {
          type: "vicon",
          course_name: "Final Project Proposal",
          name: "Week 05 — Online guidance",
          start_at: "2026-09-16T07:00:00.000Z",
          end_at: "2026-09-16T09:00:00.000Z",
        },
      ],
    };
    electronMocks.invoke.mockClear();
    electronMocks.invoke.mockResolvedValueOnce(snapshot);

    await expect(bridge.getFeed("agenda")).resolves.toEqual(snapshot);
    expect(electronMocks.invoke).toHaveBeenCalledWith("sync:get-feed", "agenda");
  });

  it("reads cached presence records through main's cache IPC channel", async () => {
    const snapshot: FeedSnapshot = {
      feed: "presences",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [
        {
          course_id: 401,
          course_code: "II4091",
          courses_name: "Final Project Proposal",
          class_id: 88,
          class_name: "II4091-01",
          semester: 1,
          year: "2026-1",
          presences: [
            { id: 7001, name: "Week 01 — Opening", date: "2026-08-19T07:00:00.000Z", status: "Hadir" },
          ],
        },
      ],
    };
    electronMocks.invoke.mockClear();
    electronMocks.invoke.mockResolvedValueOnce(snapshot);

    await expect(bridge.getFeed("presences")).resolves.toEqual(snapshot);
    expect(electronMocks.invoke).toHaveBeenCalledWith("sync:get-feed", "presences");
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

describe("preload notification bridge", () => {
  it("reads the fallback feed through main's notification IPC channel", async () => {
    const entries: InAppNotification[] = [
      {
        id: "entry-1",
        title: "New task",
        body: "Answer Tugas 01 — II4091",
        taskIds: ["113986"],
        createdAt: "2026-09-13T12:00:00.000Z",
        read: false,
      },
    ];
    electronMocks.invoke.mockResolvedValueOnce(entries);

    await expect(bridge.getNotifications()).resolves.toEqual(entries);
    expect(electronMocks.invoke).toHaveBeenCalledWith("notifications:get");
  });

  it("forwards fallback updates and OS clicks, removing listeners on unsubscribe", () => {
    const updated = vi.fn();
    const unsubscribeUpdated = bridge.onNotificationsUpdated(updated);
    const updatedListener = electronMocks.on.mock.calls.at(-1)?.[1] as (
      event: unknown,
      entries: InAppNotification[],
    ) => void;
    updatedListener({}, []);
    unsubscribeUpdated();

    expect(updated).toHaveBeenCalledWith([]);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      "notifications:updated",
      updatedListener,
    );

    const clicked = vi.fn();
    const unsubscribeClicked = bridge.onNotificationClicked(clicked);
    const clickedListener = electronMocks.on.mock.calls.at(-1)?.[1] as (
      event: unknown,
      payload: { taskIds: string[]; presenceIds?: string[] },
    ) => void;
    clickedListener({}, { taskIds: ["113986"] });
    unsubscribeClicked();

    expect(clicked).toHaveBeenCalledWith({ taskIds: ["113986"] });
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      "notifications:clicked",
      clickedListener,
    );
  });
});

describe("preload draft-save bridge", () => {
  it("sends the editor text through main's tasks IPC channel", async () => {
    const result = { ok: true, status: 201, created: true, answerId: "2644208" };
    electronMocks.invoke.mockClear();
    electronMocks.invoke.mockResolvedValueOnce(result);

    await expect(
      bridge.saveDraft({ taskId: "113986", answer: "<p>draft</p>", answerId: null }),
    ).resolves.toEqual(result);
    expect(electronMocks.invoke).toHaveBeenCalledWith("tasks:save-draft", {
      taskId: "113986",
      answer: "<p>draft</p>",
      answerId: null,
    });
  });
});
