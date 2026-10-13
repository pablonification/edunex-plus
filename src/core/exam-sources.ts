// The exams quick search and the first-run scan know of: the shared exam list
// (exams in one place, src/core/exams.ts) over what is saved, so the scan,
// search and Tugas & Ujian always count the same exams.
import { type Exam, mergeExams } from "./exams";
import type { Route } from "./route";
import { type Saved, termCourses } from "./saved";

/** When an exam is: the earliest date a system gives, else ITB's exam week for it. */
export const examTime = (exam: Exam): number | null => exam.at ?? exam.week?.start ?? null;

/** This term's exams, soonest first (undated ones last). */
export function examsFound(saved: Saved, now: number): Exam[] {
  return mergeExams({
    schedule: saved["six.schedule"],
    edunexExams: saved["edunex.exams"],
    tasks: saved["edunex.tasks"],
    outline: saved["edunex.outline"],
    calendar: saved["itb.calendar"],
    term: saved["six.student"]?.term ?? saved["edunex.courses"]?.[0]?.term ?? null,
    courses: termCourses(saved).map((course) => course.code),
    now,
  }).sort((a, b) => (examTime(a) ?? Number.MAX_SAFE_INTEGER) - (examTime(b) ?? Number.MAX_SAFE_INTEGER) || a.courseCode.localeCompare(b.courseCode));
}

/**
 * Still ahead of the Student while some part of it is: a SIX sitting not over
 * yet, an Edunex exam not over, a take-home not handed in and not past due.
 * An exam no system dates is ahead until ITB's exam week for it is over.
 */
export function examAhead(exam: Exam, now: number): boolean {
  const dated = exam.six.length + exam.edunex.length + exam.tasks.length > 0;
  if (!dated) return exam.week === null || exam.week.end > now;
  return (
    exam.six.some((session) => session.end > now) ||
    exam.edunex.some((e) => (e.end ?? e.start ?? Number.MAX_SAFE_INTEGER) > now) ||
    exam.tasks.some((task) => !task.answer?.sent && (task.dueAt === null || task.dueAt > now))
  );
}

/** Only a take-home exam (an Edunex Task), with no sitting in SIX or Edunex. */
export const takeHomeOnly = (exam: Exam) => exam.six.length === 0 && exam.edunex.length === 0 && exam.tasks.length > 0;

export function examRoute(exam: Exam): Route {
  return { screen: "exam", examId: exam.id };
}
