import { rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL_SETTINGS } from "../../shared/shell";
import { loadShellSettings, saveShellSettings } from "./settings-store";

describe("shell settings store", () => {
  it("defaults to the v1 visible set with tray opt-out off", () => {
    expect(DEFAULT_SHELL_SETTINGS).toEqual({ hiddenViews: [], quitOnClose: false });
  });

  it("returns defaults for a missing or corrupt file", () => {
    expect(loadShellSettings("/nonexistent/shell-settings.json")).toEqual({
      hiddenViews: [],
      quitOnClose: false,
    });
  });

  it("round-trips hidden views and the tray opt-out", () => {
    const tmp = `/tmp/edunex-plus-shell-settings-${Date.now()}.json`;
    try {
      saveShellSettings(tmp, { hiddenViews: ["exams", "todo"], quitOnClose: true });
      // Sanitized into NAV_VIEWS order (todo before exams).
      expect(loadShellSettings(tmp)).toEqual({
        hiddenViews: ["todo", "exams"],
        quitOnClose: true,
      });
    } finally {
      try {
        rmSync(tmp);
      } catch {}
    }
  });

  it("drops unknown keys and never hides Home, even from disk", () => {
    const tmp = `/tmp/edunex-plus-shell-settings-${Date.now()}-dirty.json`;
    try {
      saveShellSettings(tmp, {
        hiddenViews: ["home", "todo", "todo", "nope"] as unknown as ["todo"],
        quitOnClose: false,
      });
      expect(loadShellSettings(tmp)).toEqual({ hiddenViews: ["todo"], quitOnClose: false });
    } finally {
      try {
        rmSync(tmp);
      } catch {}
    }
  });
});
