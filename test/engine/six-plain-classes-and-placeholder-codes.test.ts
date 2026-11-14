// Two Students' SIX pages the app left rows of out, read from their scrubbed reports:
// #360: a class SIX greys out without a link to its meeting (OS2002, run by another program) is a class all the same;
// #361, #362: a required course whose code isn't set yet ("KL4XYZ Capstone Design") is a course, in the curriculum and in
// the Student's curriculum position.
import { describe, expect, it } from "vitest";
import { checkingIn } from "../../src/core/check-in";
import { readCurriculumStructure } from "../../src/engine/sources/six/readers/curriculum-structure";
import { readProgress } from "../../src/engine/sources/six/readers/progress";
import { readTimetable } from "../../src/engine/sources/six/timetable";
import { Skipped } from "../../src/engine/sources/skipped";
import { bodyText } from "../kit/fixtures";

describe("a class SIX shows without a link (#360)", () => {
  const html = bodyText("six", "report-unlinked-class-kelas-jadwal-mahasiswa-2021000001-bulan-202611.html");

  it("is read from its text, with no meeting to open, and nothing is left out", () => {
    const skipped = new Skipped();
    const page = readTimetable(html, "202611", skipped);
    expect(skipped.rows).toEqual([]);
    expect(page.unread).toEqual([]);
    const plain = page.sessions.filter((s) => s.courseCode === "OS2002");
    expect(plain.length).toBeGreaterThan(0);
    expect(plain[0]).toEqual({
      id: `nolink:OS2002:${Date.parse("2026-11-03T10:00:00+07:00")}`,
      courseCode: "OS2002",
      courseName: "Ekowisata Bahari",
      start: Date.parse("2026-11-03T10:00:00+07:00"),
      end: Date.parse("2026-11-03T12:00:00+07:00"),
      activity: "Kuliah",
      room: "9822",
      noMeeting: true,
    });
    // Its ids are its own, one per class.
    expect(new Set(plain.map((s) => s.id)).size).toBe(plain.length);
    // The linked classes read as before.
    expect(page.sessions.find((s) => s.courseCode === "KL2103")?.noMeeting).toBeUndefined();
  });

  it("has no 'Tandai Hadir' to read or press, even while it's on", () => {
    const session = readTimetable(html, "202611").sessions.find((s) => s.courseCode === "OS2002")!;
    expect(checkingIn(session, session.start + 60_000)).toBe(false);
    expect(checkingIn({ ...session, noMeeting: undefined }, session.start + 60_000)).toBe(true);
  });
});

describe("a course whose code isn't set yet (#361)", () => {
  it("reads KL4XYZ Capstone Design as a required course and in the catalog, nothing left out", () => {
    const skipped = new Skipped();
    const structure = readCurriculumStructure(bodyText("six", "report-placeholder-code-kurikulum-kurikulum-1037-struktur.html"), skipped);
    expect(skipped.rows).toEqual([]);
    expect(structure.required.find((c) => c.code === "KL4XYZ")).toMatchObject({ name: "Capstone Design", sks: 3, semester: 7 });
    expect(structure.catalog.find((c) => c.code === "KL4XYZ")).toMatchObject({ name: "Capstone Design", sks: 3 });
  });
});

describe("the same course in the Student's curriculum position (#362)", () => {
  it("reads KL4XYZ as still to take, nothing left out", () => {
    const skipped = new Skipped();
    const { progress } = readProgress(bodyText("six", "report-placeholder-progress-statusmhs-transkrip-kurikulum-2021000001.html"), skipped);
    expect(skipped.rows).toEqual([]);
    const course = progress.stages.flatMap((st) => st.semesters.flatMap((sem) => sem.courses)).find((c) => c.code === "KL4XYZ");
    expect(course).toMatchObject({ name: "Capstone Design", status: "not-taken" });
  });
});

describe("a code with its X within (#367)", () => {
  it("reads AE40X0 Metode Komputasi Dirgantara as a course, nothing left out", () => {
    const skipped = new Skipped();
    const structure = readCurriculumStructure(bodyText("six", "report-placeholder-x-kurikulum-kurikulum-1027-struktur.html"), skipped);
    expect(skipped.rows).toEqual([]);
    const all = [
      ...structure.required,
      ...structure.catalog,
      ...structure.specializations.flatMap((p) => p.courses),
      ...structure.minors.flatMap((p) => p.courses),
    ];
    expect(all.find((c) => c.code === "AE40X0")).toMatchObject({ name: "Metode Komputasi Dirgantara", sks: 3 });
  });
});
