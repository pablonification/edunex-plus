import { describe, expect, it, vi } from "vitest";
import type { FeedSnapshot } from "../shared/feeds";

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
  getFeed(feed: "todo" | "courses" | "agenda"): Promise<FeedSnapshot | null>;
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
});
