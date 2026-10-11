// @vitest-environment jsdom
// #82, seam 2: a newer release shows as a dot on the settings button and a
// line in Settings whose "Unduh" opens the release page. Nothing otherwise.
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

describe("new version available", () => {
  it("shows the newer version in Settings, and Unduh opens its release page", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    expect(screen.text()).not.toContain("Versi baru tersedia");
    await screen.wait(2 * 60_000);
    // The sidebar's settings button carries the dot, named for screen readers.
    expect(screen.text()).toContain("Versi baru tersedia");

    await screen.apply({ type: "command", command: "settings" });
    expect(screen.text()).toContain("Edunex Plus 2.1.0");
    await screen.click("Unduh");
    expect(screen.calls.at(-1)).toEqual({ name: "app.openRelease", input: {} });
  });

  it("shows nothing when this is the latest version", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.0.0-test";
    screen = await openApp({ world, signedIn: true, checkForUpdates: true });
    await screen.wait(2 * 60_000);
    await screen.apply({ type: "command", command: "settings" });
    expect(screen.text()).not.toContain("Versi baru tersedia");
    expect(screen.has("Unduh")).toBe(false);
  });
});
