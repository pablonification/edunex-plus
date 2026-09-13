/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedKey, FeedSnapshot } from "@shared/feeds";
import { App } from "./App";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("To Do app flow", () => {
  it("reads the /todo snapshot over mock IPC and opens the selected Task shell", async () => {
    const todoSnapshot: FeedSnapshot = {
      feed: "todo",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: {
        tasks: [
          {
            type: "task",
            code: "II4091",
            course: "Final Project Proposal",
            name: "Answer Tugas 01",
            time: "2026-09-14T23:59:00.000Z",
            id: 113986,
          },
        ],
        exams: [
          {
            type: "exam",
            code: "ME4066",
            course: "Climate Change",
            name: "Quiz 01",
            time: "2026-09-10T02:00:00.000Z",
            id: 9001,
          },
        ],
        questions: [],
        modules: [],
      },
    };
    const coursesSnapshot: FeedSnapshot = {
      feed: "courses",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [],
    };
    const getFeed = vi.fn(async (feed: FeedKey) =>
      feed === "todo" ? todoSnapshot : coursesSnapshot,
    );

    window.edunex = {
      version: "0.0.1",
      platform: "linux",
      fireTestNotification: vi.fn(async () => undefined),
      getAppInfo: vi.fn(async () => ({
        version: "0.0.1",
        platform: "linux",
        trayActive: true,
        notificationsSupported: true,
      })),
      onNavigate: vi.fn(() => () => undefined),
      onFullscreenChange: vi.fn(() => () => undefined),
      getAuthState: vi.fn(async () => "signed-in" as const),
      startLogin: vi.fn(async () => undefined),
      onAuthState: vi.fn(() => () => undefined),
      getFeed,
      onFeedUpdated: vi.fn(() => () => undefined),
    };

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };

    await act(async () => {
      root.render(createElement(App));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const taskButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open task Answer Tugas 01"]',
    );
    expect(taskButton).not.toBeNull();
    expect(getFeed).toHaveBeenCalledWith("todo");
    expect(container.textContent).toContain("Exams");
    expect(container.textContent).toContain("Quiz 01");
    expect(
      [...container.querySelectorAll("time")].map((time) => time.getAttribute("datetime")),
    ).toEqual(expect.arrayContaining([
      "2026-09-14T23:59:00.000Z",
      "2026-09-10T02:00:00.000Z",
    ]));

    await act(async () => {
      taskButton!.click();
    });

    expect(container.querySelector('[aria-labelledby="task-page-title"]')).not.toBeNull();
    expect(container.textContent).toContain("Submission details will appear here in #25.");
  });
});
