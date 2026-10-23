// Everything Beranda reasons from (./needs.ts), from the engine's datasets at
// a moment. The window (src/app/home-world.ts) and the tray menu
// (src/desktop/tray-menu.ts) both build it here, so the two never reason
// from different facts.
import { classResults, targetFor } from "./attendance";
import type { DatasetName, DatasetValue, Settings } from "./models";
import type { HomeWorld } from "./needs";
import type { Snapshot } from "./snapshot";
import { type TermCourseBase, termCourses, termOf } from "./term-courses";

type Value<N extends DatasetName> = DatasetValue<N> | undefined;

/** The datasets Beranda reads, as they are now (each missing until it has been read). */
export interface HomeFacts {
  now: number;
  term: string | undefined;
  courses: readonly Pick<TermCourseBase, "code" | "attendance" | "edunex">[] | undefined;
  tasks: Value<"edunex.tasks">;
  taskEdits: Value<"edunex.taskEdits">;
  presence: Value<"edunex.presence">;
  materials: Value<"edunex.materials">;
  announcements: Value<"edunex.announcements">;
  schedule: Value<"six.schedule">;
  scheduleMonths: Value<"six.scheduleMonths">;
  exams: Value<"edunex.exams">;
  examMarks: Value<"local.examMarks">;
  calendar: Value<"itb.calendar">;
  krs: Value<"six.krs">;
  bills: Value<"six.bills">;
  countLog: Value<"six.countLog">;
  savedResults: Value<"six.classResults">;
  /** When SIX's courses (and their counts) were read. */
  readAt: number;
  /** The same test as Presensi's: signed out of SIX, nothing reads as counting. */
  sixConnected: boolean;
  settings: Pick<Settings, "attendanceTarget" | "attendanceTargets" | "needsAhead">;
}

/** Once the term's courses are known. */
export function homeWorld(facts: HomeFacts): HomeWorld | undefined {
  const { now, courses, settings } = facts;
  if (!courses) return undefined;
  return {
    now,
    term: facts.term ?? null,
    courses: courses.map((course) => ({
      code: course.code,
      six: course.attendance,
      edunexId: course.edunex?.courseId ?? null,
      target: targetFor(settings, course.code),
    })),
    tasks: facts.tasks ?? [],
    presence: facts.presence ?? {},
    materials: facts.materials ?? {},
    announcements: facts.announcements ?? {},
    schedule: facts.schedule ?? null,
    scheduleMonths: facts.scheduleMonths,
    exams: facts.exams,
    examMarks: facts.examMarks,
    calendar: facts.calendar,
    krs: facts.krs,
    bills: facts.bills,
    sixConnected: facts.sixConnected,
    countLog: facts.countLog ?? {},
    // As Presensi judges them: the saved results, and what the latest count already says.
    classResults: classResults(facts.savedResults ?? {}, facts.countLog ?? {}, facts.schedule ?? [], now, facts.readAt),
    taskEdits: facts.taskEdits,
    needsAhead: settings.needsAhead,
  };
}

/** A dataset of the engine's snapshot, by name. */
export function snapshotDataset<N extends DatasetName>(snapshot: Pick<Snapshot, "datasets">, name: N): Value<N> {
  return snapshot.datasets.find((dataset) => dataset.name === name)?.value as Value<N>;
}

/** This term's courses from the engine's snapshot, as the window joins them. */
export function snapshotTermCourses(snapshot: Pick<Snapshot, "datasets">): TermCourseBase[] | undefined {
  const student = snapshotDataset(snapshot, "six.student");
  const six = snapshotDataset(snapshot, "six.courses");
  return termCourses({
    edunex: snapshotDataset(snapshot, "edunex.courses"),
    catalog: snapshotDataset(snapshot, "itb.catalog"),
    six: student && six ? { term: student.term, courses: six } : undefined,
  });
}

/** Beranda's world from the engine's snapshot, as the window builds it from the same datasets. */
export function snapshotHomeWorld(snapshot: Pick<Snapshot, "datasets" | "statuses" | "settings">, now: number): HomeWorld | undefined {
  const dataset = <N extends DatasetName>(name: N) => snapshotDataset(snapshot, name);
  const sixCourses = dataset("six.courses");
  const six = snapshot.statuses.find((status) => status.source === "six");
  return homeWorld({
    now,
    term: termOf(dataset("six.student"), dataset("edunex.courses")),
    courses: snapshotTermCourses(snapshot),
    tasks: dataset("edunex.tasks"),
    taskEdits: dataset("edunex.taskEdits"),
    presence: dataset("edunex.presence"),
    materials: dataset("edunex.materials"),
    announcements: dataset("edunex.announcements"),
    schedule: dataset("six.schedule"),
    scheduleMonths: dataset("six.scheduleMonths"),
    exams: dataset("edunex.exams"),
    examMarks: dataset("local.examMarks"),
    calendar: dataset("itb.calendar"),
    krs: dataset("six.krs"),
    bills: dataset("six.bills"),
    countLog: dataset("six.countLog"),
    savedResults: dataset("six.classResults"),
    readAt: snapshot.datasets.find((entry) => entry.name === "six.courses")?.fetchedAt ?? 0,
    sixConnected: (six?.state ?? "signed-out") !== "signed-out" || sixCourses !== undefined,
    settings: snapshot.settings,
  });
}
