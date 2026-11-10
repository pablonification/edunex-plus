// The demo's states (mobile/src/demo/states.ts) with the real engine: after the first read, each option leaves each
// system in the state its row of mobile/qa/superapp-states.md pictures (what the banners and screens read).
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAfterFirstRead, applyBeforeFirstRead, demoStates } from "../../mobile/src/demo/states";
import type { Engine } from "../../src/engine/engine";
import { startEngine } from "../engine/harness";
import { demoOptions, demoRun } from "../pretend/demo";
import { MemoryStorage } from "../pretend/memory";

const engines: Engine[] = [];
const intervals: ReturnType<typeof setInterval>[] = [];
const realSetInterval = globalThis.setInterval;
afterEach(() => {
  for (const engine of engines.splice(0)) engine.stop();
  for (const interval of intervals.splice(0)) clearInterval(interval);
  vi.restoreAllMocks();
});

/** The demo started with `asked`, read once, then each state applied and read again, as the phone's demo does. */
async function started(asked: Record<string, string>) {
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void, ms?: number) => {
    const interval = realSetInterval(fn, ms);
    intervals.push(interval);
    return interval;
  }) as typeof setInterval);
  const states = demoStates(asked);
  if (states.ended && !asked.EDUNEX_DEMO_SIGN_IN) asked.EDUNEX_DEMO_SIGN_IN = "asks";
  const run = demoRun(demoOptions({ EDUNEX_DEMO: "signed-in", ...asked }));
  applyBeforeFirstRead(run.world, states);
  const { engine } = await startEngine({ world: run.world, storage: new MemoryStorage(), start: false });
  engines.push(engine);
  await run.prepare(engine);
  const reads: Promise<void>[] = [];
  applyAfterFirstRead(run.world, states, (source) => reads.push(engine.refresh(source).catch(() => undefined)));
  await run.fastForward(Promise.all(reads));
  const state = (source: string) => engine.snapshot().statuses.find((s) => s.source === source)?.state;
  return { edunex: state("edunex"), six: state("six") };
}

describe("the demo's states with the real engine", () => {
  it("normal: both read", async () => {
    expect(await started({})).toEqual({ edunex: "live", six: "live" });
  }, 60_000);

  it("offline: both say no connection", async () => {
    expect(await started({ EDUNEX_DEMO_OFFLINE: "1" })).toEqual({ edunex: "offline", six: "offline" });
  }, 60_000);

  it("a server error on Edunex: Edunex isn't read, SIX is", async () => {
    const states = await started({ EDUNEX_DEMO_FAIL: "edunex" });
    expect(states.edunex).not.toBe("live");
    expect(states.edunex).not.toBe("signed-out");
    expect(states.six).toBe("live");
  }, 60_000);

  it("SIX's session ended: SIX asks to sign in again, Edunex is read", async () => {
    expect(await started({ EDUNEX_DEMO_ENDED: "six" })).toEqual({ edunex: "live", six: "expired" });
  }, 60_000);
});
