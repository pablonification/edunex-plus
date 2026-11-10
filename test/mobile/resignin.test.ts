// Signing back in by itself on the phone (mobile/src/host/resignin.ts): a session that ended while Microsoft's is
// still alive comes back out of sight, and the screens never hear it ended. Only a try that gives up shows it.
// Made-up sessions only (the pretend world's).
import { afterEach, describe, expect, it } from "vitest";
import { heldStatus, quietResignIn, RESIGN_EVERY_MS, RESIGN_LIMIT_MS, type ResignDeps, shouldResign } from "../../mobile/src/host/resignin";
import type { Event } from "../../src/core/contract";
import type { SourceStatus } from "../../src/core/models";
import { signInToBoth } from "../../src/desktop/signin-both";
import { AppLog } from "../../src/engine/app-log";
import { createEngine, type Engine } from "../../src/engine/engine";
import { type DemoOptions, demoOptions, demoRun } from "../pretend/demo";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PRETEND_SIX_COOKIE } from "../pretend/six";

const status = (source: SourceStatus["source"], state: SourceStatus["state"]): SourceStatus => ({ source, state, updatedAt: 1, detail: null });

describe("when to try", () => {
  it("only for a session that ended, with the app in front, once every ten minutes", () => {
    expect(shouldResign("expired", true, undefined, 0)).toBe(true);
    expect(shouldResign("expired", false, undefined, 0)).toBe(false);
    for (const state of ["live", "connecting", "offline", "changed", "signed-out", "action-needed", undefined] as const)
      expect(shouldResign(state, true, undefined, 0)).toBe(false);
    expect(shouldResign("expired", true, 0, RESIGN_EVERY_MS - 1)).toBe(false);
    expect(shouldResign("expired", true, 0, RESIGN_EVERY_MS)).toBe(true);
  });

  it("shows a held session as connecting, the rest as it was", () => {
    expect(heldStatus({ ...status("six", "expired"), updatedAt: 42 })).toEqual({ source: "six", state: "connecting", updatedAt: 42, detail: null });
  });
});

/** The resign-in with pretend parts: the engine's statuses set by hand, the try answered by the test. */
function rig(over: Partial<ResignDeps> = {}) {
  let now = 0;
  const engine = new Map<string, SourceStatus>();
  const shown: SourceStatus[] = [];
  const lines: string[] = [];
  const tries: { source: string; answer(ok: boolean): void }[] = [];
  const timers: { at: number; fn(): void; cancelled: boolean }[] = [];
  const resign = quietResignIn({
    now: () => now,
    inFront: () => true,
    status: (source) => engine.get(source),
    retry: (source) => new Promise((resolve) => tries.push({ source, answer: resolve })),
    show: (shownStatus) => shown.push(shownStatus),
    later: (ms, fn) => {
      const timer = { at: now + ms, fn, cancelled: false };
      timers.push(timer);
      return () => void (timer.cancelled = true);
    },
    log: (line) => lines.push(line),
    ...over,
  });
  /** The engine publishes a status. */
  const publish = (next: SourceStatus) => {
    engine.set(next.source, next);
    resign.saw(next);
  };
  const tick = async (ms: number) => {
    now += ms;
    for (const timer of timers) {
      if (timer.cancelled || timer.at > now) continue;
      timer.cancelled = true;
      timer.fn();
    }
    await Promise.resolve();
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { resign, publish, shown, lines, tries, tick, settle, states: () => shown.map((s) => `${s.source}=${s.state}`) };
}

describe("a session that ended", () => {
  it("is tried at once, the screens seeing it connecting, then live: never ended", async () => {
    const r = rig();
    r.publish(status("six", "live"));
    r.publish(status("six", "expired"));
    expect(r.tries.map((t) => t.source)).toEqual(["six"]);
    // The engine signs in with what the try read: connecting, then live.
    await r.tick(5_000);
    r.publish(status("six", "connecting"));
    r.tries[0]!.answer(true);
    r.publish(status("six", "live"));
    await r.settle();
    expect(r.states()).toEqual(["six=live", "six=connecting", "six=connecting", "six=live"]);
    expect(r.lines).toEqual(["[resignin] six trying", "[resignin] six ok in 5000ms"]);
  });

  it("shows the session ended once the try gives up (Microsoft wants the Student)", async () => {
    const r = rig();
    r.publish(status("edunex", "expired"));
    await r.tick(4_000);
    r.tries[0]!.answer(false);
    await r.settle();
    expect(r.states()).toEqual(["edunex=connecting", "edunex=expired"]);
    expect(r.lines.at(-1)).toBe("[resignin] edunex needs the Student in 4000ms");
  });

  it("tries again only after ten minutes, never in a loop", async () => {
    const r = rig();
    r.publish(status("six", "expired"));
    r.publish(status("six", "connecting"));
    // The new session ends at once (the wrong account, say): shown, not tried again.
    r.publish(status("six", "expired"));
    expect(r.tries).toHaveLength(1);
    expect(r.states().at(-1)).toBe("six=expired");
    await r.tick(RESIGN_EVERY_MS);
    r.resign.wake();
    expect(r.tries).toHaveLength(2);
    expect(r.states().at(-1)).toBe("six=connecting");
  });

  it("gives the screens the truth when a try takes too long", async () => {
    const r = rig();
    r.publish(status("six", "expired"));
    await r.tick(RESIGN_LIMIT_MS);
    expect(r.states()).toEqual(["six=connecting", "six=expired"]);
    // The try answering late changes nothing.
    r.tries[0]!.answer(false);
    await r.settle();
    expect(r.states()).toEqual(["six=connecting", "six=expired"]);
  });

  it("stops holding when the Student signs out meanwhile", () => {
    const r = rig();
    r.publish(status("six", "expired"));
    r.publish(status("six", "signed-out"));
    expect(r.states()).toEqual(["six=connecting", "six=signed-out"]);
    expect(r.lines.at(-1)).toBe("[resignin] six stopped, signed out");
  });

  it("waits for the app to be in front (the sign-in page needs the screens), and tries when it is", () => {
    let front = false;
    const r = rig({ inFront: () => front });
    r.publish(status("six", "expired"));
    expect(r.tries).toHaveLength(0);
    expect(r.states()).toEqual(["six=expired"]);
    front = true;
    r.resign.wake();
    expect(r.tries).toHaveLength(1);
    expect(r.states()).toEqual(["six=expired", "six=connecting"]);
  });

  it("leaves ITB and every other state alone, and holds the app's snapshot too", () => {
    const r = rig();
    r.publish(status("itb", "offline"));
    r.publish(status("edunex", "offline"));
    r.publish(status("six", "expired"));
    expect(r.resign.shown([status("edunex", "offline"), status("six", "expired")]).map((s) => s.state)).toEqual(["offline", "connecting"]);
    expect(r.tries).toHaveLength(1);
  });
});

describe("on the real engine, against the pretend SIX", () => {
  const engines: Engine[] = [];
  afterEach(() => {
    for (const engine of engines.splice(0)) engine.stop();
  });

  async function endSixSession(signIn?: DemoOptions["signIn"]) {
    const run = demoRun(demoOptions({ EDUNEX_DEMO: "edunex-only", ...(signIn ? { EDUNEX_DEMO_SIGN_IN: signIn } : {}) }));
    const sent: Event[] = [];
    const shown: string[] = [];
    let trying: Promise<boolean> = Promise.resolve(false);
    let both: ReturnType<typeof signInToBoth> | null = null;
    const resign = quietResignIn({
      now: () => run.world.clock.now(),
      inFront: () => true,
      status: (source) => engine.snapshot().statuses.find((s) => s.source === source),
      retry: (source) => (trying = both!.retry(source)),
      show: (s) => shown.push(`${s.source}=${s.state}`),
      later: () => () => undefined,
      log: () => undefined,
    });
    const engine = createEngine({
      transport: run.world,
      clock: run.world.clock,
      storage: new MemoryStorage(),
      vault: new MemoryVault(),
      version: "2.0.0-test",
      emit: (event) => (event.type === "status" ? resign.saw(event.status) : undefined),
      random: () => 0.5,
      log: new AppLog(() => run.world.clock.now()),
      relay: "",
      os: () => "test",
    });
    engines.push(engine);
    await engine.load();
    engine.start();
    await run.fastForward(engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    both = signInToBoth({
      engine,
      send: (event) => sent.push(event),
      windows: { open: (source, how) => run.signIn(source, how), stopQuiet: () => undefined, forget: async () => undefined },
    });
    shown.length = 0;
    // SIX's 30-day cookie runs out; the next read finds SIX's sign-in page.
    run.world.six.expireSession();
    await run.fastForward(engine.refresh("six"));
    const back = await run.fastForward(trying);
    const six = engine.snapshot().statuses.find((s) => s.source === "six")!;
    return { back, six, shown: shown.filter((line) => line.startsWith("six=")), sent };
  }

  it("signs SIX back in by itself: the screens see it connecting, never ended, and nothing is said", async () => {
    const { back, six, shown, sent } = await endSixSession();
    expect(back).toBe(true);
    expect(six.state).toBe("live");
    expect(shown).not.toContain("six=expired");
    expect(shown.at(-1)).toBe("six=live");
    // No "Menghubungkan SIX…", no "SIX tersambung".
    expect(sent.filter((event) => event.type === "signIn.joined" || (event.type === "signIn" && event.step))).toEqual([]);
  }, 60_000);

  it("shows the session ended when Microsoft wants the Student", async () => {
    const { back, six, shown } = await endSixSession("asks");
    expect(back).toBe(false);
    expect(six.state).toBe("expired");
    expect(shown).toEqual(["six=connecting", "six=expired"]);
  }, 60_000);
});
