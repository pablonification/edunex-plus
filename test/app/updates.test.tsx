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

/** Settings, with v2.1.0 out and found by the daily check. */
async function newerRelease(options: { updateBlocked?: UpdateBlock; world?: PretendWorld } = {}) {
  const world = options.world ?? new PretendWorld();
  world.github.latestTag = "v2.1.0";
  const opened = await openApp({ world, signedIn: true, checkForUpdates: true, updateBlocked: options.updateBlocked });
  screen = opened;
  await opened.wait(2 * 60_000);
  await opened.apply({ type: "command", command: "settings" });
  return opened;
}

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
    expect(s.installed).toEqual([{ kind: "mac", staged: "/tmp/update/Edunex Plus.app" }]);
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
