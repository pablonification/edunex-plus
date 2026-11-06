// The phone opens the app many times a day: each start shows the saved data and reads only what's due
// (EngineDeps.startDueOnly), not every page of Edunex and SIX again. A background sync reads what's due too;
// "Perbarui sekarang" still reads everything.
import { afterEach, describe, expect, it } from "vitest";
import type { Engine } from "../../src/engine/engine";
import type { HttpRequest } from "../../src/engine/http/transport";
import { demoOptions, demoRun } from "../pretend/demo";
import { MemoryStorage } from "../pretend/memory";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { startEngine } from "./harness";

const engines: Engine[] = [];
afterEach(() => {
  for (const engine of engines.splice(0)) engine.stop();
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A Student signed in and fully read once, as the demo leaves them; then the app closed. */
async function readOnce(startDueOnly = true) {
  const run = demoRun(demoOptions({ EDUNEX_DEMO: "signed-in" }));
  const storage = new MemoryStorage();
  const first = await startEngine({ world: run.world, storage, start: false, startDueOnly });
  engines.push(first.engine);
  await run.prepare(first.engine);
  first.engine.stop();
  const paths: string[] = [];
  const request = run.world.request.bind(run.world);
  run.world.request = (r: HttpRequest) => {
    paths.push(new URL(r.url).pathname);
    return request(r);
  };
  /** Opens the app again after `ms`, and lets it run `forMs`. */
  const reopen = async (ms: number, forMs = MINUTE, due = startDueOnly) => {
    await run.world.clock.advance(ms);
    paths.length = 0;
    const next = await startEngine({ world: run.world, storage, vault: first.vault, start: false, startDueOnly: due });
    engines.push(next.engine);
    next.engine.start();
    for (let s = 0; s < forMs / 1000; s++) await run.world.clock.advance(1000);
    return next;
  };
  return { run, paths, reopen };
}

const read = (paths: string[], part: RegExp) => paths.filter((path) => part.test(path)).length;

describe("a phone's start", () => {
  it("five minutes after a full read: the sign-in checks, not Edunex's courses again nor SIX's daily records", async () => {
    const { paths, reopen } = await readOnce();
    await reopen(5 * MINUTE, 10_000);
    expect(read(paths, /\/login\/me$/)).toBeGreaterThan(0);
    // Edunex: who's signed in (and the notifications feed asking the same), nothing else.
    expect(paths.filter((path) => !path.startsWith("/app/") && path !== "/home").every((path) => /\/login\/me$|\/notifications\//.test(path))).toBe(true);
    expect(read(paths, /\/statusmhs$/)).toBe(1);
    expect(read(paths, /\/course\/contents\//)).toBe(0);
    expect(read(paths, /\/course\/tasks$/)).toBe(0);
    expect(read(paths, /transkrip|kurikulum|rencanastudi|keuangan/)).toBe(0);
    expect(read(paths, /\/pub\/kur/)).toBe(0);
  });

  it("a day later: what's due by now is read, once", async () => {
    const { paths, reopen } = await readOnce();
    await reopen(25 * HOUR);
    expect(read(paths, /\/course\/tasks$/)).toBeGreaterThan(0);
    expect(read(paths, /\/statusmhs\/transkrip\/historis/)).toBe(1);
    expect(read(paths, /\/keuangan$/)).toBe(1);
  });

  it("signing in to SIX again reads all of SIX afresh, however recent its last read", async () => {
    const { paths, reopen } = await readOnce();
    const { engine } = await reopen(10 * MINUTE);
    await engine.signOut("six");
    paths.length = 0;
    await engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
    expect(read(paths, /transkrip\/historis/)).toBe(1);
    expect(read(paths, /\/keuangan$/)).toBe(1);
  });

  it("the desktop's start (startDueOnly off) still reads everything", async () => {
    const { paths, reopen } = await readOnce(false);
    await reopen(10 * MINUTE, MINUTE, false);
    expect(read(paths, /\/course\/contents\//)).toBeGreaterThan(0);
    expect(read(paths, /transkrip/)).toBeGreaterThan(0);
  });
});

describe("reading again", () => {
  it("refreshDue reads only what's due; refresh reads every feed", async () => {
    const { paths, reopen } = await readOnce();
    const { engine } = await reopen(10 * MINUTE);
    paths.length = 0;
    await engine.refreshDue();
    expect(read(paths, /\/course\/contents\//)).toBe(0);
    expect(read(paths, /transkrip/)).toBe(0);
    paths.length = 0;
    await engine.refresh();
    expect(read(paths, /\/course\/contents\//)).toBeGreaterThan(0);
    expect(read(paths, /transkrip/)).toBeGreaterThan(0);
  });

  it("SIX's pages that change by the minute go before the daily ones", async () => {
    const { paths, reopen } = await readOnce();
    const { engine } = await reopen(10 * MINUTE);
    paths.length = 0;
    await engine.refresh("six");
    const six = paths.filter((path) => path.startsWith("/app/"));
    const status = six.findIndex((path) => /\/statusmhs$/.test(path));
    const transcript = six.findIndex((path) => /transkrip/.test(path));
    expect(status).toBeGreaterThanOrEqual(0);
    expect(status).toBeLessThan(transcript);
  });
});
