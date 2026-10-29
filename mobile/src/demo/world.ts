// The demo on the phone: the engine on the pretend Edunex, SIX and ITB the tests use
// (test/pretend), with the desktop demo's made-up student, on a clock that starts at the desktop
// demo's moment (Thursday 8 October 2026, 08:07 WIB) and then runs in real time. Nothing reaches
// a real system. Only demo builds carry this file (metro.config.js).
import type { Engine } from "../../../src/engine/engine";
import { PRETEND_TOKEN } from "../../../test/pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../../../test/pretend/six";
import { PretendWorld } from "../../../test/pretend/world";

export type DemoScenario = "signed-in" | "edunex-only" | "first-run";

const SCENARIO = (process.env.EXPO_PUBLIC_DEMO_SCENARIO ?? "signed-in") as DemoScenario;
const START = process.env.EXPO_PUBLIC_DEMO_NOW ?? (SCENARIO === "first-run" ? "2026-10-08T08:10:00+07:00" : "2026-10-08T08:07:00+07:00");

export async function createDemoWorld() {
  const world = new PretendWorld({ now: START });

  /** Lets the pretend clock run fast until `work` is done (scripts/demo/setup.ts's fastForward). */
  async function fastForward<T>(work: Promise<T>): Promise<T> {
    let outcome: { value: T } | { error: unknown } | null = null;
    void work.then(
      (value) => (outcome = { value }),
      (error: unknown) => (outcome = { error }),
    );
    const deadline = Date.now() + 30_000;
    for (let second = 0; !outcome && (second < 600 || Date.now() < deadline); second++) {
      await world.clock.advance(1_000);
      if (second >= 600) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!outcome) throw new Error("the demo's first sync didn't finish");
    const done = outcome as { value: T } | { error: unknown };
    if ("error" in done) throw done.error;
    return done.value;
  }

  /** From now on the pretend clock keeps pace with the real one. */
  function runInRealTime(): void {
    let last = Date.now();
    let busy = false;
    setInterval(() => {
      if (busy) return;
      busy = true;
      const now = Date.now();
      void world.clock.advance(now - last).finally(() => {
        last = now;
        busy = false;
      });
    }, 200);
  }

  return {
    transport: world,
    clock: world.clock,
    world,
    clockOffset: () => world.clock.now() - Date.now(),
    async prepare(engine: Engine): Promise<void> {
      await engine.updateSettings({ lang: "id" });
      if (SCENARIO === "first-run") {
        runInRealTime();
        return;
      }
      engine.start();
      await fastForward(engine.signIn("edunex", { token: PRETEND_TOKEN }));
      if (SCENARIO === "signed-in") await fastForward(engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
      // ITB's calendar, the public catalog's pages and the first alerts settle.
      await world.clock.advance(200_000);
      await engine.updateSettings({ firstScanDone: true });
      runInRealTime();
    },
  };
}
