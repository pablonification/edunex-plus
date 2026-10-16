// Settings on disk (#85): what an older version saved still loads, a value
// that no longer fits falls back alone (never the Student's theme or language
// with it), each course's own attendance target belongs to the Student who
// set it, and quiet hours on the phone are on for settings saved before them.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/core/models";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryStorage } from "../pretend/memory";
import { startEngine } from "./harness";

/** A state.json as a version saved it. */
const saved = (settings: Record<string, unknown>) => {
  const storage = new MemoryStorage();
  storage.files.set("state.json", JSON.stringify({ format: 1, settings, statuses: [] }));
  return storage;
};

describe("saved settings", () => {
  it("from before per-course targets: the default target stays, no course has its own", async () => {
    const h = await startEngine({ storage: saved({ theme: "dark", lang: "en", attendanceTarget: 75, mutedAlerts: ["grade"] }), start: false });
    expect(h.engine.snapshot().settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark", lang: "en", attendanceTarget: 75, mutedAlerts: ["grade"] });
    expect(h.engine.snapshot().settings.attendanceTargets).toEqual({});
  });

  it("from before reminder times and class alerts: deadlines 2 days, 1 day and 3 hours before; class alerts off", async () => {
    const h = await startEngine({ storage: saved({ theme: "dark", lang: "en", mutedAlerts: [], closeToTray: false }), start: false });
    expect(h.engine.snapshot().settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark", lang: "en", closeToTray: false });
    expect(h.engine.snapshot().settings).toMatchObject({ deadlineReminders: [48, 24, 3], classSoonAlerts: false });
  });

  it("chosen reminder times load as saved, none too; a time the app doesn't offer falls back alone", async () => {
    const chosen = await startEngine({ storage: saved({ deadlineReminders: [24, 1], classSoonAlerts: true }), start: false });
    expect(chosen.engine.snapshot().settings).toMatchObject({ deadlineReminders: [24, 1], classSoonAlerts: true });
    const none = await startEngine({ storage: saved({ deadlineReminders: [] }), start: false });
    expect(none.engine.snapshot().settings.deadlineReminders).toEqual([]);
    const odd = await startEngine({ storage: saved({ theme: "dark", deadlineReminders: [5] }), start: false });
    expect(odd.engine.snapshot().settings).toMatchObject({ theme: "dark", deadlineReminders: [48, 24, 3] });
  });

  it("with this version's per-course targets, they load as saved", async () => {
    const h = await startEngine({ storage: saved({ attendanceTarget: 80, attendanceTargets: { DK4073: 75, KU5014: 90 } }), start: false });
    expect(h.engine.snapshot().settings.attendanceTargets).toEqual({ DK4073: 75, KU5014: 90 });
  });

  it("one value that doesn't fit falls back on its own; the rest of the Student's choices stay", async () => {
    const h = await startEngine({
      storage: saved({ theme: "dark", lang: "en", attendanceTarget: 85, attendanceTargets: { DK4073: 120 }, closeToTray: "sometimes" }),
      start: false,
    });
    expect(h.engine.snapshot().settings).toMatchObject({ theme: "dark", lang: "en", attendanceTarget: 85, attendanceTargets: {}, closeToTray: true });
  });

  it("a course's own target is the Student's: signing out of everything forgets it, the default stays", async () => {
    const h = await startEngine();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    await h.engine.updateSettings({ attendanceTarget: 75, attendanceTargets: { DK4073: 90 } });
    // Signing out of one system keeps it.
    await h.engine.signOut("edunex");
    expect(h.engine.snapshot().settings.attendanceTargets).toEqual({ DK4073: 90 });
    await h.engine.signOut();
    expect(h.engine.snapshot().settings).toMatchObject({ attendanceTarget: 75, attendanceTargets: {} });
    // And it stays forgotten after a restart.
    const again = await startEngine({ storage: h.storage, start: false });
    expect(again.engine.snapshot().settings.attendanceTargets).toEqual({});
  });

  it("from before quiet hours on the phone: they're on, 22:00 to 06:00; turned off, or a pair that doesn't fit, as expected", async () => {
    const before = await startEngine({ storage: saved({ theme: "dark", mutedAlerts: ["grade"] }), start: false });
    expect(before.engine.snapshot().settings).toMatchObject({ theme: "dark", phoneQuietHours: { start: 22, end: 6 } });
    const off = await startEngine({ storage: saved({ phoneQuietHours: null }), start: false });
    expect(off.engine.snapshot().settings.phoneQuietHours).toBeNull();
    const odd = await startEngine({ storage: saved({ theme: "dark", phoneQuietHours: { start: 7, end: 7 } }), start: false });
    expect(odd.engine.snapshot().settings).toMatchObject({ theme: "dark", phoneQuietHours: { start: 22, end: 6 } });
    await expect(odd.engine.updateSettings({ phoneQuietHours: { start: 24, end: 6 } })).rejects.toThrow();
  });

  it("a target out of range is refused, not saved", async () => {
    const h = await startEngine({ start: false });
    await expect(h.engine.updateSettings({ attendanceTargets: { DK4073: 45 } })).rejects.toThrow();
    expect(h.engine.snapshot().settings.attendanceTargets).toEqual({});
  });
});
