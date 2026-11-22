// Usage data at the relay (relay/src/usage.ts, ADR 0016): the days the app sends, kept apart from the
// reports, read back by the maintainer only as totals.
import { describe, expect, it } from "vitest";
import type { UsageDay } from "../../src/core/usage";
import { UsageRelay } from "../src/usage";
import { MAINTAINER, MemoryStore } from "./fakes";

const NOW = Date.parse("2026-11-20T03:00:00Z");
const A = "0b5c4f4e-5d4f-4c2a-9f5e-0d6c1f3a2b11";
const B = "7e2a9c1d-3b4f-4e8a-8c2d-5f6a7b8c9d00";

function day(install: string, on: string, extra: Partial<UsageDay> = {}): UsageDay {
  return {
    usage: 1,
    install,
    day: on,
    version: "0.1.0-alpha.37",
    platform: "android",
    os: "Android 15",
    lang: "id",
    signedIn: { edunex: true, six: false },
    screens: { home: 4, tasks: 1 },
    actions: { "tasks.submit": 1 },
    reads: { "edunex.tasks.ok": 12 },
    errors: {},
    ...extra,
  };
}

function start(now = NOW) {
  const store = new MemoryStore();
  const relay = new UsageRelay({ store, now: () => now, maintainerToken: MAINTAINER, limits: { perAddress: 3 } });
  const send = (body: unknown, address = "203.0.113.7") =>
    relay.handle(new Request("https://relay.test/v1/usage", { method: "POST", body: JSON.stringify(body) }), address);
  const summary = async (query: string, token = MAINTAINER) => {
    const response = await relay.handle(new Request(`https://relay.test/v1/usage?${query}`, { headers: { authorization: `Bearer ${token}` } }), "");
    return { status: response.status, body: (await response.json()) as { days: Record<string, unknown>[] } };
  };
  return { store, relay, send, summary };
}

describe("a day the app sends", () => {
  it("is kept under the app's id and that day, without the address it came from", async () => {
    const { store, send } = start();
    expect((await send(day(A, "2026-11-19"))).status).toBe(202);
    expect(await store.get(`usage:day:2026-11-19:${A}`)).toMatchObject({ platform: "android", screens: { home: 4, tasks: 1 } });
    expect(await store.get(`usage:install:${A}`)).toEqual({ first: "2026-11-19", last: "2026-11-19" });
    expect(JSON.stringify([...store.data])).not.toContain("203.0.113.7");
  });

  it("is refused when it isn't one: a name that isn't the app's, a value, a day not over or too old", async () => {
    const { send } = start();
    expect((await send(day(A, "2026-11-19", { screens: { "Tugas Besar IF2211": 1 } }))).status).toBe(400);
    expect((await send(day(A, "2026-11-19", { screens: { constructor: 1 } }))).status).toBe(400);
    expect((await send({ ...day(A, "2026-11-19"), nim: "18223901" })).status).toBe(202); // unknown fields are dropped, not kept
    expect((await send(day(A, "2026-11-21"))).status).toBe(400);
    expect((await send(day(A, "2026-11-01"))).status).toBe(400);
    expect((await send(day("not-a-uuid", "2026-11-19"))).status).toBe(400);
    expect((await send({ ...day(A, "2026-11-19"), pad: "x".repeat(70_000) })).status).toBe(413);
  });

  it("is capped per address each day, so one sender can't fill the storage", async () => {
    const { send } = start();
    for (let i = 0; i < 3; i++) expect((await send(day(A, "2026-11-19"))).status).toBe(202);
    const slowed = await send(day(B, "2026-11-19"));
    expect(slowed.status).toBe(429);
    expect(Number(slowed.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await send(day(B, "2026-11-19"), "198.51.100.1")).status).toBe(202);
  });
});

describe("the maintainer's totals", () => {
  it("add up each day: apps, new ones, who came back, platforms, screens and how many apps used each", async () => {
    const { send, summary } = start();
    const C = "3c9d2e1f-4a5b-4c6d-8e7f-a0b1c2d3e4f5";
    await send(day(A, "2026-11-12"), "1");
    await send(day(C, "2026-11-12"), "5");
    await send(day(A, "2026-11-13"), "2");
    // A phone's sync in the background, nobody opening it: running, not active, and not back.
    await send(day(C, "2026-11-13", { screens: {}, actions: {} }), "6");
    await send(day(B, "2026-11-13", { platform: "windows", os: "Windows 11 (x64)", signedIn: { edunex: true, six: true }, screens: { home: 1 } }), "3");
    await send(day(A, "2026-11-19"), "4");

    const { status, body } = await summary("from=2026-11-12&to=2026-11-13");
    expect(status).toBe(200);
    expect(body.days[0]).toMatchObject({ day: "2026-11-12", active: 2, running: 2, new: 2, returned: { nextDay: 1, week: 1 } });
    expect(body.days[1]).toMatchObject({
      day: "2026-11-13",
      active: 2,
      running: 3,
      new: 1,
      platforms: { android: 2, windows: 1 },
      os: { "Android 15": 2, "Windows 11": 1 },
      signedIn: { edunex: 3, six: 1, both: 1, neither: 0 },
      screens: { home: 5, tasks: 1 },
      reach: { screens: { home: 2, tasks: 1 }, actions: { "tasks.submit": 2 } },
      // Seven days on is today, not over yet.
      returned: { nextDay: 0, week: null },
    });
  });

  it("are the maintainer's only, and a range has an end", async () => {
    const { summary } = start();
    expect((await summary("from=2026-11-12&to=2026-11-13", "someone-else-with-a-long-enough-token-000")).status).toBe(401);
    expect((await summary("from=2026-01-01&to=2026-11-13")).status).toBe(400);
    expect((await summary("from=2026-11-13&to=2026-11-12")).status).toBe(400);
  });
});

it("forgets days past the ones it keeps, and the caps of days before today", async () => {
  const { store, relay } = start();
  await store.put(`usage:day:2025-01-01:${A}`, {});
  await store.put(`usage:day:2026-11-19:${A}`, {});
  await store.put("usage:count:2026-11-18:all", 5);
  await store.put("usage:count:2026-11-19:all", 5);
  await store.put("usage:count:2026-11-20:all", 5);
  await relay.cron();
  expect([...store.data.keys()].sort()).toEqual(["usage:count:2026-11-20:all", `usage:day:2026-11-19:${A}`]);
});
