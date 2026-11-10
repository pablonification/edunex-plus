// How soon a phone shows fresh data, on a pretend network as slow as the real one (test/pretend/network.ts):
// each request takes what that kind of request took on Edunex and SIX, from the lead's recording when it's
// in test/fixtures/real-timings.json (scripts/record-sync-timings.mjs), else from the estimates beside it.
// The targets are the phone's on Wi-Fi: what Beranda shows for today and what's due, fresh within 5 s of the
// start; a pull to refresh done within 15 s. Within them, no host gets more than 2 requests at once and SIX's
// pages stay 2 s apart.
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { DatasetName } from "../../src/core/models";
import type { Engine } from "../../src/engine/engine";
import type { HttpRequest } from "../../src/engine/http/transport";
import { demoOptions, demoRun } from "../pretend/demo";
import { MemoryStorage } from "../pretend/memory";
import { NetworkProfile, type SyncTimings } from "../pretend/network";
import { type Harness, startEngine } from "./harness";

const REAL = "test/fixtures/real-timings.json";
const timings: SyncTimings = JSON.parse(readFileSync(existsSync(REAL) ? REAL : "test/fixtures/network/estimated-timings.json", "utf8"));

/** What Beranda needs for today's classes and the Tasks due: SIX's timetable and counts, Edunex's Tasks and Presence. */
const TODAY: DatasetName[] = ["six.schedule", "six.courses", "edunex.tasks", "edunex.presence"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const STEP = 50;

const engines: Engine[] = [];
afterEach(() => {
  for (const engine of engines.splice(0)) engine.stop();
});

/** Every request in flight, by host, and the most at once; SIX's starts. */
function watchRequests(world: { request(r: HttpRequest): Promise<unknown>; clock: { now(): number } }) {
  const inFlight = new Map<string, number>();
  const most = new Map<string, number>();
  const sixStarts: number[] = [];
  const request = world.request.bind(world);
  world.request = async (r: HttpRequest) => {
    const { host, pathname } = new URL(r.url);
    inFlight.set(host, (inFlight.get(host) ?? 0) + 1);
    most.set(host, Math.max(most.get(host) ?? 0, inFlight.get(host)!));
    if (host === "six.itb.ac.id" && !pathname.startsWith("/pub/")) sixStarts.push(world.clock.now());
    try {
      return await request(r);
    } finally {
      inFlight.set(host, inFlight.get(host)! - 1);
    }
  };
  return { most, sixStarts };
}

/** A Student signed in and read once, as the demo leaves them; the app closed; opened again a day later, every feed due. */
async function coldStart() {
  const run = demoRun(demoOptions({ EDUNEX_DEMO: "signed-in" }));
  const storage = new MemoryStorage();
  const first = await startEngine({ world: run.world, storage, start: false, startDueOnly: true });
  engines.push(first.engine);
  await run.prepare(first.engine);
  first.engine.stop();
  await run.world.clock.advance(25 * HOUR);
  run.world.setNetwork(new NetworkProfile(timings));
  const requests = watchRequests(run.world);
  const h = await startEngine({ world: run.world, storage, vault: first.vault, start: false, startDueOnly: true, quickRefresh: true });
  engines.push(h.engine);
  return { h, requests };
}

/** When each dataset is first stored at or after `from` (ms after it), while the clock runs for `forMs`. */
async function freshTimes(h: Harness, from: number, forMs: number, until?: () => boolean): Promise<Map<string, number>> {
  const fresh = new Map<string, number>();
  for (let t = 0; t <= forMs; t += STEP) {
    for (const dataset of h.engine.snapshot().datasets)
      if (!fresh.has(dataset.name) && dataset.fetchedAt >= from) fresh.set(dataset.name, h.world.clock.now() - from);
    if (until?.()) break;
    await h.world.clock.advance(STEP);
  }
  return fresh;
}

const report = (label: string, fresh: Map<string, number>) =>
  console.info(
    `[sync-speed] ${timings.kind} ${label}\n${[...fresh]
      .sort((a, b) => a[1] - b[1])
      .map(([name, ms]) => `  ${(ms / 1000).toFixed(1).padStart(5)} s  ${name}`)
      .join("\n")}`,
  );

describe(`a phone's start on a network as slow as the real one (${timings.kind})`, () => {
  it("shows the saved data before any answer comes back", async () => {
    const { h } = await coldStart();
    const saved = (name: DatasetName) => h.engine.snapshot().datasets.some((d) => d.name === name);
    expect(TODAY.every(saved)).toBe(true);
    // Answers from Edunex, SIX and ITB only: the alert relay isn't one of them.
    const school = () => h.world.log.filter((r) => /(itb\.ac\.id|cognisia\.id|goitb\.id)$/.test(new URL(r.url).host)).length;
    const asked = school();
    h.engine.start();
    await h.world.clock.advance(STEP);
    expect(school()).toBe(asked);
    expect(TODAY.every(saved)).toBe(true);
  });

  it("has today's classes and the Tasks due fresh from Edunex and SIX within 5 s", async () => {
    const { h, requests } = await coldStart();
    const start = h.world.clock.now();
    h.engine.start();
    const fresh = await freshTimes(h, start, 60_000);
    report("cold start", fresh);
    if (process.env.SYNC_SPEED_LOG)
      console.info(
        h.world.log
          .filter((r) => r.at >= start && r.at < start + 30_000)
          .map((r) => `${r.at - start} ${new URL(r.url).host} ${new URL(r.url).pathname.slice(0, 70)} ${r.status}`)
          .join("\n"),
      );
    expect(TODAY.filter((name) => !fresh.has(name))).toEqual([]);
    expect(Math.max(...TODAY.map((name) => fresh.get(name)!))).toBeLessThanOrEqual(5_000);
    // Kind to ITB's servers all the while.
    for (const [host, most] of requests.most) expect(most, host).toBeLessThanOrEqual(2);
    const gaps = requests.sixStarts.slice(1).map((at, i) => at - requests.sixStarts[i]!);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2_000);
  });

  it("finishes a pull to refresh within 15 s, everything fresh", async () => {
    const { h, requests } = await coldStart();
    h.engine.start();
    await freshTimes(h, h.world.clock.now(), 60_000);
    await h.world.clock.advance(5 * MINUTE);
    const start = h.world.clock.now();
    let done = false;
    void h.engine.refresh().then(() => (done = true));
    const fresh = await freshTimes(h, start, 60_000, () => done);
    const took = h.world.clock.now() - start;
    report(`pull to refresh, done in ${(took / 1000).toFixed(1)} s`, fresh);
    expect(took).toBeLessThanOrEqual(15_000);
    // Everything a feed fills was read within the last hour (but the catalog, read in the background for the planner,
    // and Tandai Hadir's button, read only while a class is on).
    const stale = h.engine
      .snapshot()
      .datasets.filter((d) => !/^(local|app)\./.test(d.name) && !["itb.catalog", "six.checkIn"].includes(d.name) && d.fetchedAt < h.world.clock.now() - HOUR)
      .map((d) => d.name);
    expect(stale).toEqual([]);
    for (const [host, most] of requests.most) expect(most, host).toBeLessThanOrEqual(2);
  });
});
