// The real engine after its first full sync of the pretend EduNex and SIX
// (and ITB's public pages), for quick search and the first-run scan: what the
// app has saved, by dataset name, exactly as the window's store holds it.
import type { Saved } from "../../src/core/saved";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { type Harness, startEngine } from "./harness";

/** Lets the fake clock run (SIX is read at human pace, a page every two seconds) until `work` is done. */
export async function until<T>(h: Harness, work: Promise<T>): Promise<T> {
  let outcome: { value: T } | { error: unknown } | null = null;
  void work.then(
    (value) => (outcome = { value }),
    (error: unknown) => (outcome = { error }),
  );
  for (let second = 0; second < 600 && !outcome; second++) await h.world.clock.advance(1_000);
  if (!outcome) throw new Error("still waiting after ten minutes");
  const done = outcome as { value: T } | { error: unknown };
  if ("error" in done) throw done.error;
  return done.value;
}

export const savedOf = (h: Harness): Saved => Object.fromEntries(h.engine.snapshot().datasets.map((d) => [d.name, d.value])) as Saved;

export interface FirstSyncOptions {
  now?: string;
  /** Also sign in to SIX (default true). */
  six?: boolean;
  /** Changes to the pretend world before anything is read. */
  before?: (h: Harness) => void;
}

/** Signs in to EduNex, then SIX, and lets ITB's calendar arrive. */
export async function firstSync(options: FirstSyncOptions = {}) {
  const h = await startEngine({ now: options.now });
  options.before?.(h);
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  if (options.six !== false) await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  await h.wait(5_000);
  return { ...h, saved: () => savedOf(h), statuses: () => h.engine.snapshot().statuses };
}
