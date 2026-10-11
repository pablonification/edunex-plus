// The real engine with its alert center, against the pretend world, catching
// every OS notification it would show. Until the Tasks feed lands (#72), a
// small stand-in reads EduNex's Task lists into the shared "edunex.tasks"
// shape; once #72 registers its own "edunex.tasks" feed, drop the stand-in
// and use the real source.
import { z } from "zod";
import type { Task } from "../../src/core/models";
import { translate } from "../../src/core/strings";
import type { AlertNotice } from "../../src/engine/alerts/center";
import type { Detector } from "../../src/engine/alerts/detector";
import { DETECTORS } from "../../src/engine/alerts/detectors";
import { createEngine, type Engine } from "../../src/engine/engine";
import { edunex } from "../../src/engine/sources/edunex";
import { EdunexClient } from "../../src/engine/sources/edunex/client";
import { fetchCourses } from "../../src/engine/sources/edunex/feeds";
import type { EdunexSession } from "../../src/engine/sources/edunex/session";
import type { Source } from "../../src/engine/sources/source";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";

const TaskList = z.object({
  data: z.array(
    z.object({
      id: z.coerce.number(),
      attributes: z.object({
        name: z.string(),
        course_id: z.number(),
        start_at: z.string().nullable(),
        end_at: z.string().nullable(),
        open_status: z.string(),
        answers: z.array(z.object({ is_sent: z.number() })).default([]),
      }),
    }),
  ),
});

/** EduNex with a stand-in "edunex.tasks" feed (every 15 minutes, like the real one). */
export const edunexWithTasks: Source<EdunexSession> = {
  ...edunex,
  start(context, session) {
    edunex.start(context, session);
    const client = new EdunexClient(context.transport, session.token, context.userAgent);
    context.feed({
      name: "edunex.tasks",
      every: 15 * 60_000,
      jitter: 0,
      async run(current) {
        const courses = context.get("edunex.courses") ?? (await fetchCourses(client));
        const now = context.clock.now();
        const tasks: Task[] = [];
        for (const course of courses) {
          for (const courseId of [course.edunex.courseId, ...course.edunex.relatedCourseIds]) {
            const list = await client.get("/course/tasks", { "filter[course_id][is]": courseId }, TaskList);
            for (const { id, attributes: a } of list.data) {
              const dueAt = a.end_at ? Date.parse(a.end_at) : null;
              const sent = a.answers.some((answer) => answer.is_sent === 1);
              const status = sent ? "submitted" : a.open_status === "closed" ? "closed" : dueAt !== null && dueAt < now ? "overdue" : a.answers.length ? "draft" : "not_started";
              tasks.push({ id, courseCode: course.code, courseId, moduleId: null, title: a.name.trim(), status, opensAt: a.start_at ? Date.parse(a.start_at) : null, dueAt, score: null });
            }
          }
        }
        if (current()) await context.set("edunex.tasks", tasks);
      },
    });
  },
};

export interface Shown extends AlertNotice {
  /** When it was shown (fake clock). */
  shownAt: number;
  /** Its title and body as the Student reads them in Indonesian. */
  text: string;
}

export async function startAlerts(options: { world?: PretendWorld; storage?: MemoryStorage; vault?: MemoryVault; signIn?: boolean; detectors?: readonly Detector[] } = {}) {
  const world = options.world ?? new PretendWorld();
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const shown: Shown[] = [];
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: "2.0.0-test",
    emit: () => undefined,
    random: () => 0.5,
    sources: [edunexWithTasks],
    detectors: options.detectors ?? DETECTORS,
    alert: (notice) => {
      const text = [notice.title, notice.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — ");
      shown.push({ ...notice, shownAt: world.clock.now(), text });
    },
  });
  await engine.load();
  engine.start();
  if (options.signIn !== false) await engine.signIn("edunex", { token: PRETEND_TOKEN });
  return {
    world,
    engine,
    storage,
    vault,
    shown,
    history: () => engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { id: string; kind: string }[]; readAt: number } | undefined,
    wait: (ms: number) => world.clock.advance(ms),
    until: (iso: string) => world.clock.advanceTo(iso),
  };
}
