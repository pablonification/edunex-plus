// @vitest-environment jsdom
// #82, seam 2: a newer release shows as a dot on the settings button and a
// line in Settings. "Unduh & pasang" downloads it from GitHub (main's real
// plan, ../../src/desktop/self-update.ts, on the pretend GitHub), shows how far
// it got, and "Mulai ulang untuk memperbarui" installs it, only when pressed.
// A copy that can't update itself says why and opens the release page.
import { afterEach, describe, expect, it } from "vitest";
import type { UpdateBlock } from "../../src/core/models";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** Settings, with v2.1.0 out and found by the daily check; "Perbarui otomatis" off unless asked, so the Student downloads it. */
async function newerRelease(options: { updateBlocked?: UpdateBlock; world?: PretendWorld; autoUpdate?: boolean } = {}) {
  const world = options.world ?? new PretendWorld();
  world.github.latestTag = "v2.1.0";
  const opened = await openApp({ world, signedIn: true, checkForUpdates: true, updateBlocked: options.updateBlocked, autoUpdate: options.autoUpdate ?? false });
  screen = opened;
  await opened.wait(2 * 60_000);
  await opened.apply({ type: "command", command: "settings" });
  return opened;
}

describe("checking for a newer version now", () => {
  const check = async (s: Awaited<ReturnType<typeof openApp>>) => {
    await s.apply({ type: "command", command: "settings" });
    await s.click("Periksa pembaruan");
  };

  it('"Periksa pembaruan" asks GitHub at once: the latest version says so, a newer one shows right above it and starts downloading', async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.0.0-test";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    await check(screen);
    expect(screen.calls.at(-1)).toEqual({ name: "app.checkUpdate", input: {} });
    expect(screen.text()).toContain("Ini versi terbaru.");
    expect(screen.text()).not.toContain("Versi baru tersedia");

    world.github.latestTag = "v2.1.0";
    await screen.click("Periksa pembaruan");
    expect(screen.text()).toContain("Edunex Plus 2.1.0 sudah keluar.");
    expect(screen.text()).toContain("Versi baru tersedia");
    // "Perbarui otomatis" is on: it's on its way already.
    expect(screen.text()).toContain("Mengunduh Edunex Plus 2.1.0…");
    // Both checks were the Student's: the one a minute after start now waits a day.
    await screen.wait(2 * 60_000);
    expect(world.github.requests.filter((r) => r.path === "/repos/pablonification/edunex-plus/releases")).toHaveLength(2);
  });

  it("offline, says to try again once online", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    world.setOffline(true);
    await check(screen);
    expect(screen.text()).toContain("Tidak bisa memeriksa sekarang. Coba lagi saat sudah terhubung.");
    expect(screen.text()).not.toContain("Versi baru tersedia");
  });

  it("in development or the demo, says only the installed app checks", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    screen = await openApp({ world, signedIn: true });
    await check(screen);
    expect(screen.text()).toContain("Hanya aplikasi yang terpasang yang memeriksa pembaruan.");
    expect(world.github.requests).toHaveLength(0);
  });
});

describe("updating automatically", () => {
  it("is on by default: a newer release downloads by itself and goes in place when the Student quits, without opening again", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    await screen.wait(2 * 60_000);
    await screen.apply({ type: "command", command: "settings" });
    expect(screen.button("Perbarui otomatis").getAttribute("aria-checked")).toBe("true");
    expect(screen.text()).toContain("Mengunduh Edunex Plus 2.1.0…");
    expect(screen.has("Unduh & pasang")).toBe(false);

    await screen.finishUpdateDownload();
    expect(screen.text()).toContain("Edunex Plus 2.1.0 siap. Terpasang saat kamu menutup aplikasi, atau mulai ulang sekarang.");
    expect(screen.installed).toEqual([]);
    await screen.quit();
    expect(screen.installed).toEqual([{ kind: "mac", staged: "/tmp/update/Edunex Plus.app", reopen: false }]);
    expect(screen.openedPages).toEqual([]);
  });

  it("restarting now still puts it in place and opens it, once", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    await screen.wait(2 * 60_000);
    await screen.apply({ type: "command", command: "settings" });
    await screen.finishUpdateDownload();
    await screen.click("Mulai ulang untuk memperbarui");
    // Restarting quits the app too: what's in place already isn't put in place again.
    await screen.quit();
    expect(screen.installed).toEqual([{ kind: "mac", staged: "/tmp/update/Edunex Plus.app", reopen: true }]);
  });

  it("turned on with a newer release already found, starts its download", async () => {
    const s = await newerRelease();
    expect(s.text()).not.toContain("Mengunduh");
    await s.click("Perbarui otomatis");
    expect(s.engine.snapshot().settings.autoUpdate).toBe(true);
    expect(s.text()).toContain("Mengunduh Edunex Plus 2.1.0…");
  });

  it("never opens the release page by itself when this copy can't update itself", async () => {
    const s = await newerRelease({ updateBlocked: "deb", autoUpdate: true });
    expect(s.text()).not.toContain("Mengunduh");
    expect(s.openedPages).toEqual([]);
    expect(s.button("Unduh")).toBeTruthy();
  });

  it('sits with "Periksa pembaruan" first in Settings, above the accounts', async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    const titles = [...document.querySelectorAll("[role=dialog] h3")].map((h) => h.textContent);
    expect(titles.slice(0, 2)).toEqual(["Pembaruan", "Akun"]);
    expect(screen.text()).toContain("Versi 2.0.0-test");
    expect(screen.text()).toContain("Diperiksa sendiri sekali sehari.");
  });
});

describe("new version available", () => {
  it("shows the newer version in Settings, with the dot on the settings button", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    expect(screen.text()).not.toContain("Versi baru tersedia");
    await screen.wait(2 * 60_000);
    // The sidebar's settings button carries the dot, named for screen readers.
    expect(screen.text()).toContain("Versi baru tersedia");

    await screen.apply({ type: "command", command: "settings" });
    expect(screen.text()).toContain("Edunex Plus 2.1.0");
    await screen.click("Lihat yang baru");
    expect(screen.calls.at(-1)).toEqual({ name: "app.openRelease", input: {} });
  });

  it("downloads it, shows how far, and installs only when the Student restarts", async () => {
    const s = await newerRelease();
    await s.click("Unduh & pasang");
    expect(s.text()).toContain("Mengunduh Edunex Plus 2.1.0…");
    expect(s.button("Lihat yang baru")).toBeTruthy();
    expect(document.querySelector('[role=progressbar][aria-label="40% terunduh"]')?.getAttribute("aria-valuenow")).toBe("40");
    expect(s.has("Mulai ulang untuk memperbarui")).toBe(false);

    await s.finishUpdateDownload();
    expect(s.text()).toContain("Edunex Plus 2.1.0 siap dipasang");
    expect(s.installed).toEqual([]);
    await s.click("Mulai ulang untuk memperbarui");
    expect(s.installed).toEqual([{ kind: "mac", staged: "/tmp/update/Edunex Plus.app", reopen: true }]);
    expect(s.openedPages).toEqual([]);
  });

  it("downloads only from the release GitHub lists, the file for this Mac", async () => {
    const s = await newerRelease();
    await s.click("Unduh & pasang");
    expect(s.world.github.requests.map((r) => r.path)).toContain("/repos/pablonification/edunex-plus/releases/tags/v2.1.0");
  });

  it("doesn't install a file that isn't the one the release lists, and offers to try again", async () => {
    const world = new PretendWorld();
    world.github.tampered.add("Edunex-Plus-2.1.0-arm64-mac.zip");
    const s = await newerRelease({ world });
    await s.click("Unduh & pasang");
    await s.finishUpdateDownload();
    expect(s.text()).toContain("tidak sama dengan yang ada di rilis");
    expect(s.has("Mulai ulang untuk memperbarui")).toBe(false);
    expect(s.button("Coba lagi")).toBeTruthy();
  });

  it("says so quietly when there's no connection", async () => {
    const s = await newerRelease();
    await s.click("Unduh & pasang");
    await s.finishUpdateDownload("net::ERR_INTERNET_DISCONNECTED");
    expect(s.text()).toContain("Tidak ada koneksi");
    await s.click("Coba lagi");
    expect(s.text()).toContain("Mengunduh Edunex Plus 2.1.0…");
  });

  it("opens the release page, and says why, when the app can't replace itself where it is", async () => {
    const s = await newerRelease({ updateBlocked: "diskImage" });
    expect(s.has("Unduh & pasang")).toBe(false);
    expect(s.text()).toContain("dibuka dari disk image");
    await s.click("Unduh");
    expect(s.calls.at(-1)).toEqual({ name: "app.openRelease", input: {} });
  });

  it("only opens the release page in a development or demo build, without a reason to read", async () => {
    const s = await newerRelease({ updateBlocked: "notPackaged" });
    expect(s.has("Unduh & pasang")).toBe(false);
    expect(s.text()).not.toContain("halaman rilis");
    await s.click("Unduh");
    expect(s.calls.at(-1)).toEqual({ name: "app.openRelease", input: {} });
    expect(s.openedPages).toEqual([]);
  });

  it('with "Perbarui otomatis" off, waits for the Student, and quitting installs nothing', async () => {
    const s = await newerRelease();
    expect(s.button("Unduh & pasang")).toBeTruthy();
    expect(s.text()).not.toContain("Mengunduh");
    await s.quit();
    expect(s.installed).toEqual([]);
  });

  it("shows nothing when this is the latest version", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.0.0-test";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    await screen.wait(2 * 60_000);
    await screen.apply({ type: "command", command: "settings" });
    expect(screen.text()).not.toContain("Versi baru tersedia");
    expect(screen.has("Unduh & pasang")).toBe(false);
  });
});
