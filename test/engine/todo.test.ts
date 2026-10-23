// Tugas & Ujian as one list, in order (the Tasks & Exams design round,
// alternative A): every Task, take-home, exam sitting and Edunex window still
// ahead at the moment it runs out, one quiet line per exam period with no day
// yet, and Done. The cases are the design's table of when an exam is over.
import { describe, expect, it } from "vitest";
import { examAhead, examMarkKey, examParts, mergeExams, pruneExamMarks } from "../../src/core/exams";
import type { AcademicCalendar, ClassSession, CourseOutline, EdunexExam, ExamMark, Task } from "../../src/core/models";
import { taskNeed } from "../../src/core/needs";
import { snoozeKey } from "../../src/core/snooze";
import { doneList, lateSnoozable, putOffLate, type TodoItem, todoCount, todoForCourse, todoGroup, todoList, todoUrgent } from "../../src/core/todo";
import { aTask } from "../kit/tasks";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

const sixSession = (id: string, code: string, iso: string, activity = "UTS", room: string | null = "TVST C"): ClassSession => ({
  id,
  courseCode: code,
  courseName: code,
  start: wib(iso),
  end: wib(iso) + 2 * HOUR,
  activity,
  room,
});
const week = (kind: "uts" | "uas", firstDay: string, lastDay: string) => ({
  id: kind,
  title: kind === "uts" ? "Masa Ujian Tengah Semester" : "Ujian Akhir Semester",
  kind,
  term: "2026-1",
  start: wib(`${firstDay}T00:00:00`),
  end: wib(`${lastDay}T00:00:00`) + DAY,
  allDay: true,
  firstDay,
  lastDay,
});
const calendar: AcademicCalendar = { checkedAt: 0, events: [week("uts", "2026-10-12", "2026-10-16"), week("uas", "2026-12-07", "2026-12-22")] };
const outline = (...titles: string[]): CourseOutline => ({
  lecturer: null,
  credits: null,
  grade: null,
  modules: titles.map((title, i) => ({ id: i + 1, courseId: 95059, title, postedAt: null })),
});

const takeHome = aTask({
  id: 117764,
  courseCode: "DK4073",
  courseId: 93409,
  title: "UTS Markom",
  status: "not_started",
  kind: "uts",
  dueAt: wib("2026-10-22T23:50:00"),
});
const bab2 = aTask({
  id: 117003,
  courseCode: "II4091",
  courseId: 95326,
  title: "Tugas 02 Bab II",
  status: "not_started",
  dueAt: wib("2026-10-16T23:59:00"),
  lateAllowed: true,
});
const sent = (task: Task, at: string): Task => ({
  ...task,
  answer: { id: 1, text: "", files: [], createdAt: wib(at), updatedAt: wib(at), sent: true, sentAt: wib(at), reviewedAt: null },
});
const quiz = (fields: Partial<EdunexExam> = {}): EdunexExam => ({
  id: "88002",
  courseId: 93409,
  title: "Kuis Brand Equity",
  start: wib("2026-10-20T08:00:00"),
  end: wib("2026-10-30T23:59:00"),
  ...fields,
});

/** The demo's term: DK4073's UTS sat in class on 15 Oct with its take-home due 22 Oct, PL3032's UTS and UAS named only in its outline. */
function term(now: number, extra: { tasks?: Task[]; edunex?: EdunexExam[] } = {}) {
  const tasks = extra.tasks ?? [takeHome, bab2];
  const exams = mergeExams({
    schedule: [sixSession("2179909", "DK4073", "2026-10-15T11:00:00")],
    tasks,
    edunexExams: extra.edunex ? { DK4073: extra.edunex } : undefined,
    outline: { PL3032: outline("Midex/UTS", "Finex/UAS") },
    calendar,
    term: "2026-1",
    now,
  });
  return { tasks, exams, now };
}
const titles = (items: readonly TodoItem[]) =>
  items.map((item) =>
    item.kind === "task"
      ? item.task.title
      : item.kind === "period"
        ? `${item.examKind} period (${item.exams.map((e) => e.courseCode).join(", ")})`
        : `${item.exam.id} ${item.part?.kind ?? "undated"}`,
  );
const groups = (items: readonly TodoItem[], now: number) => items.map((item) => todoGroup(item, now));

describe("one list, in order", () => {
  it("every part at its own moment: a sitting at its start, a take-home at its deadline, then the period lines", () => {
    const input = term(wib("2026-10-08T08:12:00"));
    const items = todoList(input);
    // PL3032's UTS has no day yet: its line sits where its week starts, Monday 12 Oct.
    expect(titles(items)).toEqual(["UTS period (PL3032)", "DK4073-UTS sitting", "Tugas 02 Bab II", "DK4073-UTS takehome", "UAS period (PL3032)"]);
    // The take-home is the exam's, never also a plain Task.
    expect(items.filter((item) => item.kind === "task").map((item) => item.key)).toEqual(["task:117003"]);
    expect(groups(items, input.now)).toEqual(["nextWeek", "nextWeek", "nextWeek", "later", "later"]);
  });

  it("a period line sits after the rows at its moment, and says whether it is far, near or on", () => {
    const at = (iso: string) => todoList(term(wib(iso))).filter((item) => item.kind === "period");
    expect(at("2026-09-20T09:00:00").map((p) => p.kind === "period" && p.state)).toEqual(["far", "far"]);
    expect(at("2026-10-08T08:12:00").map((p) => p.kind === "period" && p.state)).toEqual(["near", "far"]);
    expect(at("2026-10-13T08:00:00").map((p) => p.kind === "period" && p.state)).toEqual(["during", "far"]);
    // After its week the UTS line is gone (that exam is in Past exams); the UAS one is on its way.
    expect(at("2026-10-17T08:00:00").map((p) => p.kind === "period" && p.examKind)).toEqual(["UAS"]);
    expect(at("2026-11-25T08:00:00").map((p) => p.kind === "period" && p.state)).toEqual(["near"]);
  });

  it("weeks are ITB's (WIB, Monday first) whatever this computer's time zone", () => {
    const tz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      // Sunday 11 Oct 23:00 in Bandung is still Sunday's week; Monday 12 Oct 00:30 is next week's, as ITB counts.
      const now = wib("2026-10-11T23:00:00");
      const late = aTask({ id: 1, courseCode: "PL3002", courseId: 1, title: "Sunday", status: "not_started", dueAt: wib("2026-10-11T23:30:00") });
      const monday = aTask({ id: 2, courseCode: "PL3002", courseId: 1, title: "Monday", status: "not_started", dueAt: wib("2026-10-12T00:30:00") });
      expect(groups(todoList({ tasks: [late, monday], exams: [], now }), now)).toEqual(["thisWeek", "nextWeek"]);
    } finally {
      process.env.TZ = tz;
    }
  });

  it("a Task with no deadline, and an exam no system dates with no exam week, wait under No date yet", () => {
    const now = wib("2026-10-08T08:12:00");
    const open = aTask({ id: 3, courseCode: "PL3002", courseId: 1, title: "Refleksi", status: "not_started" });
    const exams = mergeExams({ outline: { PL3032: outline("UAS") }, now });
    const items = todoList({ tasks: [open], exams, now });
    expect(titles(items)).toEqual(["Refleksi", "PL3032-UAS undated"]);
    expect(groups(items, now)).toEqual(["undated", "undated"]);
    // The Task counts (it's still to hand in); the exam with no day doesn't.
    expect(todoCount(items)).toBe(1);
  });
});

describe("when an exam is over", () => {
  it("sat in class and its take-home handed in before the deadline: out of To do, into Past exams", () => {
    const input = term(wib("2026-10-16T09:00:00"), { tasks: [sent(takeHome, "2026-10-16T08:00:00"), bab2] });
    // Friday of UTS week: PL3032's line is still on (its week ends tonight).
    expect(titles(todoList(input))).toEqual(["UTS period (PL3032)", "Tugas 02 Bab II", "UAS period (PL3032)"]);
    const done = doneList(input);
    expect(done.pastExams.map((p) => p.exam.id)).toEqual(["DK4073-UTS"]);
    // The take-home shows once, with the Tasks handed in.
    expect(done.handedIn.map((t) => t.title)).toEqual(["UTS Markom"]);
  });

  it("sat in class with the take-home still open: in To do as the take-home, at its deadline", () => {
    const input = term(wib("2026-10-16T09:00:00"));
    expect(titles(todoList(input))).toEqual(["UTS period (PL3032)", "Tugas 02 Bab II", "DK4073-UTS takehome", "UAS period (PL3032)"]);
    expect(doneList(input).pastExams).toEqual([]);
  });

  it("the take-home late but still taken stays on top under Overdue, like any late Task", () => {
    const late = { ...takeHome, lateAllowed: true };
    const input = term(wib("2026-10-24T09:00:00"), { tasks: [late] });
    const items = todoList(input);
    expect(titles(items)).toEqual(["DK4073-UTS takehome", "UAS period (PL3032)"]);
    expect(groups(items, input.now)).toEqual(["overdue", "later"]);
    expect(examAhead(input.exams.find((e) => e.id === "DK4073-UTS")!, input.now)).toBe(true);
    expect(todoUrgent(items, input.now)).toBe(true);
    // Not taken late: closed, so the exam is over and the Task is in "Closed, not handed in".
    const closed = term(wib("2026-10-24T09:00:00"), { tasks: [takeHome] });
    expect(titles(todoList(closed))).toEqual(["UAS period (PL3032)"]);
    expect(doneList(closed).closed.map((t) => t.title)).toEqual(["UTS Markom"]);
  });

  it("a week ended with no day ever given: over, in Past exams", () => {
    const input = term(wib("2026-10-17T08:00:00"));
    expect(doneList(input).pastExams.map((p) => p.exam.id)).toContain("PL3032-UTS");
    expect(titles(todoList(input))).not.toContain("UTS period (PL3032)");
  });

  it("an Edunex window open for days passes at its close, not its start; a short one is a sitting at its start", () => {
    const window = quiz();
    const before = term(wib("2026-10-19T09:00:00"), { tasks: [], edunex: [window] });
    const part = todoList(before).find((item) => item.kind === "exam" && item.part?.kind === "window");
    expect(part).toMatchObject({ at: window.end, part: { kind: "window", open: false, opensAt: window.start } });
    const during = term(wib("2026-10-25T09:00:00"), { tasks: [], edunex: [window] });
    expect(todoList(during).find((item) => item.kind === "exam" && item.part?.kind === "window")).toMatchObject({ part: { open: true } });
    const after = term(wib("2026-10-31T00:30:00"), { tasks: [], edunex: [window] });
    expect(titles(todoList(after))).toEqual(["UAS period (PL3032)"]);
    // A sitting open an hour, or with only its start: at its start, ahead until it ends (or its day does).
    const short = quiz({ start: wib("2026-10-20T19:00:00"), end: wib("2026-10-20T20:00:00") });
    const startOnly = quiz({ id: "88003", start: wib("2026-10-21T19:00:00"), end: null });
    // Quizzes are each their own exam.
    const quizzes = term(wib("2026-10-21T22:00:00"), { tasks: [], edunex: [short, startOnly] }).exams.filter((e) => e.kind === "KUIS");
    const parts = (at: number) => quizzes.flatMap((exam) => examParts(exam, at)).map((p) => [p.kind, p.at]);
    expect(parts(wib("2026-10-20T19:30:00"))).toEqual([
      ["sitting", short.start],
      ["sitting", startOnly.start],
    ]);
    expect(parts(wib("2026-10-21T22:00:00"))).toEqual([["sitting", startOnly.start]]);
    expect(parts(wib("2026-10-22T00:01:00"))).toEqual([]);
  });

  it("SIX and Edunex giving the same sitting on the same day is one row and one count, SIX's; on different days, two", () => {
    const sameDay = quiz({ id: "7001", title: "UTS Markom", start: wib("2026-10-15T11:00:00"), end: wib("2026-10-15T13:00:00") });
    const input = term(wib("2026-10-14T08:00:00"), { tasks: [], edunex: [sameDay] });
    expect(titles(todoList(input)).filter((title) => title.startsWith("DK4073"))).toEqual(["DK4073-UTS sitting"]);
    expect(todoList(input).find((item) => item.kind === "exam")).toMatchObject({ part: { source: "six", room: "TVST C" } });
    const otherDay = quiz({ id: "7001", title: "UTS Markom", start: wib("2026-10-16T09:00:00"), end: wib("2026-10-16T11:00:00") });
    expect(titles(todoList(term(wib("2026-10-14T08:00:00"), { tasks: [], edunex: [otherDay] }))).filter((t) => t.startsWith("DK4073"))).toEqual([
      "DK4073-UTS sitting",
      "DK4073-UTS sitting",
    ]);
  });

  it("an Edunex exam with only its close is due then, and over after it", () => {
    const closeOnly = quiz({ start: null, end: wib("2026-10-28T23:59:00") });
    const before = term(wib("2026-10-22T09:00:00"), { tasks: [], edunex: [closeOnly] });
    const item = todoList(before).find((i) => i.kind === "exam" && i.exam.kind === "KUIS");
    // Its length isn't known: no Mark as done for it (opensAt is null).
    expect(item).toMatchObject({ at: closeOnly.end, part: { kind: "window", opensAt: null } });
    const after = term(wib("2026-10-29T00:30:00"), { tasks: [], edunex: [closeOnly] });
    expect(todoList(after).some((i) => i.kind === "exam" && i.exam.kind === "KUIS")).toBe(false);
    expect(doneList(after).pastExams.map((p) => p.exam.kind)).toContain("KUIS");
  });

  it("a sitting the same day as the take-home's deadline is two rows", () => {
    const sameDay = { ...takeHome, dueAt: wib("2026-10-15T23:59:00") };
    const input = term(wib("2026-10-14T08:00:00"), { tasks: [sameDay] });
    expect(titles(todoList(input)).filter((title) => title.startsWith("DK4073"))).toEqual(["DK4073-UTS sitting", "DK4073-UTS takehome"]);
  });
});

describe("Mark as done", () => {
  const window = quiz();
  const mark = (fields: Partial<EdunexExam> = {}): ExamMark => ({ ...examMarkKey(quiz(fields)), at: wib("2026-10-22T14:10:00") });

  it("a marked window is behind the Student: out of To do, in Past exams with its mark", () => {
    const input = { ...term(wib("2026-10-22T14:30:00"), { tasks: [], edunex: [window] }), marks: [mark()] };
    expect(titles(todoList(input))).toEqual(["UAS period (PL3032)"]);
    const past = doneList(input).pastExams.find((p) => p.exam.id === "DK4073-KUIS-e88002");
    expect(past?.marks).toEqual([mark()]);
    // Newest first, by when it was marked: before the class sitting of 15 Oct.
    expect(past?.at).toBe(wib("2026-10-22T14:10:00"));
    expect(doneList(input).pastExams.map((p) => p.exam.id)).toEqual(["DK4073-KUIS-e88002", "PL3032-UTS", "DK4073-UTS"]);
  });

  it("Edunex moves the window: the mark no longer holds, the exam is back and says so", () => {
    const moved = quiz({ end: wib("2026-11-02T23:59:00") });
    const input = { ...term(wib("2026-10-22T14:30:00"), { tasks: [], edunex: [moved] }), marks: [mark()] };
    expect(todoList(input).find((item) => item.kind === "exam" && item.part?.kind === "window")).toMatchObject({ part: { moved: true } });
    expect(doneList(input).pastExams.map((p) => p.exam.id)).not.toContain("DK4073-KUIS-e88002");
  });

  it("marks are let go a month after their window closed", () => {
    const old = mark();
    expect(pruneExamMarks([old], wib("2026-11-20T00:00:00"))).toEqual([old]);
    expect(pruneExamMarks([old], wib("2026-12-01T00:00:00"))).toEqual([]);
  });
});

describe("putting off a late Task", () => {
  it("only a late row, as Beranda's own item for that Task: same key, same moments; back once the Task changes", () => {
    const late = { ...takeHome, lateAllowed: true };
    const now = wib("2026-10-24T09:00:00");
    const input = term(now, { tasks: [late, bab2] });
    const items = todoList(input);
    const own = taskNeed(bab2, now)!;
    const bab2Row = items.find((item) => item.key === "task:117003")!;
    expect(lateSnoozable(bab2Row, now)?.key).toEqual(snoozeKey(own));
    // A late take-home is put off as its Task, too; nothing that isn't late is.
    expect(lateSnoozable(items.find((item) => item.key === "exam:DK4073-UTS:task:117764")!, now)?.key.id).toBe("task:117764");
    expect(items.filter((item) => lateSnoozable(item, now)).map((item) => item.key)).toEqual(["task:117003", "exam:DK4073-UTS:task:117764"]);
    const entry = { ...snoozeKey(own), until: now + DAY };
    const { shown, putOff } = putOffLate(items, [entry], now);
    expect(putOff.map(({ item }) => item.key)).toEqual(["task:117003"]);
    expect(todoCount(shown)).toBe(todoCount(items) - 1);
    // The lecturer moves the deadline: the snooze no longer holds.
    const moved = { ...bab2, dueAt: wib("2026-10-25T23:59:00") };
    expect(putOffLate(todoList(term(now, { tasks: [late, moved] })), [entry], now).putOff).toEqual([]);
    // Its time is up: back.
    expect(putOffLate(items, [entry], now + DAY).putOff).toEqual([]);
  });
});

describe("one count everywhere", () => {
  it("counts Tasks, take-homes and exams with a day; never a period line", () => {
    const input = term(wib("2026-10-08T08:12:00"));
    const items = todoList(input);
    expect(todoCount(items)).toBe(3);
    expect(todoUrgent(items, input.now)).toBe(false);
    // Within a day of the sitting it's urgent.
    expect(todoUrgent(todoList(term(wib("2026-10-14T12:00:00"))), wib("2026-10-14T12:00:00"))).toBe(true);
  });

  it("a course's part: its own rows, and a period line only with its own exams", () => {
    const items = todoList(term(wib("2026-10-08T08:12:00")));
    expect(titles(todoForCourse(items, "DK4073"))).toEqual(["DK4073-UTS sitting", "DK4073-UTS takehome"]);
    expect(titles(todoForCourse(items, "PL3032"))).toEqual(["UTS period (PL3032)", "UAS period (PL3032)"]);
    expect(todoCount(todoForCourse(items, "PL3032"))).toBe(0);
  });
});
