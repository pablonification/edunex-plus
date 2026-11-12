// Signing in to both systems on one Microsoft sign-in (src/desktop/signin-both.ts): the other system's own quiet try is
// kept as soon as the first one is in (it answered whose session this is), not once the first one's whole first read is
// done. On a phone on mobile data that read takes half a minute, and SIX, signed in two seconds after Edunex, sat
// waiting for it: its door never lit before the app opened.
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/core/snapshot";
import { type SignInSource, type SignInWindows, signInToBoth } from "../../src/desktop/signin-both";

type State = "signed-out" | "connecting" | "live" | "expired";

/** An engine that signs in when told and finishes a system's first read only when the test says so. */
function fakeEngine() {
  const states: Record<SignInSource, State> = { edunex: "signed-out", six: "signed-out" };
  const calls: SignInSource[] = [];
  const reads = new Map<SignInSource, { finish(): void; fail(error: Error): void }>();
  const accepts = new Map<SignInSource, () => void>();
  return {
    calls,
    states,
    /** The system answered whose session this is. */
    accept(source: SignInSource) {
      accepts.get(source)?.();
    },
    finishRead(source: SignInSource) {
      states[source] = "live";
      reads.get(source)?.finish();
    },
    failRead(source: SignInSource) {
      states[source] = "expired";
      reads.get(source)?.fail(new Error("refused"));
    },
    engine: {
      snapshot: () =>
        ({
          statuses: (["edunex", "six"] as const).map((source) => ({ source, state: states[source], updatedAt: null, detail: null })),
          datasets: [],
          settings: { firstScanDone: false },
        }) as unknown as Snapshot,
      signIn(source: "edunex" | "six" | "itb", _session: unknown, accepted?: () => void) {
        const id = source as SignInSource;
        calls.push(id);
        states[id] = "connecting";
        if (accepted) accepts.set(id, accepted);
        return new Promise<void>((finish, fail) => reads.set(id, { finish, fail }));
      },
    },
  };
}

/** Sign-in windows that hand back a session at once, for both systems. */
const windows: SignInWindows = {
  open: async (source) => (source === "edunex" ? "token" : "khongguan=abc"),
  stopQuiet: () => undefined,
  forget: async () => undefined,
};

/** Lets every promise that can settle, settle. */
const settled = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

describe("signing in to Edunex and SIX on one Microsoft sign-in", () => {
  it("SIX is kept as soon as Edunex is in, while Edunex's first read still runs", async () => {
    const fake = fakeEngine();
    const both = signInToBoth({ engine: fake.engine, send: () => undefined, windows });
    void both.signIn("edunex");
    await settled();
    // Edunex's session is with the engine; SIX's page is done too, but Edunex hasn't answered who this is yet.
    expect(fake.calls).toEqual(["edunex"]);
    fake.accept("edunex");
    await settled();
    // In: SIX's session goes to the engine now, with Edunex's read still unfinished.
    expect(fake.calls).toEqual(["edunex", "six"]);
    expect(fake.states.edunex).toBe("connecting");
  });

  it("nothing SIX's try found is kept when Edunex's sign-in fails before it's in", async () => {
    const fake = fakeEngine();
    const both = signInToBoth({ engine: fake.engine, send: () => undefined, windows });
    const signing = both.signIn("edunex").catch(() => false);
    await settled();
    fake.failRead("edunex");
    await signing;
    await settled();
    expect(fake.calls).toEqual(["edunex"]);
  });

  it("an engine that never says a system is in: SIX waits for Edunex's whole read, as before", async () => {
    const fake = fakeEngine();
    const quiet = { ...fake.engine, signIn: (source: "edunex" | "six" | "itb", session: unknown) => fake.engine.signIn(source, session) };
    const both = signInToBoth({ engine: quiet, send: () => undefined, windows });
    void both.signIn("edunex");
    await settled();
    expect(fake.calls).toEqual(["edunex"]);
    fake.finishRead("edunex");
    await settled();
    expect(fake.calls).toEqual(["edunex", "six"]);
  });
});
