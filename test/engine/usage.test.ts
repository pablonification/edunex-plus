// Usage data (ADR 0016) through the real engine, against the pretend SIX and the pretend relay:
// counted a day at a time, sent once that day is over, nothing personal in it, nothing at all once
// the Student turns it off, and a new id after signing out of everything.
import { describe, expect, it } from "vitest";
import { personalHits } from "../kit/privacy-rules";
import { PRETEND_RELAY } from "../pretend/relay";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { type Harness, startEngine } from "./harness";

const HOUR = 3_600_000;

/** Lets the fake clock run until `work` is done (SIX is read at human pace). */
async function until<T>(h: Harness, work: Promise<T>): Promise<T> {
  let done = false;
  const result = work.finally(() => {
    done = true;
  });
  for (let second = 0; second < 600 && !done; second++) await h.world.clock.advance(1_000);
  return result;
}

async function signedIn(options: { usage?: "windows" | "android" | undefined; relay?: string } = {}) {
  const h = await startEngine({ relay: options.relay ?? PRETEND_RELAY, ...("usage" in options ? { usage: options.usage } : { usage: "windows" }) });
  await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  return h;
}

/** Into the next day and past the next send. */
const nextDay = (h: Harness) => h.world.clock.advance(24 * HOUR);

describe("usage data", () => {
  it("sends each day once it's over: screens, actions, reads, errors, by name only", async () => {
    const h = await signedIn();
    h.engine.countUsage("screens", "home");
    h.engine.countUsage("screens", "home");
    h.engine.countUsage("actions", "schedule.export");
    // Not one of the app's names (a course's name, say): counted as "other", never sent as it is.
    h.engine.countUsage("screens", "Tugas Besar IF2211");
    h.log.add("error", "window", "TypeError: something about 13522001");
    expect(h.world.relay.usage).toEqual([]);

    await nextDay(h);
    expect(h.world.relay.usage).toHaveLength(1);
    const [day] = h.world.relay.usage;
    expect(day).toMatchObject({
      usage: 1,
      day: "2026-10-08",
      version: "2.0.0-test",
      platform: "windows",
      os: "macOS 15.3 (arm64)",
      lang: "id",
      signedIn: { edunex: false, six: true },
      screens: { home: 2, other: 1 },
      actions: { "schedule.export": 1 },
      errors: { window: 1 },
    });
    expect(Object.keys(day!.reads).some((name) => /^six\.[a-z.]+\.ok$/i.test(name))).toBe(true);
    // Nothing in it is the Student's: no NIM, no name, not the error's message.
    expect(personalHits(JSON.stringify(day))).toEqual([]);
    expect(JSON.stringify(day)).not.toContain("13522001");

    // The next day goes the day after, under the same id; the one sent isn't sent again.
    h.engine.countUsage("screens", "tasks");
    await nextDay(h);
    expect(h.world.relay.usage.map((one) => one.day)).toEqual(["2026-10-08", "2026-10-09"]);
    expect(h.world.relay.usage[1]!.install).toBe(day!.install);
  });

  it("waits while the relay can't be reached, and sends the days it kept once it can", async () => {
    const h = await signedIn();
    h.engine.countUsage("screens", "home");
    h.world.relay.answer = "offline";
    await nextDay(h);
    expect(h.world.relay.usage).toEqual([]);
    h.world.relay.answer = "ok";
    await h.world.clock.advance(4 * HOUR);
    expect(h.world.relay.usage.map((one) => one.day)).toEqual(["2026-10-08"]);
  });

  it("counts nothing and sends nothing once the Student turns it off, and forgets what it kept", async () => {
    const h = await signedIn();
    h.engine.countUsage("screens", "home");
    await h.world.clock.advance(60_000);
    expect(await h.storage.read("usage.json")).not.toBeNull();

    await h.engine.updateSettings({ usageData: false });
    expect(await h.storage.read("usage.json")).toBeNull();
    h.engine.countUsage("screens", "home");
    await nextDay(h);
    await nextDay(h);
    expect(h.world.relay.usage).toEqual([]);
    expect(await h.storage.read("usage.json")).toBeNull();
  });

  it("starts again under a new id after signing out of everything", async () => {
    const h = await signedIn();
    h.engine.countUsage("screens", "home");
    await nextDay(h);
    const before = h.world.relay.usage[0]!.install;

    await h.engine.signOut();
    h.engine.countUsage("screens", "home");
    await nextDay(h);
    expect(h.world.relay.usage).toHaveLength(2);
    expect(h.world.relay.usage[1]!.install).not.toBe(before);
    expect(h.world.relay.usage[1]!.signedIn).toEqual({ edunex: false, six: false });
  });

  it("isn't there in a build that doesn't count (development, the demo) or has no relay", async () => {
    for (const h of [await signedIn({ usage: undefined }), await signedIn({ relay: "" })]) {
      h.engine.countUsage("screens", "home");
      await nextDay(h);
      expect(h.world.relay.usage).toEqual([]);
      expect(await h.storage.read("usage.json")).toBeNull();
    }
  });
});
