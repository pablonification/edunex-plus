// Exams in one place (#77): SIX's exam sessions, Edunex's exams and take-home
// UTS Tasks, the course outline and ITB's exam weeks merged per course and
// exam, and a warning when SIX and Edunex disagree.
import { describe, expect, it } from "vitest";
import { examKind, examPassed, mergeExams } from "../../src/core/exams";
import type { AcademicCalendar, ClassSession, CourseOutline } from "../../src/core/models";
import { aTask } from "../kit/tasks";

const DAY = 86_400_000;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const now = wib("2026-10-08T08:12:00");

const sixSession = (id: string, code: string, iso: string, activity: string, room: string | null = "TVST C"): ClassSession => ({
  id,
  courseCode: code,
  courseName: code,
  start: wib(iso),
  end: wib(iso) + 2 * 3_600_000,
  activity,
  room,
});
const calendar: AcademicCalendar = {
  checkedAt: now,
  events: [
    { id: "uts", title: "Masa Ujian Tengah Semester I-2026/2027", kind: "uts", term: "2026-1", start: wib("2026-10-12T00:00:00"), end: wib("2026-10-17T00:00:00"), allDay: true, firstDay: "2026-10-12", lastDay: "2026-10-16" },
    { id: "uas", title: "Ujian Akhir Semester I-2026/2027", kind: "uas", term: "2026-1", start: wib("2026-12-07T00:00:00"), end: wib("2026-12-23T00:00:00"), allDay: true, firstDay: "2026-12-07", lastDay: "2026-12-22" },
  ],
};
const outline = (...titles: string[]): CourseOutline => ({
  lecturer: null,
  credits: null,
  grade: null,
  modules: titles.map((title, i) => ({ id: i + 1, courseId: 95059, title, postedAt: null })),
});
const takeHome = aTask({ id: 117764, courseCode: "DK4073", courseId: 93409, title: "UTS Markom", status: "not_started", kind: "uts", dueAt: wib("2026-10-22T23:50:00") });

describe("the merged exam list", () => {
  it("a UTS in class in SIX and a take-home UTS in Edunex are one exam, and they disagree", () => {
    const [exam] = mergeExams({ schedule: [sixSession("2179909", "DK4073", "2026-10-15T11:00:00", "UTS")], tasks: [takeHome], calendar, term: "2026-1", now });
    expect(exam).toMatchObject({ id: "DK4073-UTS", kind: "UTS", disagree: true, at: wib("2026-10-15T11:00:00"), last: wib("2026-10-22T23:50:00") });
    expect(exam.six.map((s) => s.room)).toEqual(["TVST C"]);
    expect(exam.tasks.map((t) => t.title)).toEqual(["UTS Markom"]);
    expect(exam.week?.firstDay).toBe("2026-10-12");
  });

  it("agree when Edunex's exam is on SIX's day", () => {
    const [exam] = mergeExams({
      schedule: [sixSession("1", "PL3002", "2026-10-15T08:00:00", "UTS")],
      edunexExams: { PL3002: [{ id: "e1", courseId: 95001, title: "UTS Ekonomi Inovasi", start: wib("2026-10-15T08:00:00"), end: wib("2026-10-15T10:00:00") }] },
      now,
    });
    expect(exam).toMatchObject({ id: "PL3002-UTS", disagree: false });
    expect(exam.edunex).toHaveLength(1);
  });

  it("an exam only in the course outline has no date, ITB's week, and comes after the dated ones", () => {
    const exams = mergeExams({
      schedule: [sixSession("2179909", "DK4073", "2026-10-15T11:00:00", "UTS")],
      outline: { PL3032: outline("Pengantar", "Midex/UTS", "Finex/UAS") },
      calendar,
      term: "2026-1",
      now,
    });
    expect(exams.map((e) => [e.id, e.at, e.inOutline, e.week?.kind ?? null])).toEqual([
      ["DK4073-UTS", wib("2026-10-15T11:00:00"), false, "uts"],
      ["PL3032-UTS", null, true, "uts"],
      ["PL3032-UAS", null, true, "uas"],
    ]);
  });

  it("quizzes stay apart: each one is its own exam, joined across SIX and Edunex only on the same day", () => {
    const exams = mergeExams({
      schedule: [sixSession("q2", "PL3002", "2026-10-20T08:00:00", "Kuis"), sixSession("q1", "PL3002", "2026-10-06T08:00:00", "Kuis"), sixSession("u1", "PL3002", "2026-10-15T08:00:00", "UTS")],
      edunexExams: {
        PL3002: [
          { id: "e1", courseId: 95001, title: "Kuis 2", start: wib("2026-10-20T08:00:00"), end: wib("2026-10-20T09:00:00") },
          { id: "e2", courseId: 95001, title: "Kuis 3 (daring)", start: wib("2026-11-03T19:00:00"), end: null },
          { id: "e3", courseId: 95001, title: "Kuis susulan", start: null, end: null },
        ],
      },
      now,
    });
    const quizzes = exams.filter((e) => e.kind === "KUIS");
    expect(quizzes.map((e) => [e.six.map((s) => s.id), e.edunex.map((x) => x.id), e.disagree])).toEqual([
      [["q1"], [], false],
      [["q2"], ["e1"], false],
      [[], ["e2"], false],
      [[], ["e3"], false],
    ]);
    expect(new Set(exams.map((e) => e.id)).size).toBe(exams.length);
    // UTS and UAS stay one per course.
    expect(exams.filter((e) => e.kind === "UTS").map((e) => e.id)).toEqual(["PL3002-UTS"]);
  });

  it("leaves out Edunex items of courses not taken this term", () => {
    expect(mergeExams({ tasks: [takeHome], courses: ["PL3002"], now })).toEqual([]);
  });

  it("an exam is behind the Student once every date has passed; an undated one never is", () => {
    const [exam] = mergeExams({ schedule: [sixSession("1", "DK4073", "2026-10-15T11:00:00", "UTS")], tasks: [takeHome], now });
    expect(examPassed(exam, wib("2026-10-16T08:00:00"))).toBe(false);
    expect(examPassed(exam, wib("2026-10-22T23:50:00") + DAY)).toBe(true);
    const [undated] = mergeExams({ outline: { PL3032: outline("UAS") }, now });
    expect(examPassed(undated, now + 400 * DAY)).toBe(false);
  });
});

describe("what kind of exam a name speaks of", () => {
  it("reads ITB's words and the outline template's", () => {
    expect(["UTS", "UAS", "Midex/UTS", "Finex", "Kuis 2", "Quiz", "Ujian Praktikum", "Kuliah", null].map(examKind)).toEqual(["UTS", "UAS", "UTS", "UAS", "KUIS", "KUIS", "UJIAN", null, null]);
  });
});
