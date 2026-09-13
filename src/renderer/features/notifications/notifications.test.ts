import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { InAppNotification } from "@shared/notifications";
import { NotificationCenter } from "./notification-center";
import { readNotifications } from "./use-notifications";

function entry(overrides: Partial<InAppNotification> = {}): InAppNotification {
  return {
    id: "entry-1",
    title: "New task",
    body: "Answer Tugas 01 — II4091",
    taskIds: ["113986"],
    createdAt: "2026-09-13T12:00:00.000Z",
    read: false,
    ...overrides,
  };
}

describe("notification center fallback feed", () => {
  it("reads the persisted feed through the preload seam", async () => {
    const entries = [entry()];
    const bridge = {
      getNotifications: vi.fn(async () => entries),
      markNotificationsRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    };

    await expect(readNotifications(bridge)).resolves.toEqual(entries);
    expect(bridge.getNotifications).toHaveBeenCalledTimes(1);
  });

  it("renders single and digest entries with navigation labels", () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationCenter, {
        entries: [
          entry({ id: "entry-1" }),
          entry({
            id: "entry-2",
            title: "3 new tasks",
            body: "Task 2; Task 3; Task 4 — see To Do",
            taskIds: ["2", "3", "4"],
          }),
        ],
        loading: false,
        onOpenTask: vi.fn(),
        onOpenTodo: vi.fn(),
        onOpenAgenda: vi.fn(),
        onMarkAllRead: vi.fn(),
      }),
    );

    expect(markup).toContain("Notification Center");
    expect(markup).toContain('aria-label="Open task Answer Tugas 01 — II4091"');
    expect(markup).toContain('aria-label="Open To Do for 3 new tasks"');
    expect(markup).toContain("3 tasks");
  });

  it("renders Presence-open entries with a Presence chip landing on the agenda", () => {
    const onOpenAgenda = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(NotificationCenter, {
        entries: [
          entry({
            id: "entry-p1",
            title: "Presence open",
            body: "Week 05 — Online guidance — II4091 is open for attendance",
            taskIds: [],
            presenceIds: ["501"],
            kind: "presence",
          }),
        ],
        loading: false,
        onOpenTask: vi.fn(),
        onOpenTodo: vi.fn(),
        onOpenAgenda,
        onMarkAllRead: vi.fn(),
      }),
    );

    expect(markup).toContain("Presence");
    expect(markup).toContain("Open agenda for");
    expect(onOpenAgenda).not.toHaveBeenCalled();
  });

  it("shows the empty fallback copy when nothing has arrived", () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationCenter, {
        entries: [],
        loading: false,
        onOpenTask: vi.fn(),
        onOpenTodo: vi.fn(),
        onOpenAgenda: vi.fn(),
        onMarkAllRead: vi.fn(),
      }),
    );

    expect(markup).toContain("No notifications yet");
  });
});
