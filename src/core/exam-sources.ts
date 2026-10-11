// The exams the app knows of, read from the raw sources merged so far:
// SIX's timetable sessions whose activity is UTS or UAS (time and room),
// EduNex's exams per course and its take-home UTS Tasks, and a UTS or UAS
// module in a course's EduNex outline, dated by ITB's exam week when no
// system dates that exam. Quick search and the first-run scan read exams only
// through here, so both move to the shared exam list (exams in one place) by
// changing this one file.
import type { AcademicCalendar, CalendarEvent, ClassSession, CourseModule, EdunexExam, Task } from "./models";
import type { Route } from "./route";
import { inTerm, type Saved, termCourses } from "./saved";

export type ExamKind = "UTS" | "UAS";

interface ExamBase {
  /** Unique: "six:2179909", "edunex:31", "task:117764", "outline:473251". */
  key: string;
  code: string;
  /** UTS or UAS when the source says which. */
  kind: ExamKind | null;
  /** When it starts or is due (ms); null when nothing dates it. */
  at: number | null;
  /** When it's over (ms); null when unknown. */
  until: number | null;
}

export type FoundExam = ExamBase &
  (
    | { source: "six"; session: ClassSession }
    | { source: "edunex"; exam: EdunexExam }
    | { source: "task"; task: Task }
    /** `week`: ITB's UTS or UAS week for the term, when the calendar has it. */
    | { source: "outline"; module: CourseModule; week: CalendarEvent | null }
  );

/** UTS or UAS, as SIX, EduNex or a lecturer names it ("Midex/UTS", "Ujian Akhir Semester"). */
export function examKind(text: string): ExamKind | null {
  if (/\bUTS\b|ujian tengah semester|\bmid-?term\b/i.test(text)) return "UTS";
  if (/\bUAS\b|ujian akhir semester|\bfinal exam\b/i.test(text)) return "UAS";
  return null;
}

/** ITB's UTS or UAS week of a term; else the next one still to come that the calendar ties to no term. */
export function examWeek(calendar: AcademicCalendar | undefined, kind: ExamKind, term: string | null, now: number): CalendarEvent | null {
  const weeks = (calendar?.events ?? []).filter((event) => event.kind === kind.toLowerCase());
  const ofTerm = term ? weeks.find((event) => event.term === term) : undefined;
  if (ofTerm) return ofTerm;
  return weeks.filter((event) => (term === null || event.term === null) && event.end > now).sort((a, b) => a.start - b.start)[0] ?? null;
}

/** Every exam of this term's courses, past ones too, the soonest first and the undated last. */
export function examsFound(saved: Saved, now: number): FoundExam[] {
  const known = inTerm(termCourses(saved));
  const found: FoundExam[] = [];
  /** "code|UTS": exams some system dates. An outline's exam module only stands in for a missing one. */
  const dated = new Set<string>();

  for (const session of saved["six.schedule"] ?? []) {
    const kind = examKind(session.activity);
    if (!kind || !known(session.courseCode)) continue;
    dated.add(`${session.courseCode}|${kind}`);
    found.push({ source: "six", key: `six:${session.id}`, code: session.courseCode, kind, at: session.start, until: session.end, session });
  }
  for (const [code, exams] of Object.entries(saved["edunex.exams"] ?? {})) {
    if (!known(code)) continue;
    for (const exam of exams) {
      const kind = examKind(exam.title ?? "");
      if (kind) dated.add(`${code}|${kind}`);
      found.push({ source: "edunex", key: `edunex:${exam.id}`, code, kind, at: exam.start, until: exam.end ?? exam.start, exam });
    }
  }
  for (const task of saved["edunex.tasks"] ?? []) {
    if (task.kind !== "uts" || !known(task.courseCode)) continue;
    dated.add(`${task.courseCode}|UTS`);
    found.push({ source: "task", key: `task:${task.id}`, code: task.courseCode, kind: "UTS", at: task.dueAt, until: task.dueAt, task });
  }

  const term = saved["six.student"]?.term ?? saved["edunex.courses"]?.[0]?.term ?? null;
  for (const [code, outline] of Object.entries(saved["edunex.outline"] ?? {})) {
    if (!known(code)) continue;
    for (const kind of ["UTS", "UAS"] as const) {
      const module = outline.modules.find((m) => examKind(m.title) === kind);
      if (!module || dated.has(`${code}|${kind}`)) continue;
      const week = examWeek(saved["itb.calendar"], kind, term, now);
      found.push({ source: "outline", key: `outline:${module.id}`, code, kind, at: week?.start ?? null, until: week?.end ?? null, module, week });
    }
  }

  return found.sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER) || a.code.localeCompare(b.code));
}

/** Still ahead of the Student: not over yet (or not dated), and a take-home UTS not handed in. */
export function examAhead(exam: FoundExam, now: number): boolean {
  if (exam.source === "task" && exam.task.answer?.sent) return false;
  return exam.until === null || exam.until > now;
}

/** Where an exam shows today: its course's meetings (SIX), its course's Tasks and exams (EduNex), its Task, or its outline. */
export function examRoute(exam: FoundExam): Route {
  switch (exam.source) {
    case "six":
      return { screen: "course", code: exam.code, tab: "meetings" };
    case "edunex":
      return { screen: "course", code: exam.code, tab: "tasks" };
    case "task":
      return { screen: "task", taskId: exam.task.id };
    case "outline":
      return { screen: "course", code: exam.code, tab: "modules" };
  }
}
