// The engine's start on the phone (mobile/src/host/host.ts, app.ready): the feeds go at once, and what can wait (the
// timed alerts worked out and booked ahead, the update check, the datasets saved again after an update) is left to the
// host, a slice at a time, out of the screens' first seconds: run with them, it held a mid-range phone's JS thread
// 164–170 ms right after Beranda's first frame. A background sync's start does it all at once, as before.
import { afterEach, describe, expect, it } from "vitest";
import type { PlannedAlert } from "../../src/engine/alerts/detector";
import { AppLog } from "../../src/engine/app-log";
import { createEngine, type Engine, type StartLater } from "../../src/engine/engine";
import { startEngine } from "../engine/harness";
import { demoOptions, demoRun } from "../pretend/demo";
import { MemoryStorage } from "../pretend/memory";

const engines: Engine[] = [];
afterEach(() => {
  for (const engine of engines.splice(0)) engine.stop();
});

/** A Student signed in and read once, then the app opened again (saved under no build's stamp: an update) on a network that never answers. */
async function reopened() {
  const run = demoRun(demoOptions({ EDUNEX_DEMO: "signed-in" }));
  const storage = new MemoryStorage();
  const first = await startEngine({ world: run.world, storage, start: false, startDueOnly: true });
  engines.push(first.engine);
  await run.prepare(first.engine);
  first.engine.stop();
  const now = run.world.clock.now();
  const planned: (readonly PlannedAlert[])[] = [];
  const writes: string[] = [];
  let breaths = 0;
  const engine = createEngine({
    transport: { request: () => new Promise(() => undefined) },
    clock: { now: () => now, setTimeout: () => ({ id: 0 }), clearTimeout: () => undefined },
    storage: {
      read: (key) => storage.read(key),
      write: (key, text) => {
        writes.push(key);
        return storage.write(key, text);
      },
      remove: (key) => storage.remove(key),
      list: (prefix) => storage.list(prefix),
    },
    vault: first.vault,
    version: "2.0.0-test",
    emit: () => undefined,
    log: new AppLog(() => now),
    relay: "",
    startDueOnly: true,
    checkInReminders: true,
    shapes: "build-a",
    upcoming: (alerts) => planned.push(alerts),
    yieldToScreens: async () => {
      breaths++;
    },
  });
  engines.push(engine);
  await engine.load();
  return { engine, planned, writes, breaths: () => breaths };
}

/** A host's later: each slice kept, to run by hand. */
function laterByHand() {
  const asked = new Map<string, () => void>();
  const later: StartLater = (what, run) => void asked.set(what, run);
  return { later, asked };
}

const restamped = (writes: readonly string[]) => writes.filter((key) => key.startsWith("datasets/"));

describe("the engine's start, a slice at a time", () => {
  it("leaves the alerts, the update check and the restamp to the host, each run alone", async () => {
    const { engine, planned, writes, breaths } = await reopened();
    const { later, asked } = laterByHand();
    engine.start(later);
    expect([...asked.keys()].sort()).toEqual(["alerts", "restamp", "updates"]);
    // Nothing of them ran with the start.
    expect(planned).toEqual([]);
    await Promise.resolve();
    expect(restamped(writes)).toEqual([]);

    asked.get("alerts")!();
    expect(planned).toHaveLength(1);
    expect(planned[0]!.length).toBeGreaterThan(0);

    asked.get("restamp")!();
    await expect.poll(() => restamped(writes).length).toBeGreaterThan(1);
    // The screens get their turn between two files.
    await expect.poll(() => breaths()).toBe(restamped(writes).length);
  });

  it("works the alerts out at once when they're asked for before their turn, and only once", async () => {
    const { engine, planned } = await reopened();
    const { later, asked } = laterByHand();
    engine.start(later);
    engine.planAlerts();
    expect(planned).toHaveLength(1);
    asked.get("alerts")!();
    expect(planned).toHaveLength(1);
  });

  it("runs nothing a stopped start left", async () => {
    const { engine, planned, writes } = await reopened();
    const { later, asked } = laterByHand();
    engine.start(later);
    engine.stop();
    for (const run of asked.values()) run();
    await Promise.resolve();
    expect(planned).toEqual([]);
    expect(restamped(writes)).toEqual([]);
  });

  it("does it all at once without a host's later (a background sync, the desktop)", async () => {
    const { engine, planned } = await reopened();
    engine.start();
    expect(planned).toHaveLength(1);
  });
});
