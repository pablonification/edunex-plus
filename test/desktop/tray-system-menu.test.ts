// The tray menu as each system draws it (src/desktop/tray.ts): a section's
// label where macOS has one, a line that can't be clicked elsewhere; a line's
// detail in small type under it where macOS draws one, after it elsewhere; a "&" in
// a Task's title shown as one; each line's click doing what the menu says;
// and the menu set again only when it says something new, at most once a
// second however many changes a sync sends, and each minute for the clock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrayAction, TrayMenu } from "../../src/desktop/tray-menu";

type Item = { type?: string; label?: string; sublabel?: string; enabled?: boolean; click?: () => void };
const shown = vi.hoisted(() => ({ menus: [] as Item[][], tooltips: [] as string[], clicks: [] as (() => void)[] }));
vi.mock("electron", () => ({
  app: { getAppPath: () => "/app" },
  Menu: { buildFromTemplate: (template: Item[]) => template },
  nativeImage: { createFromPath: () => ({ isEmpty: () => false, setTemplateImage() {} }) },
  Tray: class {
    setToolTip(tip: string) {
      shown.tooltips.push(tip);
    }
    setContextMenu(menu: Item[]) {
      shown.menus.push(menu);
    }
    on(event: string, listener: () => void) {
      if (event === "click") shown.clicks.push(listener);
    }
    destroy() {}
  },
}));

const { createTray } = await import("../../src/desktop/tray");
const realPlatform = process.platform;
const runOn = (platform: NodeJS.Platform, macOS = "15.1") => {
  Object.defineProperty(process, "platform", { value: platform });
  (process as { getSystemVersion?: () => string }).getSystemVersion = () => macOS;
};

const MENU: TrayMenu = {
  tooltip: "Edunex Plus · 1 perlu perhatianmu",
  entries: [
    { type: "item", label: "Diperbarui pukul 14:05", action: null },
    { type: "separator" },
    { type: "header", label: "Perlu perhatianmu" },
    { type: "item", label: "Tugas A & B", detail: "II4091 · Tenggat Besok, 23:59", action: { kind: "route", route: { screen: "task", taskId: 7 } } },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-08T14:05:30+07:00"));
});

afterEach(() => {
  vi.useRealTimers();
  runOn(realPlatform);
  shown.menus.length = 0;
  shown.tooltips.length = 0;
  shown.clicks.length = 0;
});

function open(menu: () => TrayMenu = () => MENU) {
  const acted: TrayAction[] = [];
  const tray = createTray({ menu, now: () => Date.now(), act: (action) => acted.push(action) })!;
  return { tray, acted };
}

describe("the tray menu as the system draws it", () => {
  it("macOS 14.4 and later: a section's label is a real one, a detail is in small type under its line; a quiet line can't be clicked; a click does what the menu says", () => {
    runOn("darwin", "14.4");
    const { tray, acted } = open();
    const [status, separator, header, task] = shown.menus[0]!;
    expect(status).toEqual({ label: "Diperbarui pukul 14:05", enabled: false });
    expect(separator).toEqual({ type: "separator" });
    expect(header).toEqual({ type: "header", label: "Perlu perhatianmu" });
    expect([task!.label, task!.sublabel]).toEqual(["Tugas A & B", "II4091 · Tenggat Besok, 23:59"]);
    task!.click!();
    expect(acted).toEqual([{ kind: "route", route: { screen: "task", taskId: 7 } }]);
    expect(shown.tooltips).toEqual(["Edunex Plus · 1 perlu perhatianmu"]);
    // The menu bar's icon opens the menu itself: no click of its own.
    expect(shown.clicks).toEqual([]);
    tray.destroy();
  });

  it("older macOS, Windows and Linux: the label is a line that can't be clicked, a detail follows its line, and '&' stays one '&'", () => {
    runOn("darwin", "13.6");
    open().tray.destroy();
    expect(shown.menus[0]![2]).toEqual({ label: "Perlu perhatianmu", enabled: false });
    expect(shown.menus[0]![3]).toMatchObject({ label: "Tugas A & B · II4091 · Tenggat Besok, 23:59" });
    expect(shown.menus[0]![3]!.sublabel).toBeUndefined();
    // macOS 14 has section labels, but no line under a line until 14.4.
    runOn("darwin", "14.3");
    shown.menus.length = 0;
    open().tray.destroy();
    expect(shown.menus[0]![2]).toEqual({ type: "header", label: "Perlu perhatianmu" });
    expect(shown.menus[0]![3]!.label).toBe("Tugas A & B · II4091 · Tenggat Besok, 23:59");
    for (const platform of ["win32", "linux"] as const) {
      runOn(platform);
      shown.menus.length = 0;
      const { tray, acted } = open();
      expect(shown.menus[0]![2]).toEqual({ label: "Perlu perhatianmu", enabled: false });
      expect(shown.menus[0]![3]!.label).toBe("Tugas A && B · II4091 · Tenggat Besok, 23:59");
      expect(shown.menus[0]![3]!.sublabel).toBeUndefined();
      // A click on the icon opens the window; the menu is on right-click.
      shown.clicks.at(-1)!();
      expect(acted).toEqual([{ kind: "window" }]);
      tray.destroy();
    }
  });

  it("built again once a second at most while a sync sends its changes, set again only when it says something new", () => {
    runOn("darwin");
    let menu = MENU;
    const built = vi.fn(() => menu);
    const { tray } = open(built);
    expect(shown.menus).toHaveLength(1);
    for (let i = 0; i < 20; i++) tray.changed();
    vi.advanceTimersByTime(999);
    expect(built).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(built).toHaveBeenCalledTimes(2);
    // Nothing new: the open menu is left alone.
    expect(shown.menus).toHaveLength(1);
    menu = { ...MENU, tooltip: "Edunex Plus" };
    tray.update();
    expect(shown.menus).toHaveLength(2);
    tray.destroy();
  });

  it("each minute on the minute, for what the clock moves: a class starting, a deadline passing, a new day", () => {
    runOn("darwin");
    let minute = "14:05";
    const { tray } = open(() => ({ ...MENU, entries: [{ type: "item", label: `Diperbarui pukul ${minute}`, action: null }] }));
    minute = "14:06";
    vi.advanceTimersByTime(29_000);
    expect(shown.menus).toHaveLength(1);
    // Just past it, so the clock already reads the new minute.
    vi.advanceTimersByTime(1_050);
    expect(shown.menus.at(-1)![0]!.label).toBe("Diperbarui pukul 14:06");
    minute = "14:07";
    vi.advanceTimersByTime(60_000);
    expect(shown.menus.at(-1)![0]!.label).toBe("Diperbarui pukul 14:07");
    tray.destroy();
  });

  it("a menu that can't be built leaves the last one, with Open and Quit in it", () => {
    runOn("darwin");
    let fail = false;
    const { tray } = open(() => {
      if (fail) throw new Error("bad data");
      return MENU;
    });
    fail = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tray.update();
    expect(shown.menus).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    tray.destroy();
  });
});
