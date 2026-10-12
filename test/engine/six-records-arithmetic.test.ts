// ITB's grade arithmetic shared by the engine and the screens (#78, #79):
// rounding as SIX shows an index, the newest grade of a retaken course, the
// target calculator's projection, and the changes the alerts are built on.
import { describe, expect, it } from "vitest";
import { checkIndex, cumulativeIndex, gradeChanges, krsChanges, projectIpk, roundIndex, termIndex } from "../../src/core/models";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { readTranscript } from "../../src/engine/sources/six/readers/transcript";
import { PretendSix } from "../pretend/six";

const TRANSCRIPT = /\/transkrip\/historis\/\d+$/;
const KRS = /\/registrasi\/rencanastudi\/\d+$/;
const transcriptOf = (six: PretendSix) => readTranscript(six.page(TRANSCRIPT), { value: 3.26, sks: 125 });
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

describe("IP and IPK", () => {
  it("rounds half up to two decimals, exactly", () => {
    expect(roundIndex(66.5, 18)).toBe(3.69);
    expect(roundIndex(25, 8)).toBe(3.13); // 3.125
    expect(roundIndex(107, 40)).toBe(2.68); // 2.675, which floating-point rounding gets wrong
    expect(roundIndex(0, 0)).toBeNull();
  });

  it("a term's IP counts every letter grade; T and missing grades count nowhere", () => {
    expect(
      termIndex([
        { sks: 3, grade: "A" },
        { sks: 2, grade: "BC" },
        { sks: 3, grade: "T" },
        { sks: 2, grade: null },
      ]),
    ).toEqual({ points: 17, sks: 5, value: 3.4 });
  });

  it("the IPK takes a retaken course's newest grade only", () => {
    expect(
      cumulativeIndex([
        { code: "II3130", sks: 3, grade: "C" },
        { code: "II3140", sks: 3, grade: "BC" },
        { code: "II3130", sks: 3, grade: "A" },
      ]),
    ).toEqual({ points: 19.5, sks: 6, value: 3.25 });
  });

  it("SIX agrees when its two decimals are a rounding of the exact value, and covers the same SKS", () => {
    const sum = { points: 25, sks: 8, value: 3.13 };
    expect(checkIndex(3.13, null, sum).agrees).toBe(true);
    expect(checkIndex(3.12, null, sum).agrees).toBe(true); // 3.125 rounded down
    expect(checkIndex(3.14, null, sum).agrees).toBe(false);
    expect(checkIndex(3.13, 9, sum).agrees).toBe(false);
    expect(checkIndex(null, null, { points: 0, sks: 0, value: null }).agrees).toBe(true);
    expect(checkIndex(null, null, sum)).toEqual({ six: null, sixSks: null, computed: 3.13, points: 25, sks: 8, agrees: false });
  });

  it("projects the IPK from target grades for this term's courses, a retake replacing the old grade", () => {
    const transcript = transcriptOf(new PretendSix(() => 0));
    const thisTerm = transcript.terms.at(-1)!.courses.map((c) => ({ code: c.code, sks: c.sks, grade: "A" as const }));
    // (408 + 4 × 14) / (125 + 14)
    expect(projectIpk(transcript, thisTerm)).toEqual({ points: 464, sks: 139, value: 3.34 });
    // II3130 again, A instead of C: (408 − 6 + 12) / 125
    expect(projectIpk(transcript, [{ code: "II3130", sks: 3, grade: "A" }])).toEqual({ points: 414, sks: 125, value: 3.31 });
  });
});

describe("what changed, for alerts", () => {
  it("new and changed grades; nothing on the first read, nothing for a grade SIX hides again", () => {
    const six = new PretendSix(() => 0);
    const before = transcriptOf(six);
    expect(gradeChanges(undefined, before)).toEqual([]);
    expect(gradeChanges(before, before)).toEqual([]);

    six.gradeCourse("2026-1", "II4091", "A");
    six.gradeCourse("2025-1", "II3130", "B");
    const after = transcriptOf(six);
    expect(gradeChanges(before, after)).toEqual([
      { term: "2025-1", code: "II3130", name: "Arsitektur Enterprise", from: "C", to: "B" },
      { term: "2026-1", code: "II4091", name: "Proposal Tugas Akhir", from: null, to: "A" },
    ]);

    six.gradeCourse("2026-1", "II4091", "");
    expect(gradeChanges(after, transcriptOf(six))).toEqual([]);
  });

  it("the plan sent, approved and made official, and its courses changed", () => {
    const six = new PretendSix(() => 0);
    six.dropKrsChange();
    six.krsStep("plan", "Pengesahan KSM", null);
    six.krsStep("plan", "Persetujuan Dosen Wali", null);
    const sent = readKrs(six.page(KRS));
    expect(krsChanges(undefined, sent)).toEqual([]);

    six.krsStep("plan", "Persetujuan Dosen Wali", "18 Agu 2026 14.39.32");
    six.krsCourse("PL3032", "remove");
    six.krsCourse("DK4073", { classNo: "02" });
    six.krsCourse("KU5014", { approved: false });
    expect(krsChanges(sent, readKrs(six.page(KRS)))).toEqual([
      { kind: "approved", round: "plan", at: wib("2026-08-18T14:39:32") },
      { kind: "course-changed", code: "DK4073", name: "Komunikasi Pemasaran", classNo: "02", sks: 3, approved: true },
      { kind: "course-changed", code: "KU5014", name: "Teknik Penyelesaian Masalah Terstruktur", classNo: "01", sks: 3, approved: false },
      { kind: "course-removed", code: "PL3032", name: "Ekonomi Infrastruktur dan Transportasi" },
    ]);
  });

  it("the change round (URS) approved, and a new term's plan counted from empty", () => {
    const six = new PretendSix(() => 0);
    six.krsStep("change", "Persetujuan Dosen Wali", null);
    six.krsStep("change", "Pengesahan KSM Pengganti", null);
    const waiting = readKrs(six.page(KRS));
    const approved = readKrs(new PretendSix(() => 0).page(KRS));
    expect(krsChanges(waiting, approved)).toEqual([
      { kind: "approved", round: "change", at: wib("2026-09-15T19:18:25") },
      { kind: "legalized", round: "change", at: wib("2026-09-16T11:02:56") },
    ]);

    const lastTerm = { ...approved, term: "2025-2" };
    expect(krsChanges(lastTerm, approved).map((c) => c.kind)).toEqual([
      "sent",
      "approved",
      "legalized",
      "sent",
      "approved",
      "legalized",
      "course-added",
      "course-added",
      "course-added",
      "course-added",
      "course-added",
    ]);
  });
});
