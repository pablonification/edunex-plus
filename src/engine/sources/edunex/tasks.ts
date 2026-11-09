// Edunex Tasks: every Task of the term with the Student's answers (#72), and
// handing one in (#73, ./hand-in.ts). The Tasks come from each course's Task
// list (the parent class can hold Tasks too), after one quick call for the
// ones still open across every course (fetchOpen). Edunex's To Do feed is never
// read: it has no submit status, and its times are WIB wrongly marked as UTC.
// This feed only reads; nothing in the background ever writes.
import { z } from "zod";
import type { Course, Task, TaskModule } from "../../../core/models";
import { isEngineError } from "../../errors";
import type { FeedRead } from "../../report/kept-pages";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";
import { fetchCourses } from "./feeds";
import { type EdunexTask, fetchCourseTasks, fetchOpenTasks, storeTasks, toTask, writeLog } from "./task-records";

export { taskActions } from "./hand-in";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function registerTaskFeeds(context: SourceContext, client: EdunexClient): void {
  // Each run reads and stores through its own view of the two, so the report knows which run got what (FeedSpec.run).
  const noted = (read: FeedRead) => ({ context: context.for(read), client: client.for(read) });
  const outlines = new Map<number, Outline>();
  context.feed({
    name: "edunex.tasks",
    // What's due, on Beranda.
    priority: "now",
    every: 15 * MINUTE,
    jitter: 2 * MINUTE,
    async run(current, read) {
      const { context, client } = noted(read);
      const log = writeLog(context);
      const begun = log.count;
      const courses = await termCourses(context, client, current);
      if (!current()) return;
      // A Task the Student changed while this ran is already stored as Edunex read it back afterwards.
      const fresh = (tasks: Task[]) => {
        const latest = context.get("edunex.tasks") ?? [];
        return tasks.flatMap((task) => ((log.tasks.get(task.id) ?? 0) > begun ? latest.filter((kept) => kept.id === task.id) : [task]));
      };
      // What's open and coming first, in one call, over the saved list: Beranda has what's due in a second or two.
      // Never on the first read after sign-in: a part of the list would read as all of it.
      const saved = context.get("edunex.tasks");
      if (saved) {
        const open = await fetchOpen(client, courses, saved, context.clock.now());
        if (!current()) return;
        if (open) {
          // Over the list as it is now: a Task the Student handed in meanwhile is stored as read back.
          const latest = context.get("edunex.tasks") ?? saved;
          const merged = [...latest.filter((task) => !open.some((item) => item.id === task.id)), ...open];
          await storeTasks(context, fresh(withModules(merged, outlines, latest)));
          if (!current()) return;
        }
      }
      // Then every course's whole list, the truth: what closed, moved or was removed since, and what has no deadline.
      // Behind the other feeds' calls in the line: what Beranda shows is in already.
      const previous = context.get("edunex.tasks") ?? [];
      const fetched: Task[] = [];
      let failure: unknown = null;
      for (const course of courses) {
        for (const courseId of [course.edunex.courseId, ...course.edunex.relatedCourseIds]) {
          try {
            const items = await fetchCourseTasks(client, courseId, "behind");
            const now = context.clock.now();
            for (const item of items) {
              if (!fetched.some((task) => task.id === item.id)) fetched.push(toTask(item, { courseCode: course.code, courseId }, null, now));
            }
          } catch (error) {
            // No network, or the session ended: every course would fail the same way.
            if (!isEngineError(error) || error.kind === "Offline" || error.kind === "Unauthorized") throw error;
            // One course's list failing must not hide the others' new Tasks: keep what was known of it, and report.
            failure ??= error;
            fetched.push(...previous.filter((task) => task.courseId === courseId && !fetched.some((known) => known.id === task.id)));
          }
          if (!current()) return;
        }
      }
      // The whole list goes to Beranda now, its modules named as last known; the outlines that name them come after.
      const known = withModules(fetched, outlines, previous);
      await storeTasks(context, fresh(known));
      const named = await nameModules(client, known, outlines, previous, context.clock.now(), current);
      if (!current()) return;
      if (named.some((task, at) => task.module?.name !== known[at]!.module?.name || task.module?.index !== known[at]!.module?.index))
        await storeTasks(context, fresh(named));
      // The threads under the answers just read: one handed in, handed back or reviewed is read at once (./task-threads.ts).
      void context.runNow((feed) => feed === "edunex.taskThreads");
      if (failure) throw failure;
    },
  });
}

/** This term's courses; on the first sync after sign-in they're still on their way. */
async function termCourses(context: SourceContext, client: EdunexClient, current: () => boolean): Promise<Course[]> {
  if (!context.get("edunex.courses")) await context.runNow((feed) => feed === "edunex.courses");
  const courses = context.get("edunex.courses");
  if (courses || !current()) return courses ?? [];
  return fetchCourses(client);
}

/**
 * The term's open and coming Tasks, from one call for every course (fetchOpenTasks), each in its course as the
 * saved list has it, else as Edunex says. Null when that call didn't work: the whole lists come next anyway, so
 * only no network or an ended session stops the run here.
 */
async function fetchOpen(client: EdunexClient, courses: Course[], saved: Task[], now: number): Promise<Task[] | null> {
  const places = new Map<number, Course>();
  for (const course of courses) for (const courseId of [course.edunex.courseId, ...course.edunex.relatedCourseIds]) places.set(courseId, course);
  if (places.size === 0) return null;
  let items: EdunexTask[];
  try {
    items = await fetchOpenTasks(client, [...places.keys()], now - DAY);
  } catch (error) {
    if (!isEngineError(error) || error.kind === "Offline" || error.kind === "Unauthorized") throw error;
    return null;
  }
  const tasks: Task[] = [];
  for (const item of items) {
    const known = saved.find((task) => task.id === item.id);
    const courseId = known?.courseId ?? item.attributes.course_id;
    const course = courseId === undefined ? undefined : places.get(courseId);
    if (courseId === undefined || !course || tasks.some((task) => task.id === item.id)) continue;
    tasks.push(toTask(item, { courseCode: known?.courseCode ?? course.code, courseId }, null, now));
  }
  return tasks;
}

// ---------------------------------------------------------------- module names

interface Outline {
  at: number;
  modules: Map<number, TaskModule>;
}

/** The recorded call for a course page, which carries its modules (test/fixtures/edunex/course-courses-*.include-modules-…). */
const OUTLINE_INCLUDE = "modules,modules.activities,lecturer,lecturer.user,assistant,class";
const CourseOutline = z.object({
  included: z.array(z.object({ type: z.string(), id: z.union([z.number(), z.string()]), attributes: z.record(z.string(), z.unknown()) })).optional(),
});
const ModuleFields = z.object({ name: z.string(), index: z.number() });

/**
 * Names each Task's module ("Modul 5 · Tugas") from its course's outline:
 * fetched once per session, and again (at most hourly) when a Task sits in a
 * module the outline doesn't list. Best effort: a failed fetch keeps the
 * names already known, and the course page reports a broken outline.
 */
async function nameModules(
  client: EdunexClient,
  tasks: Task[],
  outlines: Map<number, Outline>,
  previous: Task[],
  now: number,
  current: () => boolean,
): Promise<Task[]> {
  const wanted = new Map<number, number[]>();
  for (const task of tasks) if (task.moduleId !== null) wanted.set(task.courseId, [...(wanted.get(task.courseId) ?? []), task.moduleId]);
  for (const [courseId, moduleIds] of wanted) {
    const known = outlines.get(courseId);
    if (known && (moduleIds.every((id) => known.modules.has(id)) || now - known.at < HOUR)) continue;
    try {
      outlines.set(courseId, { at: now, modules: await fetchOutline(client, courseId) });
    } catch (error) {
      // A nicety: without a network the other outlines won't come either.
      if (isEngineError(error, "Offline")) break;
    }
    if (!current()) return tasks;
  }
  return withModules(tasks, outlines, previous);
}

/** Each Task's module, from the outlines read, else as it was named before. */
function withModules(tasks: Task[], outlines: Map<number, Outline>, previous: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    module: (task.moduleId !== null && outlines.get(task.courseId)?.modules.get(task.moduleId)) || previous.find((p) => p.id === task.id)?.module || null,
  }));
}

async function fetchOutline(client: EdunexClient, courseId: number): Promise<Map<number, TaskModule>> {
  const doc = await client.get(`/course/courses/${courseId}`, { include: OUTLINE_INCLUDE }, CourseOutline);
  const modules = new Map<number, TaskModule>();
  for (const item of doc.included ?? []) {
    const fields = ModuleFields.safeParse(item.attributes);
    if (item.type === "modules" && fields.success) modules.set(Number(item.id), { index: fields.data.index, name: fields.data.name.trim() });
  }
  return modules;
}
