// #85, feedback 6: Presensi's answer on its own: the courses by name and the
// action, worst first, in Indonesian and English; when all is fine, which
// course is closest.
import { describe, expect, it } from "vitest";
import type { AttendanceHealth, AttendanceState } from "../../src/core/attendance";
import { attendanceAnswer } from "../../src/core/attendance-answer";
import { type Lang, translate } from "../../src/core/strings";

/** A course's attendance as attendanceHealth gives it; only what the answer reads matters. */
function course(code: string, state: AttendanceState, absencesLeft: number | null, target = 80): AttendanceHealth {
  return {
    code,
    target,
    state,
    absencesLeft,
    countedIn: "six",
    attended: 4,
    held: 6,
    best: null,
    toRecover: null,
    needsUncertain: false,
    left: { count: 7, estimated: false, next: null, upcoming: [] },
    edunexClosed: 0,
    edunexRecorded: 0,
  };
}

const answer = (courses: AttendanceHealth[], lang: Lang = "id") =>
  attendanceAnswer(
    courses,
    (key, vars) => translate(lang, key, vars),
    (items) => new Intl.ListFormat(lang, { type: "conjunction" }).format(items),
  );

describe("Presensi's answer", () => {
  it("names the courses and what to do, worst first: no absences left, then out of reach, then one left", () => {
    const courses = [
      course("PL3002", "risk", 1),
      course("KU5014", "out", -2),
      course("II4091", "safe", 2),
      course("DK4073", "none", 0),
      course("PL3032", "none", 0),
    ];
    expect(answer(courses)).toEqual([
      { tone: "warning", text: "Jangan absen lagi di DK4073 dan PL3032." },
      { tone: "danger", text: "KU5014 sudah tak bisa capai 80%." },
      { tone: "warning", text: "Jatah absen di PL3002 tinggal 1×." },
    ]);
    expect(answer(courses, "en").map((line) => line.text)).toEqual([
      "Don't miss another class in DK4073 and PL3032.",
      "KU5014 can't reach 80% anymore.",
      "Only one absence left in PL3002.",
    ]);
  });

  it("each course is out of reach of its own target", () => {
    expect(answer([course("KU5014", "out", -1), course("DK4073", "out", -1, 90), course("PL3032", "out", -3)]).map((line) => line.text)).toEqual([
      "KU5014 dan PL3032 sudah tak bisa capai 80%.",
      "DK4073 sudah tak bisa capai 90%.",
    ]);
  });

  it("below the target for now, with absences to spare by the end of term: keep attending", () => {
    expect(answer([course("II3120", "risk", 3)])).toEqual([{ tone: "warning", text: "II3120 di bawah target sekarang: hadir terus untuk naik lagi." }]);
    expect(answer([course("II3120", "risk", 3)], "en")[0].text).toBe("II3120 is below target for now: keep attending to get back.");
  });

  it("all fine: says so, and which course has the least room", () => {
    const courses = [course("II4091", "safe", 4), course("PL3002", "safe", 2), course("DK4073", "unknown", null)];
    expect(answer(courses)).toEqual([{ tone: "success", text: "Semua aman. Paling mepet PL3002: masih bisa absen 2× lagi." }]);
    expect(answer(courses, "en")[0].text).toBe("All good. The closest is PL3002: you can miss 2 more classes.");
  });

  it("nothing to say before SIX has a count", () => {
    expect(answer([course("DK4073", "unknown", null), course("PL3002", "unknown", null)])).toEqual([]);
    expect(answer([])).toEqual([]);
  });
});
