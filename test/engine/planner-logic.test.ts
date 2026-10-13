// The planner's logic (#78, #79) on the Student's real (scrubbed) SIX records:
// the record, the IP/IPK projection Nilai and the planner share, honors
// (Pasal 49), every rule a plan is checked against, the plan edits, the
// catalog search and the curriculum map.
import { beforeAll, describe, expect, it } from "vitest";
import { curriculumMap, type MapCourse, standIns } from "../../src/core/curriculum-map";
import { nameMatch } from "../../src/core/curriculum-slots";
import { honorFor, letterForAverage, nearestLetter, predicateFor } from "../../src/core/honors";
import type { CurriculumFix, PlannedCourse, StudyPlan } from "../../src/core/models";
import {
  activeMinor,
  activeSpecialization,
  addCourse,
  addShortTerm,
  addTerm,
  addToNow,
  aheadPlan,
  canRemoveTerm,
  checkPlan,
  courseInfo,
  defaultPlan,
  hasWhatIfs,
  hideReasons,
  hideRule,
  honorsOutlook,
  isHidden,
  leaveOut,
  livePlan,
  minorProgress,
  onlyFor,
  parseTarget,
  planMinor,
  programElectives,
  project,
  pruneWhatIfs,
  putBack,
  type Rule,
  removeCourse,
  removeTerm,
  removeTried,
  retakeCandidates,
  ruleKey,
  type StudentRecord,
  searchCourses,
  semesterOf,
  shortTermToAdd,
  showRule,
  sksModel,
  stopFollowing,
  studentRecord,
  targetOf,
  untried,
  withWhatIf,
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
/** The curriculum with a minor registered on SIX too. */
const registeredMinor = () => ({
  ...data.curriculum,
  registrations: [
    ...data.curriculum.registrations,
    {
      kind: "minor" as const,
      name: "Branding Berbasis Digital",
      program: "Desain Komunikasi Visual",
      advisorApprovedOn: null,
      programApprovedOn: null,
      status: "On Progress",
    },
  ],
});
const rule = <I extends Rule["id"]>(list: Rule[], id: I) => list.filter((r): r is Extract<Rule, { id: I }> => r.id === id);

describe("the Student's record", () => {
  it("reads where the Student stands from SIX", () => {
    expect(record).toMatchObject({
      term: "2026-1",
      entryTerm: "2023-1",
      semesterNow: 7,
      passedSks: 125,
      inProgressSks: 14,
      graduationSks: 144,
      normalSemesters: 8,
      electiveNeed: 27,
      electiveHave: 31,
      retookBefore: false,
    });
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
    expect(left).toContain("WI1111"); // a lab course the Student never took
    expect(left).not.toContain("WI2005"); // KU1011 Tata Tulis Karya Ilmiah stands in for it (the equivalence table)
    expect(left).not.toContain("WI201X"); // any WI2010–WI2019: WI2011 Agama Islam
    expect(left).not.toContain("II4091"); // this term
    expect(left).not.toContain("II2100"); // passed with C
    // Courses that fill a slot count there, not also as electives: KU1011 and WI2011 (2 SKS each) used to be counted twice.
    expect(bare.electivePassed).toBe(40);
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

  it("a minor's SKS split the way the Student reads it", () => {
    const minor = record.minors.find((m) => m.name === "Branding Berbasis Digital")!;
    expect(minorProgress(record, plan({}), minor)).toEqual({ passed: 0, now: 3, planned: 0, need: 12 });
    expect(minorProgress(record, plan({ "2026-2": [course("DK3072")] }), minor)).toMatchObject({ now: 3, planned: 3 });
  });

  it("a chosen minor: its SKS from the list", () => {
    const minor = record.minors.find((m) => m.name === "Branding Berbasis Digital")!;
    expect(rule(rules(record, plan({}, { minor: minor.key })), "minor")[0]).toMatchObject({ level: "warn", have: 3, need: 12 });
    const all = plan({ "2026-2": minor.courses.filter((c) => c !== "DK3071").map((c) => course(c)) }, { minor: minor.key });
    expect(rule(rules(record, all), "minor")[0]).toMatchObject({ level: "ok" });
  });

  it("per-semester limits: above 20 needs the advisor, 24 at most, 9 in a short semester", () => {
    // II4012 was passed with a C: it can only be taken again as a retake.
    const load = (codes: string[], term = "2026-2") => rule(rules(record, plan({ [term]: codes.map((c) => course(c, "AB", c === "II4012")) })), "load");
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
    expect(p.terms.map((t) => [t.term, t.courses.map((c) => `${c.code}:${c.grade}`)])).toEqual([
      ["2026-2", ["II4090:AB", "II4092:AB", "II4010:AB", "II4011:AB"]],
    ]);
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

describe("this semester's what-ifs, only in the plan", () => {
  const nowCourse = (code: string) => ({ code, name: courseInfo(record, code).name, sks: courseInfo(record, code).sks });

  it("leaving out a KRS course: this semester's SKS, IP and electives follow; SIX's own record doesn't change", () => {
    const p = leaveOut(defaultPlan(record), "2026-1", "PL3032");
    expect(p.now).toEqual({ term: "2026-1", added: [], dropped: ["PL3032"] });
    const r = withWhatIf(record, p);
    expect(r.thisTerm.map((c) => c.code)).toEqual(["DK4073", "II4091", "KU5014", "PL3002"]);
    expect(r.thisTermDropped.map((c) => c.code)).toEqual(["PL3032"]);
    expect(r).toMatchObject({ inProgressSks: 11, electiveInProgress: 9, electiveHave: 28 });
    expect(project(r, p).steps.find((s) => s.term === "2026-1")).toMatchObject({ sks: 11 });
    expect(sksModel(r, p)).toMatchObject({ inProgress: 11, total: 148 });
    expect(record.thisTerm).toHaveLength(5);
    // And back.
    expect(withWhatIf(record, putBack(p, "2026-1", "PL3032")).thisTerm).toHaveLength(5);
  });

  it("leaving out a required course puts it back among what's left, and the rules say it isn't planned", () => {
    const p = leaveOut(defaultPlan(record), "2026-1", "II4091");
    const r = withWhatIf(record, p);
    expect(r.requiredLeft.map((c) => c.code)).toEqual(["II4090", "II4092", "II4091"]);
    expect(r.slots.get("II4091")).toMatchObject({ status: "left" });
    expect(rule(rules(r, p), "required")[0]).toMatchObject({ level: "error", missing: [{ code: "II4091", name: "Proposal Tugas Akhir" }] });
  });

  it("adding Kerja Praktik now: no longer left, no odd/even warning, and it leaves the semester it was planned in (until the what-if goes)", () => {
    const start = defaultPlan(record);
    const p = addToNow(start, "2026-1", nowCourse("II4090"));
    const r = withWhatIf(record, p);
    expect(r.requiredLeft.map((c) => c.code)).toEqual(["II4092"]);
    expect(r.slots.get("II4090")).toMatchObject({ status: "in-progress" });
    // It moved: out of 2026-2 in the plan as saved too, remembering where it was.
    expect(p.terms[0].courses.map((c) => c.code)).toEqual(["II4092", "II4010", "II4011"]);
    expect(p.now?.added).toEqual([{ ...nowCourse("II4090"), from: { term: "2026-2", grade: "AB", retake: false } }]);
    expect(livePlan(p, r).terms[0].courses.map((c) => c.code)).toEqual(["II4092", "II4010", "II4011"]);
    expect(rule(rules(r, p), "parity")).toEqual([]);
    expect(rule(rules(r, p), "required")[0]).toMatchObject({ level: "ok" });
    expect(sksModel(r, p)).toMatchObject({ inProgress: 16, planned: 10, total: 151 });
    // Removing an added course takes the what-if away, and puts the course back where it was planned.
    const back = removeTried(p, "2026-1", "II4090");
    expect(back.now).toEqual({ term: "2026-1", added: [], dropped: [] });
    expect(back.terms[0].courses.map((c) => c.code)).toEqual(["II4092", "II4010", "II4011", "II4090"]);
    // A course that wasn't planned goes nowhere.
    const tried = addToNow(start, "2026-1", nowCourse("II4021"));
    expect(tried.now?.added[0].from).toBeUndefined();
    expect(removeTried(tried, "2026-1", "II4021").terms).toEqual(start.terms);
  });

  it("a course tried now survives its later semester being removed: taking the what-if away puts it in the last one planned (bug)", () => {
    const tried = addToNow(defaultPlan(record), "2026-1", nowCourse("II4010"));
    const gone = removeTerm(tried, "2026-2");
    expect(gone.terms).toEqual([]);
    // Back in a semester of its own when none is left, at the grade it was planned at.
    expect(removeTried(gone, "2026-1", "II4010").terms).toEqual([{ term: "2026-2", courses: [course("II4010")] }]);
    // Into the last regular semester planned when its own is gone.
    const later = addShortTerm(addTerm(addTerm(gone, record), record), record);
    expect(later.terms.map((t) => t.term)).toEqual(["2026-2", "2026-3", "2027-1"]);
    const moved = removeTried(removeTerm(later, "2027-1"), "2026-1", "II4010");
    expect(moved.terms.map((t) => [t.term, t.courses.map((c) => c.code)])).toEqual([
      ["2026-2", ["II4010"]],
      ["2026-3", []],
    ]);
  });

  it("a course planned for later and then taken for real (passed, credited, or in SIX's KRS) isn't counted twice", () => {
    const p = plan({ "2026-2": [course("II2100"), course("II4092"), course("II2260", "A", true)] });
    const live = livePlan(p, record);
    // II2100 is passed: it doesn't show or count again; a retake (II2260) does.
    expect(live.terms[0].courses.map((c) => c.code)).toEqual(["II4092", "II2260"]);
    expect(sksModel(record, p).planned).toBe(4);
  });

  /** SIX's record with a course retaken this term (and, for a failed one, SIX's progress showing the E). */
  const retaking = (code: string, before: "C" | "E") => {
    const transcript = structuredClone(data.transcript);
    const old = transcript.terms.flatMap((t) => t.courses).find((c) => c.code === code)!;
    old.grade = before;
    transcript.terms.at(-1)!.courses.push({ ...old, grade: null, standing: "pending", attempt: 2 });
    const progress = structuredClone(data.progress);
    const row = progress.stages.flatMap((st) => st.semesters.flatMap((sem) => sem.courses)).find((c) => c.code === code)!;
    row.grade = before;
    return studentRecord({ ...data, transcript, progress, term: "2026-1" });
  };

  it("a retake left out: a grade from before stands, an E puts the course back among what's left", () => {
    const passed = retaking("II2100", "C");
    // Retaking a passed course adds no SKS, now as for a planned retake.
    expect(passed.inProgressSks).toBe(14);
    const p = leaveOut(defaultPlan(passed), "2026-1", "II2100");
    const r = withWhatIf(passed, p);
    expect(r.slots.get("II2100")).toMatchObject({ status: "passed", grade: "C" });
    expect(r.requiredLeft.map((c) => c.code)).toEqual(["II4090", "II4092"]);

    const failed = retaking("II2100", "E");
    expect(failed.requiredLeft.map((c) => c.code)).toEqual(["II4090", "II4092"]);
    expect(failed.inProgressSks).toBe(16);
    const q = leaveOut(defaultPlan(failed), "2026-1", "II2100");
    const s2 = withWhatIf(failed, q);
    expect(s2.slots.get("II2100")).toMatchObject({ status: "failed", grade: "E" });
    expect(s2.requiredLeft.map((c) => c.code)).toEqual(["II4090", "II4092", "II2100"]);
    expect(rule(rules(s2, q), "required")[0]).toMatchObject({ level: "error", missing: [{ code: "II2100" }] });
  });

  it("once SIX catches up (the course added for real), the what-if no longer counts and is dropped from the plan", () => {
    const transcript = structuredClone(data.transcript);
    transcript.terms.at(-1)!.courses.push({ ...transcript.terms.at(-1)!.courses[0]!, code: "II4090", name: "Kerja Praktik", sks: 2 });
    const real = studentRecord({ ...data, transcript, term: "2026-1" });
    const p = addToNow(leaveOut(plan({}), "2026-1", "PL3032"), "2026-1", nowCourse("II4090"));
    expect(hasWhatIfs(p, real)).toBe(true);
    expect(withWhatIf(real, p).thisTermAdded).toEqual([]);
    expect(pruneWhatIfs(p, real).now).toEqual({ term: "2026-1", added: [], dropped: ["PL3032"] });
    // Leaving out a course that's real now drops it, even with a stale entry for it.
    expect(leaveOut(p, "2026-1", "II4090").now).toEqual({ term: "2026-1", added: [], dropped: ["PL3032", "II4090"] });
    const caughtUp = putBack(p, "2026-1", "PL3032");
    expect(hasWhatIfs(caughtUp, real)).toBe(false);
    expect(pruneWhatIfs(caughtUp, real).now).toBeUndefined();
  });

  it("a course tried now, then registered on SIX and dropped there again, is still planned where it was (bug)", () => {
    const start = defaultPlan(record);
    const p = addToNow(start, "2026-1", nowCourse("II4010"));
    const transcript = structuredClone(data.transcript);
    transcript.terms.at(-1)!.courses.push({ ...transcript.terms.at(-1)!.courses[0]!, code: "II4010", name: "Manajemen Data", sks: 3 });
    const registered = studentRecord({ ...data, transcript, term: "2026-1" });
    // SIX caught up: the what-if goes, and the plan as saved holds the course where it was planned again.
    const saved = pruneWhatIfs(p, registered);
    expect(saved.now).toBeUndefined();
    expect(saved.terms[0].courses.map((c) => c.code)).toContain("II4010");
    // While it's in the KRS, that copy neither shows nor counts.
    expect(livePlan(saved, registered).terms[0].courses.map((c) => c.code)).not.toContain("II4010");
    expect(sksModel(registered, saved)).toEqual(sksModel(registered, start));
    // Dropped on SIX during URS: it's planned again, as it was.
    const codes = (q: StudyPlan) => livePlan(q, record).terms.map((t) => [t.term, t.courses.map((c) => `${c.code}:${c.grade}`).sort()]);
    expect(codes(saved)).toEqual(codes(start));
  });

  it("Kurikulum follows the what-ifs too, and marks each as only in the plan", () => {
    const p = addToNow(leaveOut(leaveOut(defaultPlan(record), "2026-1", "PL3032"), "2026-1", "II4091"), "2026-1", nowCourse("II4021"));
    const tried = addToNow(p, "2026-1", nowCourse("II4090"));
    const r = withWhatIf(record, tried);
    const map = curriculumMap(r, livePlan(tried, r));
    const mark = (c: MapCourse) => `${c.code}:${c.status}${c.whatIf ? `:${c.whatIf}` : ""}`;
    const others = (n: number) => map.semesters.find((s) => s.semester === n)!.others.map(mark);
    // A course left out stays listed, marked, and isn't counted (the totals come from the record).
    expect(others(5)).toEqual(["DK3071:passed", "PL3002:in-progress", "PL3032:in-progress:left-out"]);
    expect(others(7)).toEqual(["DK4073:in-progress", "II4021:in-progress:added"]);
    const required = (code: string) => mark(map.semesters.flatMap((s) => s.required).find((c) => c.code === code)!);
    expect(required("II4090")).toBe("II4090:in-progress:added");
    expect(required("II4091")).toBe("II4091:left:left-out");
    expect(required("II4092")).toBe("II4092:planned");
    // SIX's own record has none of it.
    expect(
      curriculumMap(record, livePlan(tried, record))
        .semesters.flatMap((s) => [...s.required, ...s.others])
        .filter((c) => c.whatIf),
    ).toEqual([]);
  });

  it("this semester's load is checked once it's changed; a course graded already can't be left out", () => {
    let p = defaultPlan(record);
    for (const code of ["II4021", "II4022", "II4023"]) p = addToNow(p, "2026-1", nowCourse(code));
    expect(rule(rules(withWhatIf(record, p), p), "load")).toEqual([{ id: "load", level: "warn", term: "2026-1", sks: 23, limit: 20 }]);
    expect(rule(rules(record, defaultPlan(record)), "load")).toEqual([]);

    const transcript = structuredClone(data.transcript);
    Object.assign(transcript.terms.at(-1)!.courses.find((c) => c.code === "PL3032")!, { grade: "A", standing: "counted" });
    const graded = studentRecord({ ...data, transcript, term: "2026-1" });
    expect(withWhatIf(graded, leaveOut(defaultPlan(graded), "2026-1", "PL3032")).thisTerm.map((c) => c.code)).toContain("PL3032");
  });

  it("taking a graded course again now is a retake: summa cum laude closes", () => {
    const p = addToNow(plan({}), "2026-1", nowCourse("II2260"));
    expect(project(withWhatIf(record, p), p).path.retakes).toBe(true);
  });

  it("last semester's what-ifs are dropped once SIX's term moves on", () => {
    const old = { ...defaultPlan(record), now: { term: "2025-2", added: [nowCourse("II4021")], dropped: ["PL3032"] } };
    expect(withWhatIf(record, old)).toBe(record);
    expect(aheadPlan(old, record).now).toBeUndefined();
  });

  it("a course only tried in a term that has ended goes back to the semester it was planned in (bug)", () => {
    const p = addToNow(plan({ "2026-2": [course("II4092")], "2027-1": [course("II4010")] }), "2026-1", nowCourse("II4010"));
    expect(p.terms[1].courses).toEqual([]);
    const shape = (q: StudyPlan) => q.terms.map((t) => [t.term, t.courses.map((c) => c.code)]);
    const next = aheadPlan(p, studentRecord({ ...data, term: "2026-2" }));
    expect(next.now).toBeUndefined();
    expect(shape(next)).toEqual([["2027-1", ["II4010"]]]);
    // Taken for real (SIX's transcript has it that term): not planned again.
    const transcript = structuredClone(data.transcript);
    transcript.terms.at(-1)!.courses.push({ ...transcript.terms.at(-1)!.courses[0]!, code: "II4010", name: "Manajemen Data", sks: 3 });
    expect(shape(aheadPlan(p, studentRecord({ ...data, transcript, term: "2026-2" })))).toEqual([["2027-1", []]]);
    // Its semester gone too: the next one after the new term.
    expect(shape(aheadPlan(removeTerm(p, "2027-1"), studentRecord({ ...data, term: "2026-2" })))).toEqual([["2027-1", ["II4010"]]]);
  });

  it("without the what-ifs (Nilai), a course tried now counts in the semester it was planned in", () => {
    const start = defaultPlan(record);
    const p = addToNow(start, "2026-1", nowCourse("II4090"));
    expect(untried(p).now).toEqual(p.now);
    expect(untried(p).terms[0].courses.map((c) => c.code)).toEqual(["II4092", "II4010", "II4011", "II4090"]);
    expect(sksModel(record, untried(p))).toEqual(sksModel(record, start));
  });
});

describe("hiding a warning", () => {
  it("only warnings can be hidden, under a key that survives moving the course", () => {
    const list = rules(record, plan({ "2026-2": [course("II4090")] }));
    expect(list.map((r) => [r.id, ruleKey(r)])).toEqual([
      ["total", null],
      ["required", null],
      ["electives", null],
      ["specialization", "specialization|sistem informasi cerdas"],
      ["parity", "parity|II4090"],
      ["finish", null],
    ]);
    expect(ruleKey(rule(rules(record, plan({ "2027-2": [course("II4090")] })), "parity")[0])).toBe("parity|II4090");
    expect(hideReasons(rule(list, "specialization")[0])).toEqual(["not-continuing", "other"]);
    expect(hideReasons(rule(list, "parity")[0])).toEqual(["program-adds", "other"]);
  });

  it("hidden, shown again; a fresh plan keeps what the Student hid", () => {
    const parity = rule(rules(record, defaultPlan(record)), "parity")[0];
    const p = hideRule(defaultPlan(record), "parity|II4090", "program-adds", 1);
    expect(isHidden(parity, p)).toBe(true);
    expect(isHidden(parity, showRule(p, "parity|II4090"))).toBe(false);
    expect(defaultPlan(record, p.hidden).hidden).toEqual({ "parity|II4090": { reason: "program-adds", at: 1 } });
  });

  it("not continuing the specialization: the planner stops suggesting its courses", () => {
    const hidden = { "specialization|sistem informasi cerdas": { reason: "not-continuing" as const, at: 1 } };
    expect(activeSpecialization(record, { hidden })).toBeNull();
    expect(activeSpecialization(record, { hidden: { "specialization|sistem informasi cerdas": { reason: "other", at: 1 } } })).toBe(record.specialization);
    expect(defaultPlan(record, hidden).terms[0].courses.map((c) => c.code)).toEqual(["II4090", "II4092"]);
  });

  it("not continuing a registered minor lasts like a specialization's: a fresh plan doesn't follow it again, planning it does", () => {
    const withMinor = studentRecord({ ...data, curriculum: registeredMinor(), term: "2026-1" });
    const minor = withMinor.minors.find((m) => m.key === withMinor.registeredMinor)!;
    expect(minor.name).toBe("Branding Berbasis Digital");
    // The starting plan follows the registered minor, and its warning offers not continuing; a minor only picked doesn't.
    const start = defaultPlan(withMinor);
    const warning = rule(rules(withMinor, start), "minor")[0];
    expect(warning).toMatchObject({ level: "warn", registered: true });
    expect(hideReasons(warning)).toEqual(["not-continuing", "other"]);
    expect(hideReasons(rule(rules(record, plan({}, { minor: minor.key })), "minor")[0])).toEqual(["other"]);

    const stopped = stopFollowing(start, ruleKey(warning)!, 1);
    expect(activeMinor(withMinor, stopped)).toBeNull();
    expect(rule(rules(withMinor, stopped), "minor")).toEqual([]);
    // "Reset plan" keeps it: the starting plan names the registered minor, but it isn't followed.
    const reset = defaultPlan(withMinor, stopped.hidden);
    expect(activeMinor(withMinor, reset)).toBeNull();
    expect(rule(rules(withMinor, reset), "minor")).toEqual([]);
    expect(curriculumMap(withMinor, reset).minors[0]).toMatchObject({ name: "Branding Berbasis Digital", registered: true, notContinuing: true });
    // Planning it again follows it again.
    const again = planMinor(reset, minor);
    expect(activeMinor(withMinor, again)?.key).toBe(minor.key);
    expect(again.hidden).toEqual({});
    expect(curriculumMap(withMinor, again).minors[0]).toMatchObject({ notContinuing: false });
  });

  it("not continuing can take out the courses only that package asked for; required ones, retakes and the other package's stay", () => {
    const start = defaultPlan(record);
    const spec = record.specialization!.courses.map((c) => c.code);
    expect(onlyFor(record, start, spec).map((c) => c.code)).toEqual(["II4010", "II4011"]);
    const both = addCourse(start, "2026-2", course("II2260", "A", true));
    // A course the followed minor also asks for stays; a retake is about the IPK, not the package.
    expect(onlyFor(record, both, [...spec, "II2260"], ["II4011"]).map((c) => c.code)).toEqual(["II4010"]);
    const key = "specialization|sistem informasi cerdas";
    const dropped = stopFollowing(both, key, 1, ["II4010", "II4011", "II2260"]);
    expect(dropped.terms[0].courses.map((c) => c.code)).toEqual(["II4090", "II4092", "II2260"]);
    expect(dropped.hidden).toEqual({ [key]: { reason: "not-continuing", at: 1 } });
    // Without the courses, the starting plan stays as it was.
    expect(stopFollowing(start, key, 1).terms).toEqual(start.terms);
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
    // SIX lists it neither as taken nor as still to take: not asked of the Student, said so, never guessed.
    expect(slot("WI1111")).toMatchObject({ status: "unlisted", via: null });
    // The equivalence table: Tata Tulis Karya Ilmiah counts as Bahasa Indonesia (no shared word, so no name guess could find it).
    expect(slot("WI2005")).toMatchObject({ status: "passed", grade: "AB", via: { code: "KU1011", name: "Tata Tulis Karya Ilmiah" } });
    expect(map.semesters.find((s) => s.semester === 2)!.others.map((c) => c.code)).toEqual(["IF2111", "FI1201", "MA1201"]);
  });

  it("a course SIX doesn't list for the Student isn't left: the rules and the map agree", () => {
    const p = defaultPlan(record);
    const map = curriculumMap(record, p);
    const unlisted = map.semesters.flatMap((s) => s.required).filter((c) => c.status === "unlisted");
    expect(unlisted.map((c) => c.code)).toEqual(["WI1111", "WI1116", "WI2002"]);
    expect(record.requiredLeft.map((c) => c.code)).toEqual(["II4090", "II4092"]);
    // "All 42": the 45 required courses less the 3 SIX doesn't ask of this Student.
    expect(rule(rules(record, p), "required")[0]).toMatchObject({ level: "ok", total: 42, missing: [], corrected: [] });
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

  it("the Student's corrections: not in their curriculum, counted as a passed course, done; each changes the rules and the map alike", () => {
    const fixed = (fixes: Record<string, CurriculumFix>) => studentRecord({ ...data, term: "2026-1", fixes });
    const slot = (r: StudentRecord, code: string) =>
      curriculumMap(r, defaultPlan(r))
        .semesters.flatMap((s) => s.required)
        .find((c) => c.code === code)!;

    const notMine = fixed({ WI1111: { kind: "not-mine", at: 1 } });
    expect(slot(notMine, "WI1111")).toMatchObject({ status: "not-mine", fix: { kind: "not-mine" }, sixLeft: false });

    // A passed course stands in: it leaves "other courses", and counts once (FI1201 was an outside elective on SIX).
    const counted = fixed({ WI1111: { kind: "counted-as", code: "FI1201", at: 1 } });
    expect(slot(counted, "WI1111")).toMatchObject({
      status: "passed",
      grade: "BC",
      via: { code: "FI1201", name: "Fisika Dasar IIA" },
      fix: { kind: "counted-as" },
    });
    expect(
      curriculumMap(counted, defaultPlan(counted))
        .semesters.find((s) => s.semester === 2)!
        .others.map((c) => c.code),
    ).toEqual(["IF2111", "MA1201"]);
    expect(counted.electivePassed).toBe(record.electivePassed - 4);
    // Corrections never change what the curriculum needs.
    expect(counted.electiveNeed).toBe(record.electiveNeed);

    // A correction to a course SIX still lists as to take: no longer left, and said so.
    const done = fixed({ II4090: { kind: "done", at: 1 } });
    expect(done.requiredLeft.map((c) => c.code)).toEqual(["II4092"]);
    expect(slot(done, "II4090")).toMatchObject({ status: "done", sixLeft: true });
    const p = plan({ "2026-2": [course("II4092")] });
    expect(rule(rules(done, p), "required")[0]).toMatchObject({ level: "ok", missing: [], corrected: [{ code: "II4090", name: "Kerja Praktik" }] });
    expect(rule(rules(record, p), "required")[0]).toMatchObject({ level: "error", missing: [{ code: "II4090" }] });

    // Marking a passed course not in the curriculum takes it out of the count of courses that apply.
    expect(rule(rules(fixed({ WI2003: { kind: "not-mine", at: 1 } }), defaultPlan(record)), "required")[0]).toMatchObject({ total: 41 });
  });

  it("'In my curriculum': a course SIX leaves off the record counts as left to take, in the rules and the map alike", () => {
    const mine = studentRecord({ ...data, term: "2026-1", fixes: { WI1111: { kind: "mine", at: 1 } } });
    expect(mine.requiredLeft.map((c) => c.code)).toEqual(["II4090", "II4092", "WI1111"]);
    const p = defaultPlan(record);
    expect(rule(rules(mine, p), "required")[0]).toMatchObject({
      level: "error",
      total: 43,
      missing: [{ code: "WI1111", name: "Laboratorium Fisika Dasar", slot: "WI1111" }],
    });
    const row = curriculumMap(mine, p)
      .semesters.flatMap((s) => s.required)
      .find((c) => c.code === "WI1111");
    expect(row).toMatchObject({ status: "left", fix: { kind: "mine" } });
    expect(sksModel(mine, p).requiredLeft).toEqual({ count: 3, sks: 7 });
    // A fresh plan places it.
    expect(defaultPlan(mine).terms[0].courses.map((c) => c.code)).toContain("WI1111");
    // Where SIX already has the course, SIX's word stands.
    const passed = studentRecord({ ...data, term: "2026-1", fixes: { MA1101: { kind: "mine", at: 1 } } });
    expect(passed.slots.get("MA1101")).toMatchObject({ status: "passed", fix: null });
  });

  it("'My program will add it': covered, its SKS counted as coming, said apart from corrections; SIX's word wins once it has it", () => {
    const adds = studentRecord({ ...data, term: "2026-1", fixes: { II4090: { kind: "program-adds", at: 1 } } });
    expect(adds.requiredLeft.map((c) => c.code)).toEqual(["II4092"]);
    expect(adds.slots.get("II4090")).toMatchObject({ status: "program-adds", sixLeft: true });
    expect(adds.byProgram.map((c) => c.code)).toEqual(["II4090"]);
    const p = removeCourse(defaultPlan(record), "2026-2", "II4090");
    expect(rule(rules(record, p), "required")[0]).toMatchObject({ level: "error", missing: [{ code: "II4090", slot: "II4090" }] });
    expect(rule(rules(adds, p), "required")[0]).toMatchObject({
      level: "ok",
      missing: [],
      corrected: [],
      byProgram: [{ code: "II4090", name: "Kerja Praktik" }],
    });
    // Its 2 SKS count as coming, once: not while it's also planned.
    expect(sksModel(adds, p)).toMatchObject({ planned: 10, byProgram: 2, total: 151, extra: 7 });
    expect(sksModel(adds, defaultPlan(record))).toMatchObject({ planned: 12, byProgram: 0, total: 151 });
    expect(
      curriculumMap(adds, p)
        .semesters.flatMap((s) => s.required)
        .find((c) => c.code === "II4090"),
    ).toMatchObject({ status: "program-adds" });
    // SIX shows it graded: the fix rests.
    const progress = structuredClone(data.progress);
    const row = progress.stages.flatMap((stage) => stage.semesters.flatMap((sem) => sem.courses)).find((c) => c.code === "II4090")!;
    Object.assign(row, { status: "graded", grade: "A", term: "2026-1" });
    const added = studentRecord({ ...data, progress, term: "2026-1", fixes: { II4090: { kind: "program-adds", at: 1 } } });
    expect(added.slots.get("II4090")).toMatchObject({ status: "passed", fix: null });
    expect(added.byProgram).toEqual([]);
  });

  it("'Counted as…' offers passed courses: SIX's same-semester ones that fill nothing first", () => {
    const list = standIns(record, "WI2002");
    expect(list.slice(0, 3).map((c) => [c.code, c.suggested])).toEqual([
      ["FI1201", true],
      ["IF2111", true],
      ["MA1201", true],
    ]);
    // Only guessed for WI1102 (by name): offered, and picking it moves it there.
    expect(list.find((c) => c.code === "KU1102")).toMatchObject({ suggested: false, fills: "WI1102" });
    const moved = studentRecord({ ...data, term: "2026-1", fixes: { WI2002: { kind: "counted-as", code: "KU1102", at: 1 } } });
    expect(moved.slots.get("WI2002")).toMatchObject({ status: "passed", via: { code: "KU1102" } });
    expect(moved.slots.get("WI1102")).toMatchObject({ status: "unlisted", via: null });
    // Never a curriculum course itself, never one already settled in a slot (the table put KU1011 in WI2005), never the one standing in.
    expect(list.map((c) => c.code)).not.toContain("MA1101");
    expect(list.map((c) => c.code)).not.toContain("KU1011");
    expect(standIns(record, "WI2005").map((c) => c.code)).not.toContain("KU1011");
    expect(standIns(record, "WI1111")[0]).toMatchObject({ code: "II1101", suggested: true });
  });

  it("matches names only when every word of the shorter one is shared", () => {
    expect(nameMatch("Bahasa Indonesia", "Bahasa Inggris")).toBe(0);
    expect(nameMatch("Kimia Dasar I", "Kimia Dasar B")).toBe(1);
    expect(nameMatch("Berpikir Komputasional", "Pengenalan Komputasi")).toBe(1);
  });
});
