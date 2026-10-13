// v2-12 (#80): what KRS, UKT and ITB's calendar mean for the Student, on the
// real calendar feed and the recorded KRS and bills.
import { describe, expect, it } from "vitest";
import {
  academicDeadlines,
  billUrgency,
  currentTerm,
  krsNeedsStudent,
  krsOverlaps,
  krsStage,
  krsTimeline,
  nextKrsWindow,
  nextTerm,
  progressTarget,
  rupiah,
} from "../../src/core/academic";
import type { Bill, ClassSession, KrsPlan, Progress } from "../../src/core/models";
import { readCalendar } from "../../src/engine/sources/itb/calendar";
import { readBills } from "../../src/engine/sources/six/readers/bills";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { calendarFixture } from "../pretend/itb";
import { PretendSix } from "../pretend/six";

const HOUR = 3_600_000;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const calendar = readCalendar(calendarFixture(), 0);
const KRS = /\/registrasi\/rencanastudi\/\d+$/;
const official = (): KrsPlan => readKrs(new PretendSix(() => 0).page(KRS));
const bill = (patch: Partial<Bill>): Bill => ({
  term: "2026-2",
  amount: 5_400_000,
  paid: null,
  status: "unpaid",
  dueDate: "2027-01-31",
  dueAt: wib("2027-01-31T23:59:59.999"),
  instalments: [],
  nextDueAt: wib("2027-01-31T23:59:59.999"),
  ...patch,
});

describe("terms", () => {
  it("the next regular term, and this term from the calendar when SIX hasn't said", () => {
    expect([nextTerm("2026-1"), nextTerm("2026-2"), nextTerm("2026-3")]).toEqual(["2026-2", "2027-1", "2027-1"]);
    expect(currentTerm("2026-1", undefined, 0)).toBe("2026-1");
    expect(currentTerm(null, calendar, wib("2026-10-11T09:00:00"))).toBe("2026-1");
    // After UAS of the first semester ends (22 Dec), the second one.
    expect(currentTerm(null, calendar, wib("2026-12-23T09:00:00"))).toBe("2026-2");
  });
});

describe("KRS", () => {
  it("the recorded plan: every step done, official, with its change round", () => {
    const plan = official();
    expect(krsStage(plan)).toBe("done");
    const { plan: steps, change } = krsTimeline(plan);
    expect(steps.map((s) => [s.key, s.done])).toEqual([
      ["sent", true],
      ["approved", true],
      ["ukt", true],
      ["official", true],
    ]);
    expect(steps[2]).toMatchObject({ amount: 5_400_000, at: null });
    expect(change?.map((s) => s.at)).toEqual([wib("2026-09-15T14:15:10"), wib("2026-09-15T19:18:25"), wib("2026-09-16T11:02:56")]);
  });

  it("what each state asks of the Student", () => {
    const plan = official();
    expect(krsStage({ ...plan, state: "not-sent" })).toBe("send");
    expect(krsStage({ ...plan, state: "sent" })).toBe("advisor");
    expect(krsStage({ ...plan, state: "approved" })).toBe("official");
    expect(krsStage({ ...plan, state: "approved", ukt: { paid: false, amount: 5_400_000 } })).toBe("ukt");
  });

  it("the next ITB window: DRS while not sent, then URS; a step to do only while the DRS hasn't closed", () => {
    const notSent = { ...official(), state: "not-sent" as const, change: null };
    const drs = nextKrsWindow(notSent, calendar, wib("2026-08-10T09:00:00"));
    expect(drs).toMatchObject({ kind: "drs", open: false, event: { firstDay: "2026-08-12", lastDay: "2026-08-20" } });
    expect(nextKrsWindow(notSent, calendar, wib("2026-08-15T09:00:00"))).toMatchObject({ kind: "drs", open: true });
    expect(nextKrsWindow(official(), calendar, wib("2026-08-15T09:00:00"))).toMatchObject({ kind: "urs", open: false, event: { firstDay: "2026-09-15" } });
    expect(nextKrsWindow(official(), calendar, wib("2026-10-11T09:00:00"))).toBeNull();

    expect(krsNeedsStudent(notSent, calendar, wib("2026-08-15T09:00:00"))).toBe(true);
    expect(krsNeedsStudent(notSent, calendar, wib("2026-08-21T09:00:00"))).toBe(false);
    expect(krsNeedsStudent(official(), calendar, wib("2026-08-15T09:00:00"))).toBe(false);
  });

  it("overlapping classes between KRS courses, by pair, the next collision first", () => {
    const at = (id: string, code: string, start: string, hours: number): ClassSession => ({
      id,
      courseCode: code,
      courseName: code,
      start: wib(start),
      end: wib(start) + hours * HOUR,
      activity: "Kuliah",
      room: null,
    });
    const schedule = [
      at("a1", "PL3002", "2026-10-08T08:00:00", 2),
      at("b1", "KU5014", "2026-10-08T09:00:00", 2),
      at("a2", "PL3002", "2026-10-15T08:00:00", 2),
      at("b2", "KU5014", "2026-10-15T09:00:00", 2),
      at("c1", "DK4073", "2026-10-15T10:00:00", 1),
      // Back to back is no clash; a course outside the KRS doesn't count.
      at("d1", "II4091", "2026-10-15T11:00:00", 2),
      at("x1", "MA1101", "2026-10-15T11:00:00", 2),
    ];
    const codes = ["DK4073", "II4091", "KU5014", "PL3002"];
    expect(krsOverlaps(codes, schedule, wib("2026-10-11T09:00:00"))).toEqual([
      { codes: ["KU5014", "PL3002"], count: 2, start: wib("2026-10-15T09:00:00"), end: wib("2026-10-15T10:00:00"), upcoming: true },
      { codes: ["DK4073", "KU5014"], count: 1, start: wib("2026-10-15T10:00:00"), end: wib("2026-10-15T11:00:00"), upcoming: true },
    ]);
    const later = krsOverlaps(codes, schedule, wib("2026-10-20T09:00:00"));
    expect(later[0]).toMatchObject({ upcoming: false, start: wib("2026-10-15T09:00:00") });
    expect(krsOverlaps(["PL3002"], schedule, 0)).toEqual([]);
  });
});

describe("UKT", () => {
  it("how urgent a bill is", () => {
    const now = wib("2027-01-20T09:00:00");
    expect(billUrgency(bill({}), now)).toBe("due");
    expect(billUrgency(bill({}), wib("2027-01-25T09:00:00"))).toBe("soon");
    expect(billUrgency(bill({}), wib("2027-02-01T00:00:01"))).toBe("overdue");
    expect(billUrgency(bill({ status: "paid", paid: 5_400_000, nextDueAt: null }), now)).toBe("paid");
    expect(billUrgency(bill({ status: "not-billed", amount: null, nextDueAt: null }), now)).toBe("not-billed");
    expect(billUrgency(bill({ nextDueAt: null }), now)).toBe("no-date");
    const recorded = readBills(new PretendSix(() => 0).page(/\/keuangan$/));
    expect(recorded.map((b) => billUrgency(b, now)).filter((u) => u !== "paid" && u !== "not-billed")).toEqual([]);
    expect(rupiah(5_400_000)).toBe("Rp5.400.000");
  });
});

describe("ITB's academic deadlines", () => {
  const progress = { entryTerm: "2023-1", sksPassed: 125 } as Progress;

  it("this term and the next, the next ones first, past ones apart", () => {
    const { upcoming, past } = academicDeadlines({ calendar, term: "2026-1", now: wib("2026-10-11T09:00:00"), krs: official(), progress });
    expect(upcoming.slice(0, 6).map((d) => [d.event.kind, d.event.firstDay, d.when])).toEqual([
      ["uts", "2026-10-12", "next"],
      ["questionnaire", "2026-11-30", "next"],
      ["lecture-end", "2026-12-04", "next"],
      ["uas", "2026-12-07", "next"],
      ["grade-deadline", "2027-01-08", "next"],
      ["progress-check", "2027-01-18", "next"],
    ]);
    expect(past.map((d) => [d.event.kind, d.event.firstDay])).toEqual([
      ["urs", "2026-09-15"],
      ["lecture-start", "2026-08-24"],
      ["ukt-deadline", "2026-08-23"],
      ["drs", "2026-08-12"],
    ]);
    // Nothing from other terms, the short semester, or "other" events.
    expect([...upcoming, ...past].every((d) => d.event.term === null || d.event.term === "2026-1" || d.event.term === "2026-2")).toBe(true);
    // The grade-change deadline "Sarjana Angkatan 2026" is for another intake.
    expect(upcoming.filter((d) => d.event.kind === "grade-change-deadline").map((d) => d.event.firstDay)).toEqual(["2027-02-04", "2027-07-23", "2027-08-04"]);
    expect(upcoming.filter((d) => d.event.kind === "grade-change-deadline").map((d) => d.variant)).toEqual([null, "non-ta", "ta"]);
  });

  it("what each one means for this Student", () => {
    const { upcoming, past } = academicDeadlines({ calendar, term: "2026-1", now: wib("2026-10-11T09:00:00"), krs: official(), bills: [bill({})], progress });
    const meaning = (kind: string, firstDay?: string) =>
      [...upcoming, ...past].find((d) => d.event.kind === kind && (!firstDay || d.event.firstDay === firstDay))?.meaning;
    expect(meaning("drs", "2026-08-12")).toEqual({ key: "deadline.drs.sent", done: true });
    expect(meaning("drs", "2027-01-20")).toEqual({ key: "deadline.drs" });
    expect(meaning("urs", "2026-09-15")).toEqual({ key: "deadline.urs.changed", done: true });
    expect(meaning("ukt-deadline", "2027-01-31")).toEqual({ key: "deadline.ukt.left", vars: { amount: "Rp5.400.000" }, warn: true });
    expect(meaning("questionnaire")).toEqual({ key: "deadline.questionnaire" });
    // Jan 2027 is in year 4 (from 2023-1): the end of year 3 expects 72 SKS.
    expect(meaning("progress-check", "2027-01-18")).toEqual({
      key: "deadline.progress.ok",
      vars: { target: 72, year: 3, passed: 125, missing: -53 },
      done: true,
    });
    const behind = academicDeadlines({ calendar, term: "2026-1", now: 0, progress: { entryTerm: "2023-1", sksPassed: 90 } as Progress });
    expect(behind.upcoming.find((d) => d.event.firstDay === "2027-08-02")?.meaning).toEqual({
      key: "deadline.progress.short",
      vars: { target: 96, year: 4, passed: 90, missing: 6 },
      warn: true,
    });
  });

  it("the progress yardstick: 24 SKS a year for five years", () => {
    expect(progressTarget("2023-1", "2024-08-05")).toEqual({ year: 1, sks: 24 });
    expect(progressTarget("2023-1", "2027-01-18")).toEqual({ year: 3, sks: 72 });
    expect(progressTarget("2023-1", "2028-08-01")).toEqual({ year: 5, sks: 120 });
    expect(progressTarget("2023-1", "2029-08-01")).toBeNull();
    expect(progressTarget("2026-1", "2027-01-18")).toBeNull();
    expect(progressTarget(null, "2027-01-18")).toBeNull();
  });

  it("nothing without a calendar or a term", () => {
    expect(academicDeadlines({ calendar: undefined, term: "2026-1", now: 0 })).toEqual({ upcoming: [], past: [] });
    expect(academicDeadlines({ calendar, term: null, now: 0 })).toEqual({ upcoming: [], past: [] });
  });
});
