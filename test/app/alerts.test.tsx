// @vitest-environment jsdom
// v2-07 (#75), seam 2: the bell, the alert history and the alert settings in
// the window, with the real engine and the pretend Edunex behind the bridge.
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

const MINUTE = 60_000;

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** The bell's panel. */
const panel = () => document.querySelector("[role=dialog][aria-label=Notifikasi], [role=dialog][aria-label=Notifications]");
const unreadDots = () => panel()?.querySelectorAll(".sr-only").length ?? 0;

/** Signed in, past the silent first sync, then a lecturer posts a material. */
async function withNewMaterial() {
  screen = await openApp({ signedIn: true });
  await screen.wait(5 * MINUTE);
  screen.world.edunex.postMaterial(95059, { name: "K5. Pembiayaan infrastruktur" });
  await screen.wait(5 * MINUTE);
  return screen;
}

describe("the bell", () => {
  it("is quiet after the first sync, yet not empty: it shows what Beranda's 'Yang berubah' shows, nothing unread", async () => {
    screen = await openApp({ signedIn: true });
    await screen.wait(5 * MINUTE);
    expect(screen.has("Notifikasi")).toBe(true);
    const changes = [...document.querySelectorAll('main section[aria-labelledby="home-changes"] li')].map(
      (li) => li.querySelector("button span span")?.textContent,
    );
    expect(changes.length).toBeGreaterThan(0);
    await screen.click("Notifikasi");
    for (const title of changes) expect(panel()?.textContent).toContain(title);
    expect(unreadDots()).toBe(0);
  });

  it("never says it reads SIX while SIX isn't connected", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Notifikasi");
    expect(panel()?.textContent).toContain("Dari Edunex · SIX belum terhubung");
    expect(panel()?.textContent).not.toContain("Dari Edunex dan SIX");
  });

  it("with nothing at all, says what will show here", async () => {
    const world = new PretendWorld({ now: "2026-10-10T10:00:00+07:00" });
    world.edunex.tasks.clear();
    world.edunex.contents.clear();
    world.edunex.announcements.clear();
    screen = await openApp({ world, signedIn: true });
    await screen.click("Notifikasi");
    expect(panel()?.textContent).toContain("Belum ada yang berubah");
    expect(panel()?.textContent).toContain(
      "Tugas baru, materi, dan tenggat yang mendekat muncul di sini. Edunex diperiksa sendiri secara berkala; jadwal dan kehadiran menyusul setelah SIX terhubung.",
    );
    // It never claims SIX is checked while SIX isn't connected.
    expect(panel()?.textContent).not.toContain("Edunex dan SIX diperiksa");
  });

  it("counts a new alert, lists it, and marks it read in the app only", async () => {
    const s = await withNewMaterial();
    await s.click("Notifikasi, 1 belum dibaca");
    expect(panel()?.textContent).toContain("Materi baru · PL3032");
    expect(panel()?.textContent).toContain("K5. Pembiayaan infrastruktur");
    expect(panel()?.textContent).toContain("Hari ini");
    // Opened: the count goes; the new one keeps its dot until "Tandai semua dibaca".
    expect(unreadDots()).toBe(1);
    await s.click("Tandai semua dibaca");
    expect(unreadDots()).toBe(0);
    await s.key("Escape");
    expect(s.has("Notifikasi")).toBe(true);
    expect(s.has(/belum dibaca/)).toBe(false);
    expect(s.world.log.every((request) => request.method === "GET")).toBe(true);
  });

  it("links to the notification settings", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Notifikasi");
    await screen.click("Atur notifikasi");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Pengaturan");
    expect(screen.text()).toContain("24 jam dan 3 jam sebelumnya, hanya jika belum dikumpulkan");
    // Without SIX, the alerts only SIX can raise say so.
    expect(screen.text()).toContain("SIX tidak mencatat kuliah, jatah absen habis · butuh SIX");
    expect(screen.text()).not.toContain("sebelumnya, hanya jika belum dikumpulkan · butuh SIX");
  });

  it("an item opens its screen", async () => {
    const s = await withNewMaterial();
    expect(s.text()).toContain("Mata kuliah semester ini");
    await s.click(/Notifikasi/);
    await s.click([...panel()!.querySelectorAll("button")].find((b) => b.textContent?.includes("Materi baru · PL3032"))!);
    // The course page (a detail screen) replaced Home.
    expect(s.text()).not.toContain("Mata kuliah semester ini");
    expect(s.has(/^Kembali ke /)).toBe(true);
    expect(panel()).toBeNull();
  });

  it("a clicked OS notification opens its screen", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "navigate", route: { screen: "course", code: "PL3032", tab: "modules" } });
    expect(screen.text()).not.toContain("Mata kuliah semester ini");
    expect(screen.has(/^Kembali ke /)).toBe(true);
  });

  it("speaks English when asked", async () => {
    const s = await withNewMaterial();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await s.click("Notifications, 1 unread");
    expect(panel()?.textContent).toContain("New material · PL3032");
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

    expect(screen.button("Tetap berjalan di latar").getAttribute("aria-checked")).toBe("true");
    await screen.click("Tutup aplikasi");
    expect(screen.engine.snapshot().settings.closeToTray).toBe(false);

    await screen.click("Kirim");
    expect(screen.calls.some((call) => call.name === "alerts.test")).toBe(true);
    // Something visible answers back, with the fix when nothing showed.
    expect(screen.text()).toContain("Terkirim. Tidak muncul? Izinkan notifikasi Edunex Plus di pengaturan sistem.");
  });
});
