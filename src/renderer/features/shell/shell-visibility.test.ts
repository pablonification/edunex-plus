/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedKey, FeedSnapshot } from "@shared/feeds";
import type { ShellSettings } from "@shared/shell";
import { App } from "../../App";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
});

const emptySnapshot = (feed: FeedKey): FeedSnapshot => ({
  feed,
  accountId: "190136",
  fetchedAt: "2026-09-13T12:00:00.000Z",
  data: feed === "todo" ? { tasks: [], exams: [], questions: [], modules: [] } : [],
});

interface ShellBridge {
  settings: ShellSettings;
  pushSettings: (next: ShellSettings) => void;
  getShellSettings: () => Promise<ShellSettings>;
  setViewHidden: (view: string, hidden: boolean) => Promise<ShellSettings>;
  setQuitOnClose: (quitOnClose: boolean) => Promise<ShellSettings>;
}

function installShellBridge(initial: ShellSettings): ShellBridge {
  const bridge: ShellBridge = {
    settings: initial,
    pushSettings: () => undefined,
    getShellSettings: vi.fn(async () => bridge.settings),
    setViewHidden: vi.fn(async (view: string, hidden: boolean) => {
      const next = new Set<string>(bridge.settings.hiddenViews);
      if (hidden) next.add(view);
      else next.delete(view);
      bridge.settings = {
        ...bridge.settings,
        hiddenViews: [...next] as ShellSettings["hiddenViews"],
      };
      return bridge.settings;
    }),
    setQuitOnClose: vi.fn(async (quitOnClose: boolean) => {
      bridge.settings = { ...bridge.settings, quitOnClose };
      return bridge.settings;
    }),
  };
  return bridge;
}

function installEdunex(shell: ShellBridge) {
  const shellListeners = new Set<(settings: ShellSettings) => void>();
  shell.pushSettings = (next: ShellSettings) => {
    shell.settings = next;
    for (const listener of shellListeners) listener(next);
  };
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
    getFeed: vi.fn(async (feed: FeedKey) => emptySnapshot(feed)),
    onFeedUpdated: vi.fn(() => () => undefined),
    getShellSettings: shell.getShellSettings,
    setViewHidden: shell.setViewHidden,
    setQuitOnClose: shell.setQuitOnClose,
    onShellSettings: vi.fn((callback: (settings: ShellSettings) => void) => {
      shellListeners.add(callback);
      return () => {
        shellListeners.delete(callback);
      };
    }),
    getNotifications: vi.fn(async () => []),
    markNotificationsRead: vi.fn(async () => []),
    markAllNotificationsRead: vi.fn(async () => []),
    onNotificationsUpdated: vi.fn(() => () => undefined),
    onNotificationClicked: vi.fn(() => () => undefined),
    saveDraft: vi.fn(async () => ({ ok: true, status: 201, created: true, answerId: "2644208" })),
  };
}

async function renderApp() {
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
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

function railLabels(container: HTMLElement): string[] {
  const nav = container.querySelector('nav[aria-label="Main"]');
  if (!nav) return [];
  return [...nav.querySelectorAll("button")].map((button) => button.textContent ?? "");
}

function railButton(container: HTMLElement, label: string): HTMLButtonElement | null {
  const nav = container.querySelector('nav[aria-label="Main"]');
  if (!nav) return null;
  return (
    [...nav.querySelectorAll("button")].find((button) =>
      (button.textContent ?? "").includes(label),
    ) ?? null
  );
}

describe("hideable features & settings", () => {
  it("shows the default-visible v1 set in the rail", async () => {
    const shell = installShellBridge({ hiddenViews: [], quitOnClose: false });
    installEdunex(shell);
    const container = await renderApp();

    expect(railLabels(container)).toEqual([
      "Home",
      "To Do",
      "Agenda",
      "Presence",
      "Materials",
      "Exams",
    ]);
  });

  it("hides a view from the features panel and drops it from the rail", async () => {
    const shell = installShellBridge({ hiddenViews: [], quitOnClose: false });
    installEdunex(shell);
    const container = await renderApp();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Open features"]')!.click();
    });
    const hideExams = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Hide Exams"]',
    );
    expect(hideExams).not.toBeNull();

    await act(async () => {
      hideExams!.click();
    });

    expect(shell.setViewHidden).toHaveBeenCalledWith("exams", true);
    // The resolved settings apply even before any main push arrives.
    expect(railLabels(container)).toEqual(["Home", "To Do", "Agenda", "Presence", "Materials"]);
  });

  it("right-click in the rail hides the view directly", async () => {
    const shell = installShellBridge({ hiddenViews: [], quitOnClose: false });
    installEdunex(shell);
    const container = await renderApp();

    const examsButton = railButton(container, "Exams");
    expect(examsButton).not.toBeNull();

    await act(async () => {
      examsButton!.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
    });

    expect(shell.setViewHidden).toHaveBeenCalledWith("exams", true);
    expect(railLabels(container)).not.toContain("Exams");
  });

  it("stays hidden across restarts by reading main's persisted settings", async () => {
    const shell = installShellBridge({ hiddenViews: ["agenda", "exams"], quitOnClose: false });
    installEdunex(shell);
    const container = await renderApp();

    expect(shell.getShellSettings).toHaveBeenCalled();
    expect(railLabels(container)).toEqual(["Home", "To Do", "Presence", "Materials"]);
  });

  it("settings modal flips the tray opt-out and re-enables hidden features", async () => {
    const shell = installShellBridge({ hiddenViews: ["exams"], quitOnClose: false });
    installEdunex(shell);
    const container = await renderApp();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Open settings"]')!.click();
    });

    const dialog = container.querySelector('[role="dialog"][aria-label="Settings"]');
    expect(dialog).not.toBeNull();

    const quitSwitch = container.querySelector<HTMLButtonElement>('button[role="switch"]');
    expect(quitSwitch?.getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      quitSwitch!.click();
    });
    expect(shell.setQuitOnClose).toHaveBeenCalledWith(true);

    const showExams = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show Exams"]',
    );
    expect(showExams).not.toBeNull();
    await act(async () => {
      showExams!.click();
    });
    expect(shell.setViewHidden).toHaveBeenCalledWith("exams", false);
    expect(railLabels(container)).toEqual([
      "Home",
      "To Do",
      "Agenda",
      "Presence",
      "Materials",
      "Exams",
    ]);
  });

  it("falls back to Home when the active view is hidden", async () => {
    const shell = installShellBridge({ hiddenViews: [], quitOnClose: false });
    installEdunex(shell);
    const container = await renderApp();

    await act(async () => {
      railButton(container, "To Do")!.click();
    });
    expect(container.querySelector("h1")?.textContent).toBe("To Do");

    await act(async () => {
      shell.pushSettings({ hiddenViews: ["todo"], quitOnClose: false });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(railLabels(container)).not.toContain("To Do");
    expect(container.querySelector("h1")?.textContent).toBe("Home");
  });
});
