import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELL_SETTINGS,
  NAV_VIEWS,
  isHideableNavKey,
  sanitizeShellSettings,
} from "./shell";

describe("shell settings contract", () => {
  it("defaults to every v1 view visible with the tray opt-out off", () => {
    expect(DEFAULT_SHELL_SETTINGS).toEqual({ hiddenViews: [], quitOnClose: false });
    expect(NAV_VIEWS.map((view) => view.key)).toEqual([
      "home",
      "todo",
      "agenda",
      "presence",
      "materials",
      "exams",
    ]);
  });

  it("pins Home: only the five content views are hideable", () => {
    expect(isHideableNavKey("home")).toBe(false);
    for (const key of ["todo", "agenda", "presence", "materials", "exams"] as const) {
      expect(isHideableNavKey(key)).toBe(true);
    }
    expect(isHideableNavKey("nope")).toBe(false);
  });

  it("sanitizes garbage to defaults and coerces the opt-out to boolean", () => {
    expect(sanitizeShellSettings(null)).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(sanitizeShellSettings("x")).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(sanitizeShellSettings({})).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(sanitizeShellSettings({ hiddenViews: ["todo"], quitOnClose: 1 })).toEqual({
      hiddenViews: ["todo"],
      quitOnClose: false,
    });
  });

  it("drops Home, unknown keys and duplicates, keeping NAV_VIEWS order", () => {
    expect(
      sanitizeShellSettings({ hiddenViews: ["exams", "home", "todo", "todo", "nope"] }),
    ).toEqual({ hiddenViews: ["todo", "exams"], quitOnClose: false });
  });
});
