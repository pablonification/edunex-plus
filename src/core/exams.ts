// Exams in one place (#77, user story 74): SIX's exam sessions (time, room),
// Edunex's exams, Edunex's take-home UTS Tasks, exams named in the Edunex
// course outline, and ITB's exam weeks, merged per course and exam (one
// "DK4073 UTS" however many systems list it). None of them shows the others,
// and they sometimes disagree: a UTS in class in SIX and a take-home UTS due
// a week later in Edunex. Pure: Tugas & Ujian, the exam page, the alerts and
// the calendar export read it.
import { isExamActivity } from "./attendance";
import { wibDay } from "./course-meetings";
import type { AcademicCalendar, CalendarEvent, ClassSession, CourseOutline, EdunexExam, Task } from "./models";

/** UTS and UAS keep ITB's words; quizzes and other exams are told apart from them. */
export type ExamKind = "UTS" | "UAS" | "KUIS" | "UJIAN";

const KIND_ORDER: Record<ExamKind, number> = { KUIS: 0, UTS: 1, UJIAN: 2, UAS: 3 };

/** The exam a name speaks of, or null when it isn't one. */
export function examKind(text: string | null): ExamKind | null {
  if (!text) return null;
  const match = /\b(UTS|UAS|Midex|Finex|Kuis|Quiz|Ujian|Exam)\b/i.exec(text)?.[1]?.toUpperCase();
  if (!match) return null;
  if (match === "MIDEX") return "UTS";
  if (match === "FINEX") return "UAS";
  if (match === "QUIZ" || match === "KUIS") return "KUIS";
  if (match === "UTS" || match === "UAS") return match;
  return "UJIAN";
}

export interface Exam {
  /** The route's examId: "DK4073-UTS"; a quiz or another exam carries its first item's id ("PL3002-KUIS-s2194370"). */
  id: string;
  courseCode: string;
  kind: ExamKind;
  /** SIX's exam sessions: the official time and room. */
  six: ClassSession[];
  /** Edunex exams of the course of this kind. */
  edunex: EdunexExam[];
  /** Take-home exams handed in as Edunex Tasks. */
  tasks: Task[];
  /** The course outline has a module for it (no date there). */
  inOutline: boolean;
  /** ITB's exam week of that kind for the term (UTS, UAS). */
  week: CalendarEvent | null;
  /** The earliest date any system gives (ms); null when none does yet. */
  at: number | null;
  /** The latest date any system gives: past it, the exam is behind the Student. */
  last: number | null;
  /** SIX and Edunex both give dates, on no common day. */
  disagree: boolean;
}

export interface ExamSources {
  schedule?: readonly ClassSession[];
  /** Edunex exams by course code. */
  edunexExams?: Record<string, readonly EdunexExam[]>;
  tasks?: readonly Task[];
  /** Edunex course outlines by course code. */
  outline?: Record<string, CourseOutline>;
  calendar?: AcademicCalendar;
  /** SIX's term code ("2026-1"); without it the coming exam week is used. */
  term?: string | null;
  /** This term's course codes: Edunex items of other courses are left out. Unset: all. */
  courses?: readonly string[];
  now: number;
}

/** A course has one UTS and one UAS; quizzes and other exams come many to a course, each its own. */
const oneEach = (kind: ExamKind) => kind === "UTS" || kind === "UAS";

/** ITB's exam week of a kind for the term, else the next one still to end. */
export function examWeek(calendar: AcademicCalendar | undefined, kind: ExamKind, term: string | null | undefined, now: number): CalendarEvent | null {
  if (kind !== "UTS" && kind !== "UAS") return null;
  const weeks = (calendar?.events ?? []).filter((e) => e.kind === kind.toLowerCase());
  return (term ? weeks.find((e) => e.term === term) : undefined) ?? weeks.filter((e) => e.end > now).sort((a, b) => a.start - b.start)[0] ?? null;
}

/**
 * Every exam of the term, dated ones first by date, then the rest in exam
 * order. UTS and UAS are one per course, whatever lists them. Quizzes and
 * other exams stay apart: SIX's sessions of a kind on a day are one, and an
 * Edunex exam of that kind on that day joins them; any other is its own.
 */
export function mergeExams(sources: ExamSources): Exam[] {
  const exams = new Map<string, Exam>();
  /** SIX's quizzes and other exams by course, kind and WIB day. */
  const sixDays = new Map<string, Exam>();
  const keep = (code: string) => !sources.courses || sources.courses.includes(code);
  const entry = (id: string, code: string, kind: ExamKind) => {
    let exam = exams.get(id);
    if (!exam) {
      exam = { id, courseCode: code, kind, six: [], edunex: [], tasks: [], inOutline: false, week: null, at: null, last: null, disagree: false };
      exams.set(id, exam);
    }
    return exam;
  };
  const dayOf = (code: string, kind: ExamKind, at: number) => `${code}|${kind}|${wibDay(at)}`;

  for (const session of [...(sources.schedule ?? [])].sort((a, b) => a.start - b.start)) {
    if (!isExamActivity(session.activity)) continue;
    const code = session.courseCode;
    const kind = examKind(session.activity) ?? "UJIAN";
    if (oneEach(kind)) {
      entry(`${code}-${kind}`, code, kind).six.push(session);
      continue;
    }
    const day = dayOf(code, kind, session.start);
    const exam = sixDays.get(day) ?? entry(`${code}-${kind}-s${session.id}`, code, kind);
    sixDays.set(day, exam);
    exam.six.push(session);
  }
  for (const [code, list] of Object.entries(sources.edunexExams ?? {})) {
    if (!keep(code)) continue;
    for (const item of list) {
      const kind = examKind(item.title) ?? "UJIAN";
      const twin = !oneEach(kind) && item.start !== null ? sixDays.get(dayOf(code, kind, item.start)) : undefined;
      const exam = oneEach(kind) ? entry(`${code}-${kind}`, code, kind) : twin && !twin.edunex.length ? twin : entry(`${code}-${kind}-e${item.id}`, code, kind);
      exam.edunex.push(item);
    }
  }
  for (const task of sources.tasks ?? []) {
    if (!keep(task.courseCode)) continue;
    const kind = task.kind === "uts" ? "UTS" : examKind(task.title);
    if (kind === "UTS" || kind === "UAS") entry(`${task.courseCode}-${kind}`, task.courseCode, kind).tasks.push(task);
  }
  for (const [code, outline] of Object.entries(sources.outline ?? {})) {
    if (!keep(code)) continue;
    for (const module of outline.modules) {
      const kind = examKind(module.title);
      if (kind === "UTS" || kind === "UAS") entry(`${code}-${kind}`, code, kind).inOutline = true;
    }
  }

  for (const exam of exams.values()) {
    exam.six.sort((a, b) => a.start - b.start);
    exam.week = examWeek(sources.calendar, exam.kind, sources.term, sources.now);
    const sixDays = new Set(exam.six.map((s) => wibDay(s.start)));
    const edunexTimes = [...exam.edunex.flatMap((e) => (e.start !== null ? [e.start] : [])), ...exam.tasks.flatMap((t) => (t.dueAt !== null ? [t.dueAt] : []))];
    const times = [...exam.six.map((s) => s.start), ...edunexTimes];
    exam.at = times.length ? Math.min(...times) : null;
    exam.last = times.length ? Math.max(...[...exam.six.map((s) => s.end), ...edunexTimes]) : null;
    exam.disagree = sixDays.size > 0 && edunexTimes.length > 0 && !edunexTimes.some((t) => sixDays.has(wibDay(t)));
  }
  return [...exams.values()].sort(
    (a, b) =>
      (a.at ?? Number.POSITIVE_INFINITY) - (b.at ?? Number.POSITIVE_INFINITY) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.courseCode.localeCompare(b.courseCode),
  );
}

/** Behind the Student: every date it has passed. Undated exams are still to come. */
export const examPassed = (exam: Exam, now: number) => exam.last !== null && exam.last < now;
