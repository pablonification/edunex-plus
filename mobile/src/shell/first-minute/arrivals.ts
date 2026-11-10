// What the first read brings, one thing at a time (./scene.tsx): the Student's own courses, what's due and the classes
// ahead, by name, as each lands. The wait is the show: something real and new every second or so, never a bare bar.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormat, useNow } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";

export type ArrivalKind = "course" | "task" | "class" | "program";

export interface Arrival {
  key: string;
  kind: ArrivalKind;
  /** Its name, as the system writes it. */
  title: string;
  /** The one fact beside it: a course's code, a Task's due day, a class's day and time. */
  meta: string | null;
}

/** A new thing shows this often: long enough to read a name, short enough that the room never stands still. */
const EVERY_MS = 1_300;
/** With this many waiting, they come faster. */
const CROWD = 8;
const CROWD_MS = 800;
/** With this few left, they're spaced out, still under two seconds apart: the room keeps moving while SIX is read. */
const FEW = 3;
const FEW_MS = 1_900;
/** The most of each kind: the room is a taste of the read, Beranda has all of it. */
const MOST = { course: 8, task: 6, class: 4 } as const;

/** Two courses, a Task, a class, and again: mixed so no kind runs long. */
function mixed(courses: Arrival[], tasks: Arrival[], classes: Arrival[]): Arrival[] {
  const out: Arrival[] = [];
  const [c, t, k] = [[...courses], [...tasks], [...classes]];
  while (c.length || t.length || k.length) out.push(...c.splice(0, 2), ...t.splice(0, 1), ...k.splice(0, 1));
  return out;
}

/** Everything the read has brought so far that's worth a line, in the order the room shows it. */
function useFound(): Arrival[] {
  const f = useFormat();
  const now = useNow();
  const student = useDataset("six.student");
  const courses = useDataset("edunex.courses");
  const tasks = useDataset("edunex.tasks");
  const schedule = useDataset("six.schedule");
  return useMemo(() => {
    const courseLines: Arrival[] = (courses ?? []).slice(0, MOST.course).map((course) => ({
      key: `course:${course.code}`,
      kind: "course",
      title: course.name,
      meta: course.code,
    }));
    const taskLines: Arrival[] = (tasks ?? [])
      .filter((task) => task.dueAt !== null && task.dueAt > now)
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
      .slice(0, MOST.task)
      .map((task) => ({
        key: `task:${task.id}`,
        kind: "task",
        title: task.title,
        meta: task.dueAt === null ? null : `${f.weekdayShort(task.dueAt)} ${f.dayMonth(task.dueAt)}`,
      }));
    const classLines: Arrival[] = (schedule ?? [])
      .filter((session) => session.start > now)
      .sort((a, b) => a.start - b.start)
      .slice(0, MOST.class)
      .map((session) => ({
        key: `class:${session.id}`,
        kind: "class",
        title: session.courseName,
        meta: `${f.weekdayShort(session.start)} ${f.time(session.start)}`,
      }));
    const program: Arrival[] = student?.program ? [{ key: "program", kind: "program", title: student.program, meta: null }] : [];
    return [...mixed(courseLines, taskLines, classLines), ...program];
  }, [f, now, student, courses, tasks, schedule]);
}

/**
 * The things shown so far, oldest first, one more each beat while `running`. `onKind` hears the first of each kind
 * (the room marks it with a haptic).
 */
export function useArrivals(running: boolean, onKind: (kind: ArrivalKind) => void): Arrival[] {
  const found = useFound();
  const [shown, setShown] = useState<Arrival[]>([]);
  const latest = useRef({ found, shown, onKind });
  latest.current = { found, shown, onKind };
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const beat = () => {
      const { found: all, shown: sofar, onKind: heard } = latest.current;
      const seen = new Set(sofar.map((item) => item.key));
      const waiting = all.filter((item) => !seen.has(item.key));
      const next = waiting[0];
      if (next) {
        if (!sofar.some((item) => item.kind === next.kind)) heard(next.kind);
        setShown([...sofar, next]);
      }
      timer = setTimeout(beat, waiting.length > CROWD ? CROWD_MS : waiting.length <= FEW ? FEW_MS : EVERY_MS);
    };
    // The first one comes as the room opens, not a beat later.
    timer = setTimeout(beat, 350);
    return () => clearTimeout(timer);
  }, [running]);
  return shown;
}
