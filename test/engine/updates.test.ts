// #82: "new version available". The version comparison on its own, then the
// real engine against a pretend GitHub: once a day at most, quiet on any
// failure, never in development.
import { describe, expect, it } from "vitest";
import { isNewerRelease, releasePageUrl } from "../../src/core/updates";
import { MemoryStorage } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { startEngine } from "./harness";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("release versions", () => {
  it.each([
    ["v0.0.2", "0.0.1", true],
    ["0.1.0", "0.0.9", true],
    ["v1.10.0", "1.9.0", true],
    ["v2.0.0", "1.99.99", true],
    ["v1.0.0", "1.0.0", false],
    ["v0.9.0", "1.0.0", false],
    ["v1.0.0", "1.0.0-beta.2", true],
    ["v1.0.0-beta.2", "1.0.0", false],
    ["v1.0.0-beta.11", "1.0.0-beta.2", true],
    ["v1.0.0-rc.1", "1.0.0-beta.9", true],
    ["v1.0.0-alpha.beta", "1.0.0-alpha.1", true],
    ["v1.0.0-alpha", "1.0.0-alpha.1", false],
    ["v1.0.0+build.7", "1.0.0", false],
    ["latest", "1.0.0", false],
    ["v1.2", "1.0.0", false],
    ["v01.2.3", "1.0.0", false],
    ["v2.0.0", "not a version", false],
  ])("%s newer than %s: %s", (tag, current, newer) => {
    expect(isNewerRelease(tag, current)).toBe(newer);
  });

  it("links to the release's own page", () => {
    expect(releasePageUrl("v0.2.0")).toBe("https://github.com/pablonification/edunex-plus/releases/tag/v0.2.0");
  });
});

describe("new version check", () => {
  const notice = (h: Awaited<ReturnType<typeof startEngine>>) => h.dataset("app.update");

  it("tells the window about a newer release a minute after start, asking as the app", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    const h = await startEngine({ world, checkForUpdates: true });
    await h.wait(30_000);
    expect(world.github.requests).toHaveLength(0);
    await h.wait(31_000);
    expect(notice(h)).toEqual({ version: "2.1.0", url: "https://github.com/pablonification/edunex-plus/releases/tag/v2.1.0" });
    expect(world.github.requests[0].userAgent).toBe("EdunexPlus/2.0.0-test (+https://github.com/pablonification/edunex-plus)");
    expect(h.events.some((e) => e.type === "dataset" && e.dataset.name === "app.update")).toBe(true);
  });

  it("says nothing when this is the latest version or nothing is published", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.0.0-test";
    const h = await startEngine({ world, checkForUpdates: true, version: "2.0.0-test" });
    await h.wait(2 * MINUTE);
    expect(notice(h)).toBeUndefined();
    world.github.latestTag = null;
    await h.wait(DAY);
    expect(world.github.requests).toHaveLength(2);
    expect(notice(h)).toBeUndefined();
  });

  it("asks at most once a day, also across restarts", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v1.0.0";
    const storage = new MemoryStorage();
    const first = await startEngine({ world, storage, checkForUpdates: true });
    await first.wait(2 * MINUTE);
    expect(world.github.requests).toHaveLength(1);
    first.engine.stop();

    // Restarted an hour later: the next check waits for the day to pass.
    await world.clock.advance(HOUR);
    const second = await startEngine({ world, storage, checkForUpdates: true });
    await second.wait(DAY - HOUR - 3 * MINUTE);
    expect(world.github.requests).toHaveLength(1);
    await second.wait(2 * MINUTE);
    expect(world.github.requests).toHaveLength(2);
    expect(world.github.requests[1].at - world.github.requests[0].at).toBeGreaterThanOrEqual(DAY);
  });

  it("is quiet offline, on a refusal or an odd answer, and tries again later", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v3.0.0";
    world.setOffline(true);
    const h = await startEngine({ world, checkForUpdates: true });
    await h.wait(2 * MINUTE);
    expect(notice(h)).toBeUndefined();
    expect(h.status("edunex").state).toBe("signed-out");

    // Back online: tried again within the hour, not tomorrow.
    world.setOffline(false);
    world.github.failWith = 403;
    await h.wait(HOUR);
    expect(world.github.requests).toHaveLength(1);
    expect(notice(h)).toBeUndefined();

    world.github.failWith = null;
    await h.wait(DAY);
    expect(notice(h)).toMatchObject({ version: "3.0.0" });
  });

  it("drops the notice once the app has been updated to that version", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v2.1.0";
    const storage = new MemoryStorage();
    const old = await startEngine({ world, storage, checkForUpdates: true });
    await old.wait(2 * MINUTE);
    expect(notice(old)).toBeDefined();
    old.engine.stop();

    const updated = await startEngine({ world, storage, checkForUpdates: true, version: "2.1.0" });
    expect(notice(updated)).toBeUndefined();
  });

  it("never asks in development", async () => {
    const world = new PretendWorld();
    world.github.latestTag = "v9.0.0";
    const h = await startEngine({ world });
    await h.wait(2 * DAY);
    expect(world.github.requests).toHaveLength(0);
    expect(notice(h)).toBeUndefined();
  });
});
