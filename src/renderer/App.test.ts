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
      getShellSettings: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setViewHidden: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setQuitOnClose: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      onShellSettings: vi.fn(() => () => undefined),
      getNotifications: vi.fn(async () => []),
      markNotificationsRead: vi.fn(async () => []),
      markAllNotificationsRead: vi.fn(async () => []),
      onNotificationsUpdated: vi.fn(() => () => undefined),
      onNotificationClicked: vi.fn(() => () => undefined),
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

  it("opens the task destination when an OS notification is clicked", async () => {
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
        exams: [],
        questions: [],
        modules: [],
      },
    };
    const getFeed = vi.fn(async () => todoSnapshot);
    let clickedCallback: ((payload: { taskIds: string[] }) => void) | null = null;

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
      getShellSettings: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setViewHidden: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setQuitOnClose: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      onShellSettings: vi.fn(() => () => undefined),
      getNotifications: vi.fn(async () => []),
      markNotificationsRead: vi.fn(async () => []),
      markAllNotificationsRead: vi.fn(async () => []),
      onNotificationsUpdated: vi.fn(() => () => undefined),
      onNotificationClicked: vi.fn((callback) => {
        clickedCallback = callback;
        return () => undefined;
      }),
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

    expect(clickedCallback).not.toBeNull();

    await act(async () => {
      clickedCallback!({ taskIds: ["113986"] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[aria-labelledby="task-page-title"]')).not.toBeNull();
    expect(container.textContent).toContain("Answer Tugas 01");
  });

  it("renders the active My Courses payload through mock preload IPC", async () => {
    const coursesSnapshot: FeedSnapshot = {
      feed: "courses",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [
        {
          type: "courses",
          id: "27011",
          attributes: {
            code: "ED0001",
            name: "Panduan Edunex bagi Dosen",
            period_year: "2020",
            period_type: "2",
            is_active: 1,
            is_enrolled: false,
          },
        },
        {
          type: "courses",
          id: "60250",
          attributes: {
            code: "IF2040",
            name: "Database Modeling",
            period_year: "2024",
            period_type: "1",
            is_active: 0,
            is_enrolled: true,
          },
        },
        {
          type: "courses",
          id: "401",
          attributes: {
            code: "ME4066",
            name: "Climate Change",
            class_name: "ME4066-03",
            period_id: 118,
            period_year: "2026",
            period_type: "1",
            is_active: 1,
            is_enrolled: true,
            total_modules: 16,
            credit: "3",
            lecturer: "Dr. Joko Wiratmo, M.P.",
            faculty: { code: "FITB", name: "FITB" },
            thumbnail: "https://cdn-edunex.itb.ac.id/401/thumbnail.png",
          },
        },
        {
          type: "courses",
          id: "402",
          attributes: {
            code: "DK4073",
            name: "Marketing Communication",
            class_name: "DK4073-01",
            period_id: 118,
            period_year: "2026",
            period_type: "1",
            is_active: 1,
            is_enrolled: true,
            total_modules: 0,
            credit: "3",
            faculty: { code: "FSRD", name: "FSRD" },
          },
        },
        {
          type: "courses",
          id: "403",
          attributes: {
            code: "PL3002",
            name: "Economics and Innovation in Planning",
            class_name: "PL3002-01",
            period_id: 118,
            period_year: "2026",
            period_type: "1",
            is_active: 1,
            is_enrolled: true,
            total_modules: 3,
            credit: "2",
            faculty: { code: "SAPPK", name: "SAPPK" },
          },
        },
        {
          type: "courses",
          id: "404",
          attributes: {
            code: "PL3032",
            name: "Infrastructure and Transportation Planning",
            class_name: "PL3032-01",
            period_id: 118,
            period_year: "2026",
            period_type: "1",
            is_active: 1,
            is_enrolled: true,
            total_modules: 16,
            credit: "2",
            faculty: { code: "SAPPK", name: "SAPPK" },
          },
        },
        {
          type: "courses",
          id: "405",
          attributes: {
            code: "II4091",
            name: "Final Project Proposal",
            class_name: "II4091-01",
            period_id: 118,
            period_year: "2026",
            period_type: "1",
            is_active: 1,
            is_enrolled: true,
            total_modules: 16,
            credit: "3",
            faculty: { code: "STEI", name: "STEI" },
          },
        },
      ],
    };
    const emptyTodoSnapshot: FeedSnapshot = {
      feed: "todo",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: { tasks: [], exams: [], questions: [], modules: [] },
    };
    const getFeed = vi.fn(async (feed: FeedKey) =>
      feed === "courses" ? coursesSnapshot : emptyTodoSnapshot,
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
      getShellSettings: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setViewHidden: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setQuitOnClose: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      onShellSettings: vi.fn(() => () => undefined),
      getNotifications: vi.fn(async () => []),
      markNotificationsRead: vi.fn(async () => []),
      markAllNotificationsRead: vi.fn(async () => []),
      onNotificationsUpdated: vi.fn(() => () => undefined),
      onNotificationClicked: vi.fn(() => () => undefined),
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

    expect(getFeed).toHaveBeenCalledWith("courses");
    expect(container.textContent).toContain("ME4066");
    expect(container.textContent).toContain("DK4073");
    expect(container.textContent).toContain("PL3002");
    expect(container.textContent).toContain("PL3032");
    expect(container.textContent).toContain("II4091");
    expect(container.textContent).toContain("2026-1");
    expect(container.textContent).toContain("16 modules");
    expect(container.textContent).toContain("FITB");
    expect(container.querySelector('img[src="https://cdn-edunex.itb.ac.id/401/thumbnail.png"]')).not.toBeNull();
    expect(container.textContent).not.toContain("ED0001");
    expect(container.textContent).not.toContain("IF2040");

    const courseButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open ME4066 — Climate Change"]',
    );
    expect(courseButton).not.toBeNull();
    await act(async () => {
      courseButton!.click();
    });

    expect(
      container.querySelector(
        'section[aria-label="Climate Change course hub"] img[src="https://cdn-edunex.itb.ac.id/401/thumbnail.png"]',
      ),
    ).not.toBeNull();
  });

  it("changes the course and To Do scope when the Period tab changes", async () => {
    const coursesSnapshot: FeedSnapshot = {
      feed: "courses",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [
        {
          type: "courses",
          id: "401",
          attributes: {
            code: "ME4066",
            name: "Current Period Course",
            year: "2026-1",
            is_current: true,
            is_active: 1,
            is_enrolled: true,
          },
        },
        {
          type: "courses",
          id: "402",
          attributes: {
            code: "IF2040",
            name: "Available Older Course",
            year: "2024-1",
            is_active: 1,
            is_enrolled: true,
          },
        },
      ],
    };
    const todoSnapshot: FeedSnapshot = {
      feed: "todo",
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: {
        tasks: [
          { code: "ME4066", name: "Current task", id: 1 },
          { code: "IF2040", name: "Older task", id: 2 },
        ],
        exams: [],
        questions: [],
        modules: [],
      },
    };
    const getFeed = vi.fn(async (feed: FeedKey) =>
      feed === "courses" ? coursesSnapshot : todoSnapshot,
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
      getShellSettings: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setViewHidden: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      setQuitOnClose: vi.fn(async () => ({ hiddenViews: [], quitOnClose: false })),
      onShellSettings: vi.fn(() => () => undefined),
      getNotifications: vi.fn(async () => []),
      markNotificationsRead: vi.fn(async () => []),
      markAllNotificationsRead: vi.fn(async () => []),
      onNotificationsUpdated: vi.fn(() => () => undefined),
      onNotificationClicked: vi.fn(() => () => undefined),
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

    const tabs = [...container.querySelectorAll<HTMLButtonElement>('button[role="tab"]')];
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Current Period Course");
    expect(container.textContent).toContain("Current task");
    expect(container.textContent).not.toContain("Older task");

    await act(async () => {
      tabs[1].click();
    });

    expect(container.textContent).toContain("Available Older Course");
    expect(container.textContent).toContain("Older task");
    expect(container.textContent).not.toContain("Current task");
  });
});
