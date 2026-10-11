// The real engine with every source against the pretend world, signed in to
// EduNex and SIX, and Beranda's view of its datasets at the fake clock's
// moment: what src/app/screens/home.tsx passes to src/core/needs.ts.
import type { HomeWorld } from "../../src/core/needs";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import { startEngine } from "./harness";

export async function startHome(options: { now?: string; world?: PretendWorld } = {}) {
  const world = options.world ?? new PretendWorld({ now: options.now });
  const h = await startEngine({ world });
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  /** SIX is read at human pace: the clock runs until the work is done. */
  const meanwhile = async (work: Promise<unknown>) => {
    let done = false;
    const watched = work.finally(() => (done = true));
    for (let second = 0; second < 600 && !done; second++) {
      await new Promise((resolve) => setImmediate(resolve));
      if (!done) await world.clock.advance(1_000);
    }
    await watched;
  };
  await meanwhile(h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  const home = (): HomeWorld => {
    const six = h.dataset("six.courses") ?? [];
    const edunex = h.dataset("edunex.courses") ?? [];
    return {
      now: world.clock.now(),
      target: h.engine.snapshot().settings.attendanceTarget,
      term: h.dataset("six.student")?.term ?? null,
      courses: six.map((course) => ({ code: course.code, six: course.attendance, edunexId: edunex.find((e) => e.code === course.code)?.edunex.courseId ?? null })),
      tasks: h.dataset("edunex.tasks") ?? [],
      presence: h.dataset("edunex.presence") ?? {},
      materials: h.dataset("edunex.materials") ?? {},
      announcements: h.dataset("edunex.announcements") ?? {},
      schedule: h.dataset("six.schedule") ?? null,
      calendar: h.dataset("itb.calendar"),
    };
  };
  return {
    ...h,
    home,
    /** EduNex and SIX are read again now, as after the Student's refresh. */
    refresh: () => meanwhile(h.engine.refresh()),
    until: (iso: string) => world.clock.advanceTo(iso),
  };
}
