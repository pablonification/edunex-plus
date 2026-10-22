// Exams in one place (#77, user story 74): SIX's exam sessions (time, room),
// Edunex's exams, Edunex's take-home UTS and UAS Tasks, exams named in the
// Edunex course outline, and ITB's exam weeks, merged per course and exam (one
// "DK4073 UTS" however many systems list it). None of them shows the others.
// Two sittings on different days disagree; a sitting in SIX and a take-home due
// a week later in Edunex are two parts, not a conflict. Pure: Tugas & Ujian,
// the exam page, the alerts and the calendar export read it.
import { isExamActivity } from "./attendance";
import { wibDay } from "./course-meetings";
import type { AcademicCalendar, CalendarEvent, ClassSession, CourseOutline, EdunexExam, ExamMark, Task, TaskStatus } from "./models";
import { isOpenStatus, taskStatus } from "./tasks";

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
const DAY = 24 * HOUR;
/** An Edunex exam open longer than this runs out when it closes, like a deadline; a shorter one is sat at its start. */
export const WINDOW_AS_DEADLINE = 24 * HOUR;
/** An exam week this close is worth looking ahead to: Beranda's line under the greeting, the period line opening in Tugas & Ujian. */
export const PERIOD_NEAR = 14 * DAY;
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

// ---------------------------------------------------------------- what's still ahead

/** When an Edunex exam is over: its end, else the end of its WIB day when Edunex gives only a start. */
function edunexEnd(exam: Pick<EdunexExam, "start" | "end">): number {
  if (exam.end !== null) return exam.end;
  return Date.parse(`${wibDay(exam.start ?? 0)}T00:00:00+07:00`) + DAY;
}

/** An Edunex exam open longer than a day (a quiz open for a week): it runs out when it closes. */
export const isExamWindow = (exam: Pick<EdunexExam, "start" | "end">): boolean =>
  exam.start !== null && exam.end !== null && exam.end - exam.start > WINDOW_AS_DEADLINE;

/** What a "Mark as done" is kept by: Edunex's own exam id, and the window it had then. */
export const examMarkKey = (exam: Pick<EdunexExam, "id" | "start" | "end">) => ({
  id: `edunex-exam:${exam.id}`,
  facts: `${exam.start ?? ""}|${exam.end ?? ""}`,
});

/** The Student's mark on this window, while the window is the one they marked. */
export function examMarkOn(exam: Pick<EdunexExam, "id" | "start" | "end">, marks: readonly ExamMark[]): ExamMark | undefined {
  const key = examMarkKey(exam);
  return marks.find((mark) => mark.id === key.id && mark.facts === key.facts);
}

/** Marks a month after their window closed are let go (a window Edunex moved since keeps its mark until then too). */
export function pruneExamMarks(marks: readonly ExamMark[], now: number): ExamMark[] {
  return marks.filter((mark) => {
    const end = Number(mark.facts.split("|")[1]);
    return !Number.isFinite(end) || end === 0 || end > now - 30 * DAY;
  });
}

/**
 * A part of an exam still ahead of the Student, at the moment it runs out:
 * a sitting (SIX's session, or an Edunex exam open a day or less) at its
 * start; an Edunex window open longer than a day at its close; a take-home
 * still to hand in (late but still taken included) at its deadline.
 */
export type ExamPart =
  | { kind: "sitting"; id: string; at: number; end: number | null; source: "six" | "edunex"; room: string | null; title: string | null }
  | {
      kind: "window";
      id: string;
      at: number;
      /** null when Edunex gives only its close: then it's taken as open, with no way to mark it (its length isn't known). */
      opensAt: number | null;
      /** Edunex takes it now. */
      open: boolean;
      /** The Student marked it done, then Edunex moved it: it's back, and says so. */
      moved: boolean;
      edunex: EdunexExam;
    }
  | { kind: "takehome"; id: string; at: number | null; task: Task; status: TaskStatus };

/** Some system gives it a day: a SIX sitting, a dated Edunex exam (its start or its close) or a take-home. */
export const examDated = (exam: Exam): boolean => exam.six.length > 0 || exam.edunex.some((e) => e.start !== null || e.end !== null) || exam.tasks.length > 0;

/**
 * The exam's parts still ahead, soonest first (a take-home with no deadline
 * last). A window the Student marked done is behind. An Edunex sitting on a
 * day SIX has one is the same sitting: SIX's time and room stand for it.
 */
export function examParts(exam: Exam, now: number, marks: readonly ExamMark[] = []): ExamPart[] {
  const parts: ExamPart[] = [];
  for (const session of exam.six)
    if (session.end > now)
      parts.push({ kind: "sitting", id: `six:${session.id}`, at: session.start, end: session.end, source: "six", room: session.room, title: null });
  const sixDays = new Set(exam.six.map((session) => wibDay(session.start)));
  for (const item of exam.edunex) {
    if (item.start === null) {
      // Only its close: due then, like a deadline.
      if (item.end !== null && item.end > now)
        parts.push({ kind: "window", id: `edunex:${item.id}`, at: item.end, opensAt: null, open: true, moved: false, edunex: item });
      continue;
    }
    if (edunexEnd(item) <= now) continue;
    if (!isExamWindow(item)) {
      if (sixDays.has(wibDay(item.start))) continue;
      parts.push({ kind: "sitting", id: `edunex:${item.id}`, at: item.start, end: item.end, source: "edunex", room: null, title: item.title });
      continue;
    }
    if (examMarkOn(item, marks)) continue;
    const moved = marks.some((mark) => mark.id === examMarkKey(item).id);
    parts.push({ kind: "window", id: `edunex:${item.id}`, at: edunexEnd(item), opensAt: item.start, open: item.start <= now, moved, edunex: item });
  }
  for (const task of exam.tasks) {
    const status = taskStatus(task, now);
    if (isOpenStatus(status)) parts.push({ kind: "takehome", id: `task:${task.id}`, at: task.dueAt, task, status });
  }
  return parts.sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Still ahead of the Student while some part of it is: a sitting not over,
 * an Edunex window not closed (and not marked done), a take-home still to
 * hand in. An exam no system dates is ahead until ITB's exam week for it
 * ends, and always when it has no week.
 */
export function examAhead(exam: Exam, now: number, marks: readonly ExamMark[] = []): boolean {
  if (!examDated(exam)) return exam.week === null || exam.week.end > now;
  return examParts(exam, now, marks).length > 0;
}
