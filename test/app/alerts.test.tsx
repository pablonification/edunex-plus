// @vitest-environment jsdom
// v2-07 (#75), seam 2: the bell, the alert history and the alert settings in
// the window, with the real engine and the pretend EduNex behind the bridge.
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

const MINUTE = 60_000;

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** Signed in, past the silent first sync, then a lecturer posts a material. */
async function withNewMaterial() {
  screen = await openApp({ signedIn: true });
  await screen.wait(5 * MINUTE);
  screen.world.edunex.postMaterial(95059, { name: "K5. Pembiayaan infrastruktur" });
  await screen.wait(5 * MINUTE);
  return screen;
}

describe("the bell", () => {
  it("is quiet after the first sync", async () => {
    screen = await openApp({ signedIn: true });
    await screen.wait(5 * MINUTE);
    expect(screen.has("Notifikasi")).toBe(true);
    await screen.click("Notifikasi");
    expect(screen.text()).toContain("Belum ada notifikasi");
  });

  it("counts a new alert, lists it, and marks it read in the app only", async () => {
    const s = await withNewMaterial();
    await s.click("Notifikasi, 1 belum dibaca");
    const panel = document.querySelector("[role=region]")!;
    expect(panel.textContent).toContain("Materi baru · PL3032");
    expect(panel.textContent).toContain("K5. Pembiayaan infrastruktur");
    expect(panel.textContent).toContain("Hari ini");
    // Read in the app: the count goes, and EduNex was only ever read.
    await s.key("Escape");
    expect(s.has("Notifikasi")).toBe(true);
    expect(s.has(/belum dibaca/)).toBe(false);
    expect(s.world.log.every((request) => request.method === "GET")).toBe(true);
  });

  it("an item opens its screen", async () => {
    const s = await withNewMaterial();
    expect(s.text()).toContain("Mata kuliah semester ini");
    await s.click(/Notifikasi/);
    await s.click(/Materi baru · PL3032/);
    // The course page (a detail screen) replaced Home.
    expect(s.text()).not.toContain("Mata kuliah semester ini");
    expect(s.has("Kembali")).toBe(true);
    expect(document.querySelector("[role=region]")).toBeNull();
  });

  it("a clicked OS notification opens its screen", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "navigate", route: { screen: "course", code: "PL3032", tab: "modules" } });
    expect(screen.text()).not.toContain("Mata kuliah semester ini");
    expect(screen.has("Kembali")).toBe(true);
  });

  it("speaks English when asked", async () => {
    const s = await withNewMaterial();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await s.click("Notifications, 1 unread");
    expect(document.querySelector("[role=region]")!.textContent).toContain("New material · PL3032");
  });
});

describe("alert settings", () => {
  it("turns a kind of alert off and chooses what closing the window does", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    expect(screen.text()).toContain("24 jam dan 3 jam sebelumnya, hanya jika belum dikumpulkan");
    const materials = screen.button("Materi baru");
    expect(materials.getAttribute("aria-checked")).toBe("true");
    await screen.click(materials);
    expect(screen.engine.snapshot().settings.mutedAlerts).toEqual(["newMaterial"]);
    expect(screen.button("Materi baru").getAttribute("aria-checked")).toBe("false");

    expect(screen.button("Tetap berjalan").getAttribute("aria-checked")).toBe("true");
    await screen.click("Keluar");
    expect(screen.engine.snapshot().settings.closeToTray).toBe(false);

    await screen.click("Kirim");
    expect(screen.calls.some((call) => call.name === "alerts.test")).toBe(true);
  });
});
