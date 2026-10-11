// The planner's logic (#78, #79) on the Student's real (scrubbed) SIX records:
// the record, the IP/IPK projection Nilai and the planner share, honors
// (Pasal 49), every rule a plan is checked against, the plan edits, the
// catalog search and the curriculum map.
import { beforeAll, describe, expect, it } from "vitest";
import { curriculumMap, nameMatch } from "../../src/core/curriculum-map";
import { honorFor, letterForAverage, nearestLetter, predicateFor } from "../../src/core/honors";
import type { PlannedCourse, StudyPlan } from "../../src/core/models";
import {
  addCourse,
  addShortTerm,
  addTerm,
  canRemoveTerm,
  checkPlan,
  courseInfo,
  defaultPlan,
  honorsOutlook,
  livePlan,
  parseTarget,
  programElectives,
  project,
  removeCourse,
  removeTerm,
  retakeCandidates,
  type Rule,
  type StudentRecord,
  searchCourses,
  semesterOf,
  shortTermToAdd,
  sksModel,
  studentRecord,
  targetOf,
} from "../../src/core/planner";
import { type Records, records } from "./grades-records";

let data: Records;
let record: StudentRecord;
beforeAll(async () => {
  data = await records();
  record = studentRecord({ ...data, term: "2026-1" });
});

const course = (code: string, grade: PlannedCourse["grade"] = "AB", retake = false): PlannedCourse => {
  const info = courseInfo(record, code);
  return { code, name: info.name, sks: info.sks, grade, retake };
};
const plan = (terms: Record<string, PlannedCourse[]>, extra: Partial<StudyPlan> = {}): StudyPlan => ({
  terms: Object.entries(terms).map(([term, courses]) => ({ term, courses })),
  expected: {},
  target: null,
  minor: null,
  ...extra,
});
const rules = (r: StudentRecord, p: StudyPlan) => checkPlan(r, p, project(r, p));
const rule = <I extends Rule["id"]>(list: Rule[], id: I) => list.filter((r): r is Extract<Rule, { id: I }> => r.id === id);

describe("the Student's record", () => {
  it("reads where the Student stands from SIX", () => {
    expect(record).toMatchObject({ term: "2026-1", entryTerm: "2023-1", semesterNow: 7, passedSks: 125, inProgressSks: 14, graduationSks: 144, normalSemesters: 8, electiveNeed: 27, electiveHave: 31, retookBefore: false });
    expect(record.requiredLeft.map((c) => [c.code, c.semester])).toEqual([
      ["II4090", 7],
      ["II4092", 8],
    ]);
    expect(record.specialization?.name).toBe("Sistem Informasi Cerdas");
    expect(record.thisTerm.map((c) => c.code)).toEqual(["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]);
    expect(record.program).toEqual({ code: "182", name: "Sistem dan Teknologi Informasi" });
  });

  it("without SIX's progress page, what's left comes from the curriculum minus the transcript", () => {
    const bare = studentRecord({ transcript: data.transcript, curriculum: data.curriculum, term: "2026-1" });
    const left = bare.requiredLeft.map((c) => c.code);
    expect(left).toContain("II4090");
    expect(left).toContain("WI2005");
    expect(left).not.toContain("II4091"); // this term
    expect(left).not.toContain("II2100"); // passed with C
  });

  it("numbers semesters from the entry term; short semesters have none", () => {
    expect(semesterOf("2023-1", "2023-1")).toBe(1);
    expect(semesterOf("2026-1", "2023-1")).toBe(7);
    expect(semesterOf("2026-2", "2023-1")).toBe(8);
    expect(semesterOf("2026-3", "2023-1")).toBeNull();
  });
});

describe("the projection", () => {
  it("past terms carry SIX's IP and the IPK the rows make; this term and the plan at the expected grades", () => {
    const p = project(record, defaultPlan(record));
    expect(p.steps.map((s) => [s.term, s.ip, s.ipk, s.projected])).toEqual([
      ["2023-1", 3.69, 3.69, false],
      ["2023-2", 3.17, 3.43, false],
      ["2024-1", 3.17, 3.33, false],
      ["2024-2", 3.24, 3.3, false],
      ["2025-1", 3.1, 3.26, false],
      ["2025-2", 3.27, 3.26, false],
      // 14 SKS at AB: (408 + 49) / 139.
      ["2026-1", 3.5, 3.29, true],
      // 12 SKS at AB: (457 + 42) / 151.
      ["2026-2", 3.5, 3.3, true],
    ]);
    expect(p).toMatchObject({ finalIpk: 3.3, finishSemester: 8, honor: null, variableSks: 26 });
  });

  it("the Student's expected grades move this term's IP and every IPK after it", () => {
    const p = project(record, { ...defaultPlan(record), expected: { DK4073: "A", II4091: "A", KU5014: "A", PL3002: "A", PL3032: "A" } });
    // (408 + 56) / 139 = 3.338…
    expect(p.steps.find((s) => s.term === "2026-1")).toMatchObject({ ip: 4, ipk: 3.34 });
  });

  it("a grade SIX already posted this term counts as posted, not as expected", () => {
    const transcript = structuredClone(data.transcript);
    const ii4091 = transcript.terms.at(-1)!.courses.find((c) => c.code === "II4091")!;
    Object.assign(ii4091, { grade: "E", standing: "counted" });
    const r = studentRecord({ ...data, transcript, term: "2026-1" });
    const p = project(r, plan({}, { expected: { II4091: "A" } }));
    expect(r.thisTerm.find((c) => c.code === "II4091")?.grade).toBe("E");
    // 12 SKS at the usual AB and II4091's posted E: 42 / 14.
    expect(p.steps.find((s) => s.term === "2026-1")?.ip).toBe(3);
  });

  it("a retake replaces the older grade (the newest counts) and rules out summa cum laude", () => {
    const p = project(record, plan({ "2026-2": [course("II2260", "A", true)] }));
    // II2260's C (6 points over 3 SKS) leaves; its A comes in: (408 − 6 + 49 + 12) / (125 − 3 + 14 + 3) = 3.33.
    expect(p.finalIpk).toBe(3.33);
    expect(p.path.retakes).toBe(true);
    expect(honorsOutlook(p).find((h) => h.level === "summa")).toMatchObject({ kind: "blocked", reason: "retake" });
  });

  it("works out the average a target needs over what's still to be graded", () => {
    const p = project(record, defaultPlan(record));
    // Fixed: 408 points over 125 SKS; 26 SKS still to be graded.
    expect(p.need(3.5)).toEqual({ kind: "out" });
    expect(p.need(3.3)).toEqual({ kind: "needs", average: 3.48 });
    expect(p.need(3.0)).toEqual({ kind: "needs", average: 1.74 });
    expect(p.need(2.5)).toEqual({ kind: "secured" });
    expect(project({ ...record, thisTerm: [] }, plan({})).need(3)).toEqual({ kind: "none" });
  });
});

describe("honors (Peraturan Akademik ITB, Pasal 49)", () => {
  it("cum laude from 3.50, magna from 3.75, summa from 3.85 without retakes, all within 9 semesters", () => {
    const path = { retakes: false, semesters: 8 };
    expect(honorFor(3.49, path)).toBeNull();
    expect(honorFor(3.5, path)).toBe("cum");
    expect(honorFor(3.75, path)).toBe("magna");
    expect(honorFor(3.84, path)).toBe("magna");
    expect(honorFor(3.85, path)).toBe("summa");
    expect(honorFor(3.9, { retakes: true, semesters: 8 })).toBe("magna");
    expect(honorFor(3.9, { retakes: false, semesters: 9 })).toBe("summa");
    expect(honorFor(3.9, { retakes: false, semesters: 10 })).toBeNull();
  });

  it("names the letter an average means, and starts expected grades at the Student's level", () => {
    expect(letterForAverage(3.48)).toBe("AB");
    expect(letterForAverage(3.51)).toBe("A");
    expect(letterForAverage(1.74)).toBe("C");
    expect(nearestLetter(3.26)).toBe("AB");
    expect(nearestLetter(3.1)).toBe("B");
  });
});

describe("rules, checked one by one", () => {
  it("the starting plan: everything met but Kerja Praktik, which the curriculum puts in an odd semester", () => {
    const list = rules(record, defaultPlan(record));
    expect(list.map((r) => [r.id, r.level])).toEqual([
      ["total", "ok"],
      ["required", "ok"],
      ["electives", "ok"],
      ["specialization", "ok"],
      ["parity", "warn"],
      ["finish", "ok"],
    ]);
    expect(rule(list, "total")[0]).toMatchObject({ have: 151, need: 144 });
    expect(rule(list, "electives")[0]).toMatchObject({ have: 37, need: 27 });
    expect(rule(list, "parity")[0]).toMatchObject({ code: "II4090", semester: 7, term: "2026-2" });
  });

  it("an empty plan: SKS short and required courses missing", () => {
    const list = rules(record, plan({}));
    expect(rule(list, "total")[0]).toMatchObject({ level: "error", have: 139, need: 144 });
    expect(rule(list, "required")[0]).toMatchObject({ level: "error", missing: [{ code: "II4090" }, { code: "II4092" }] });
    expect(rule(list, "specialization")[0]).toMatchObject({ level: "warn", missing: [{ code: "II4010" }, { code: "II4011" }] });
    // One verdict: with rules unmet there is no graduation semester to promise (it used to say "graduate in semester 7").
    expect(rule(list, "finish")[0]).toMatchObject({ level: "error", semester: 7, blocked: { sks: 5, required: 2, electives: 0, other: 0 } });
  });

  it("elective SKS: short until enough electives are planned", () => {
    const fewer = { ...record, electiveHave: 20 };
    expect(rule(rules(fewer, plan({})), "electives")[0]).toMatchObject({ level: "error", have: 20, need: 27 });
    const p = plan({ "2026-2": [course("II4021"), course("II4022"), course("II4023")] });
    expect(rule(rules(fewer, p), "electives")[0]).toMatchObject({ level: "ok", have: 29 });
  });

  it("the registered specialization: a course of it left out", () => {
    const p = removeCourse(defaultPlan(record), "2026-2", "II4011");
    expect(rule(rules(record, p), "specialization")[0]).toMatchObject({ level: "warn", name: "Sistem Informasi Cerdas", missing: [{ code: "II4011" }] });
  });

  it("a chosen minor: its SKS from the list", () => {
    const minor = record.minors.find((m) => m.name === "Branding Berbasis Digital")!;
    expect(rule(rules(record, plan({}, { minor: minor.key })), "minor")[0]).toMatchObject({ level: "warn", have: 3, need: 12 });
    const all = plan({ "2026-2": minor.courses.filter((c) => c !== "DK3071").map((c) => course(c)) }, { minor: minor.key });
    expect(rule(rules(record, all), "minor")[0]).toMatchObject({ level: "ok" });
  });

  it("per-semester limits: above 20 needs the advisor, 24 at most, 9 in a short semester", () => {
    const load = (codes: string[], term = "2026-2") => rule(rules(record, plan({ [term]: codes.map((c) => course(c)) })), "load");
    const seven = ["II4090", "II4092", "II4010", "II4011", "II4021", "II4022", "II4023"]; // 2+4+3+3+3+3+3 = 21
    expect(load(seven)).toEqual([{ id: "load", level: "warn", term: "2026-2", sks: 21, limit: 20 }]);
    expect(load([...seven, "II4024"])).toEqual([{ id: "load", level: "warn", term: "2026-2", sks: 24, limit: 20 }]);
    expect(load([...seven, "II4024", "II4012"])).toEqual([{ id: "load", level: "error", term: "2026-2", sks: 27, limit: 24 }]);
    expect(load(["II4010", "II4011", "II4021", "II4022"], "2026-3")).toEqual([{ id: "load", level: "error", term: "2026-3", sks: 12, limit: 9 }]);
    expect(load(["II4010", "II4011", "II4021"], "2026-3")).toEqual([]);
  });

  it("odd/even: a required course in a semester of the other parity", () => {
    expect(rule(rules(record, plan({ "2026-2": [course("II4092")] })), "parity")).toEqual([]);
    expect(rule(rules(record, plan({ "2027-1": [course("II4092")] })), "parity")[0]).toMatchObject({ code: "II4092", semester: 8 });
    // Short semesters run what they run: no parity check.
    expect(rule(rules(record, plan({ "2026-3": [course("II4090")] })), "parity")).toEqual([]);
  });

  it("the recommended semester: Tugas Akhir planned before semester 8", () => {
    const earlier = studentRecord({ ...data, term: "2025-1" });
    expect(rule(rules(earlier, plan({ "2025-2": [course("II4092")] })), "early")[0]).toMatchObject({ code: "II4092", semester: 8, term: "2025-2" });
  });

  it("finishing within 8 semesters, 9 (honors still possible), or later (no honors)", () => {
    const at = (p: StudyPlan) => rule(rules(record, p), "finish")[0];
    const rest = defaultPlan(record).terms[0].courses.filter((c) => c.code !== "II4092");
    expect(at(plan({ "2026-2": [...rest, course("II4092")] }))).toMatchObject({ level: "ok", semester: 8, blocked: null });
    expect(at(plan({ "2026-2": rest, "2027-1": [course("II4092")] }))).toMatchObject({ level: "warn", semester: 9, blocked: null });
    const late = plan({ "2026-2": rest, "2027-1": [], "2027-2": [course("II4092")] });
    expect(at(late)).toMatchObject({ level: "warn", semester: 10 });
    expect(honorsOutlook(project(record, late)).every((h) => h.kind === "blocked" && h.reason === "time")).toBe(true);
  });
});

describe("one SKS count for every screen", () => {
  it("the starting plan: 144 needed, 151 counted (7 spare), electives 37 of 27 = 10 spare", () => {
    const m = sksModel(record, defaultPlan(record));
    expect(m).toMatchObject({ need: 144, requiredNeed: 117, electiveNeed: 27, passed: 125, inProgress: 14, planned: 12, total: 151, short: 0, extra: 7 });
    expect(m.electives).toEqual({ passed: 19, inProgress: 12, planned: 6, have: 37, short: 0, extra: 10 });
    expect(m.requiredLeft).toEqual({ count: 2, sks: 6 });
    expect(m.requiredUnplanned).toEqual({ count: 0, sks: 0 });
  });

  it("the planner's rules and the curriculum map read the same numbers", () => {
    const p = defaultPlan(record);
    const m = sksModel(record, p);
    const map = curriculumMap(record, p);
    expect(map.electivePassed + map.electiveInProgress).toBe(m.electives.passed + m.electives.inProgress);
    expect(map.requiredLeftSks).toBe(m.requiredLeft.sks);
    expect(rule(rules(record, p), "electives")[0]).toMatchObject({ have: m.electives.have, need: m.electiveNeed });
    expect(rule(rules(record, p), "total")[0]).toMatchObject({ have: m.total, need: m.need });
  });

  it("an empty plan: 5 SKS short, both required courses unplanned", () => {
    const m = sksModel(record, plan({}));
    expect(m).toMatchObject({ total: 139, short: 5, extra: 0, requiredUnplanned: { count: 2, sks: 6 } });
  });
});

describe("the IPK target, one setting", () => {
  it("accepts 2,00–4,00 with a comma or a point; empty and out of range are said, never 'reached'", () => {
    expect(parseTarget("3,5")).toEqual({ kind: "ok", value: 3.5 });
    expect(parseTarget(" 3.333 ")).toEqual({ kind: "ok", value: 3.33 });
    expect(parseTarget("")).toEqual({ kind: "empty" });
    expect(parseTarget("4,5")).toEqual({ kind: "invalid" });
    expect(parseTarget("1.5")).toEqual({ kind: "invalid" });
    expect(parseTarget("abc")).toEqual({ kind: "invalid" });
  });

  it("the Student's own target, else the next line above the IPK, the same on both screens", () => {
    expect(targetOf(record, plan({}))).toBe(3.5);
    expect(targetOf(record, plan({}, { target: 3 }))).toBe(3);
    expect(targetOf(record, plan({}, { target: 7 }))).toBe(3.5);
  });

  it("the highest IPK still possible: straight A's in what's left", () => {
    const p = project(record, defaultPlan(record));
    // (408 + 4 × 26) / 151 = 3.39
    expect(p.bestIpk).toBe(3.39);
    expect(p.need(p.bestIpk!)).toMatchObject({ kind: "needs" });
  });

  it("the predicate is one word for an IPK", () => {
    const path = { retakes: false, semesters: 8 };
    expect(predicateFor(3.3, path)).toBe("very-good");
    expect(predicateFor(3.6, path)).toBe("cum");
    expect(predicateFor(2.5, path)).toBe("good");
    expect(predicateFor(3.6, { retakes: false, semesters: 10 })).toBe("very-good");
  });
});

describe("editing the plan", () => {
  it("starts with what's left: Kerja Praktik, Tugas Akhir and the specialization", () => {
    const p = defaultPlan(record);
    expect(p.terms.map((t) => [t.term, t.courses.map((c) => `${c.code}:${c.grade}`)])).toEqual([["2026-2", ["II4090:AB", "II4092:AB", "II4010:AB", "II4011:AB"]]]);
  });

  it("adds semesters and short semesters, and removes only the last regular one or a short one", () => {
    let p = plan({ "2026-2": [] });
    expect(shortTermToAdd(p, record)).toBe("2026-3");
    p = addTerm(p, record);
    p = addShortTerm(p, record);
    expect(p.terms.map((t) => t.term)).toEqual(["2026-2", "2026-3", "2027-1"]);
    expect(canRemoveTerm(p, "2026-2")).toBe(false);
    expect(canRemoveTerm(p, "2026-3")).toBe(true);
    expect(removeTerm(p, "2026-2")).toBe(p);
    expect(removeTerm(removeTerm(p, "2027-1"), "2026-3").terms.map((t) => t.term)).toEqual(["2026-2"]);
  });

  it("a course is planned once: adding it elsewhere moves it", () => {
    let p = plan({ "2026-2": [course("II4021")], "2027-1": [] });
    p = addCourse(p, "2027-1", course("II4021", "A"));
    expect(p.terms.map((t) => t.courses.map((c) => `${c.code}:${c.grade}`))).toEqual([[], ["II4021:A"]]);
  });

  it("a plan made last semester drops the semesters that have started", () => {
    const old = plan({ "2026-1": [course("II4021")], "2026-2": [course("II4022")] });
    expect(livePlan(old, record).terms.map((t) => t.term)).toEqual(["2026-2"]);
  });
});

describe("the catalog and retakes", () => {
  it("searches every ITB course by code or name", () => {
    expect(searchCourses(record, "kriptografi").map((c) => c.code)).toContain("II4021");
    expect(searchCourses(record, "II40")[0].code.startsWith("II40")).toBe(true);
    expect(searchCourses(record, "PL3")).not.toHaveLength(0);
    expect(searchCourses(record, "k")).toEqual([]);
    expect(record.courses.size).toBeGreaterThan(500);
  });

  it("lists the program's electives: its own courses that aren't required", () => {
    const codes = programElectives(record).map((c) => c.code);
    expect(codes).toContain("II4021");
    expect(codes).not.toContain("II4092");
  });

  it("C and BC grades are retake candidates, with what an A would do", () => {
    const list = retakeCandidates(record);
    expect(list.every((c) => c.grade === "C" || c.grade === "BC")).toBe(true);
    expect(list[0]).toMatchObject({ ipkNow: 3.26, ipkWithA: 3.31 });
    expect(list.map((c) => c.code)).toContain("II2260");
    expect(list.map((c) => c.code)).not.toContain("II2120");
  });
});

describe("the curriculum map", () => {
  it("marks passed courses, including those passed under another code the way SIX places them", () => {
    const map = curriculumMap(record, defaultPlan(record));
    const slot = (code: string) => map.semesters.flatMap((s) => s.required).find((c) => c.code === code)!;
    expect(slot("MA1101")).toMatchObject({ status: "passed", grade: "AB", via: null, courseId: "47455" });
    expect(slot("KI1101")).toMatchObject({ status: "passed", grade: "A", via: { code: "KI1002" } });
    expect(slot("WI2003")).toMatchObject({ status: "passed", via: { code: "KU1001", name: "Olah Raga" } });
    expect(slot("WI201X")).toMatchObject({ status: "passed", grade: "BC", via: { code: "WI2011" } });
    expect(slot("WI1103")).toMatchObject({ status: "exempt" });
    expect(slot("II4091")).toMatchObject({ status: "in-progress" });
    expect(slot("II4090")).toMatchObject({ status: "planned" });
    // SIX lists it neither as taken nor as still to take: said so, never guessed.
    expect(slot("WI2005")).toMatchObject({ status: "unlisted", via: null });
  });

  it("an empty plan leaves required courses to take", () => {
    const map = curriculumMap(record, plan({}));
    expect(map.semesters.find((s) => s.semester === 8)!.required.find((c) => c.code === "II4092")).toMatchObject({ status: "left" });
    expect(map).toMatchObject({ requiredSks: 117, requiredLeftSks: 6, electiveNeed: 27, electivePassed: 19, electiveInProgress: 12 });
  });

  it("lists electives and older-curriculum courses SIX counts, and tracks with their progress", () => {
    const map = curriculumMap(record, defaultPlan(record));
    expect(map.semesters.find((s) => s.semester === 8)!.others.map((c) => c.code)).toEqual(["II4012", "II4013", "KU5014"]);
    expect(map.specializations.map((s) => [s.name, s.registered, s.have, s.sks])).toEqual([
      ["Sistem Informasi Cerdas", true, 6, 12],
      ["Keamanan dan Privasi Siber", false, 0, 12],
    ]);
    expect(map.specializations[0].courses.map((c) => c.status)).toEqual(["planned", "planned", "passed", "passed"]);
    expect(map.minors[0]).toMatchObject({ have: 3 });
  });

  it("matches names only when every word of the shorter one is shared", () => {
    expect(nameMatch("Bahasa Indonesia", "Bahasa Inggris")).toBe(0);
    expect(nameMatch("Kimia Dasar I", "Kimia Dasar B")).toBe(1);
    expect(nameMatch("Berpikir Komputasional", "Pengenalan Komputasi")).toBe(1);
  });
});
