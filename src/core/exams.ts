// Exams in one place (#77, user story 74): SIX's exam sessions (time, room),
// Edunex's exams, Edunex's take-home UTS and UAS Tasks, exams named in the
// Edunex course outline, and ITB's exam weeks, merged per course and exam (one
// "DK4073 UTS" however many systems list it). None of them shows the others.
// Two sittings on different days disagree; a sitting in SIX and a take-home due
// a week later in Edunex are two parts, not a conflict. Pure: Tugas & Ujian,
// the exam page, the alerts and the calendar export read it.
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

/** A word right after the exam's that makes a Task about the exam rather than the exam itself: "UTS - Pembahasan", "UAS Latihan". */
const ABOUT_EXAM = /^[\s:([–-]*(pra|pre|kisi|latihan|pembahasan|review|remedial|persiapan|simulasi|contoh|practice|mock)\b/i;
/** An exam's word at the start of a title, perhaps after "Take-home": "UTS Markom", "Take-home UAS", "Midex DK4073". */
const NAMES_EXAM = /^[\s[({"'“‘]*(?:take[\s-]?home\s*[:–-]?\s*)?(UTS|UAS|Midex|Finex|Ujian\s+Tengah\s+Semester|Ujian\s+Akhir\s+Semester)\b/i;

/**
 * Why a Task is an exam's take-home, said where it's shown: Edunex files it
 * under UTS or UAS (`edunex`), or its name starts with the exam's word
 * (`name`, with the start as written: "UTS", "Take-home UAS", "Midex").
 */
export type TakeHome = { kind: "UTS" | "UAS" } & ({ by: "edunex" } | { by: "name"; start: string });

/**
 * The exam a Task is the take-home of: Edunex's own category first (the
 * lecturer picks UTS or UAS), else a title that names the exam. A Task whose
 * title only speaks of one ("Tugas Pra-UTS", "UTS - Pembahasan") is a Task;
 * one about a subject is the exam ("UAS Literature Review").
 */
export function takeHomeOf(task: Pick<Task, "kind" | "title">): TakeHome | null {
  if (task.kind === "uts") return { kind: "UTS", by: "edunex" };
  if (task.kind === "uas") return { kind: "UAS", by: "edunex" };
  const match = NAMES_EXAM.exec(task.title);
  if (!match || ABOUT_EXAM.test(task.title.slice(match[0].length))) return null;
  const kind = /^(UTS|Midex|Ujian\s+Tengah)/i.test(match[1]) ? "UTS" : "UAS";
  return { kind, by: "name", start: match[0].replace(/^[\s[({"'“‘]+/, "") };
}

export const takeHomeKind = (task: Pick<Task, "kind" | "title">): "UTS" | "UAS" | null => takeHomeOf(task)?.kind ?? null;

const HOUR = 3_600_000;
/** A deadline on one of these days: its own, or the day before for one just past midnight ("00:00" closes the day before). */
export const dueOn = (at: number, days: ReadonlySet<string>) => days.has(wibDay(at)) || days.has(wibDay(at - 3 * HOUR));

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
  /** SIX and Edunex both give a sitting, on no common day. */
  disagree: boolean;
  /** When SIX also lists a class sitting and a take-home is due on another day: that deadline (the soonest). Two parts, not a conflict. */
  takeHomeApart: number | null;
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
      exam = {
        id,
        courseCode: code,
        kind,
        six: [],
        edunex: [],
        tasks: [],
        inOutline: false,
        week: null,
        at: null,
        last: null,
        disagree: false,
        takeHomeApart: null,
      };
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
    const kind = takeHomeKind(task);
    if (kind) entry(`${task.courseCode}-${kind}`, task.courseCode, kind).tasks.push(task);
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
    const sittings = exam.edunex.flatMap((e) => (e.start !== null ? [e.start] : []));
    const dues = exam.tasks.flatMap((t) => (t.dueAt !== null ? [t.dueAt] : []));
    const times = [...exam.six.map((s) => s.start), ...sittings, ...dues];
    exam.at = times.length ? Math.min(...times) : null;
    exam.last = times.length ? Math.max(...[...exam.six.map((s) => s.end), ...sittings, ...dues]) : null;
    // A sitting is compared with sittings only: a take-home's deadline isn't the day of an exam.
    exam.disagree = sixDays.size > 0 && sittings.length > 0 && !sittings.some((t) => sixDays.has(wibDay(t)));
    exam.takeHomeApart = sixDays.size ? (dues.filter((t) => !dueOn(t, sixDays)).sort((a, b) => a - b)[0] ?? null) : null;
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
