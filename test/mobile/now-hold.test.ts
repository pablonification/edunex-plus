// Beranda's now card during the first read (mobile/src/screens/home/now-hold.ts): it shows what won't change and holds
// the rest in its place, so the name, the button and the line don't swap under the Student's eyes.
import { describe, expect, it } from "vitest";
import { nowHold } from "../../mobile/src/screens/home/now-hold";
import type { Course, DatasetValue } from "../../src/core/models";
import { type SixList, termCourses } from "../../src/core/term-courses";

describe("nowHold", () => {
  const reading = { reading: true, official: false, hasCard: true, sixComing: true };

  it("holds the name, the line and the button while the first read runs and the name isn't official yet", () => {
    expect(nowHold(reading)).toEqual({ name: true, line: true, shape: false });
  });

  it("shows the official name as soon as it's known, and still holds the line until the read is in", () => {
    expect(nowHold({ ...reading, official: true })).toEqual({ name: false, line: true, shape: false });
  });

  it("holds nothing once the read is in, official name or not", () => {
    expect(nowHold({ ...reading, reading: false })).toEqual({ name: false, line: false, shape: false });
    expect(nowHold({ ...reading, reading: false, official: true })).toEqual({ name: false, line: false, shape: false });
  });

  it("keeps the card's shape while there's no card yet but SIX's timetable is coming", () => {
    expect(nowHold({ ...reading, hasCard: false })).toEqual({ name: false, line: false, shape: true });
  });

  it("keeps no shape without SIX (nothing says a card is coming) or once the read is in", () => {
    expect(nowHold({ ...reading, hasCard: false, sixComing: false }).shape).toBe(false);
    expect(nowHold({ ...reading, hasCard: false, reading: false }).shape).toBe(false);
  });
});

describe("a course's official name", () => {
  // Edunex names a course (sometimes in English); SIX's list and ITB's catalog name it officially.
  const edunex = [
    { code: "PL3002", classNo: "01", name: "Economics and Innovation in Planning", term: "2026-1", edunex: { courseId: 1 } },
  ] as unknown as Course[];
  const catalog = { courses: [{ code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan" }] } as unknown as DatasetValue<"itb.catalog">;
  const six = {
    term: "2026-1",
    courses: [{ code: "PL3002", classNo: "01", name: "Ekonomi dan Inovasi dalam Perencanaan", sks: 3, attendance: null }],
  } as unknown as SixList;

  it("isn't while only Edunex names it", () => {
    expect(termCourses({ edunex, catalog: undefined, six: undefined })?.[0]).toMatchObject({ name: "Economics and Innovation in Planning", official: false });
  });

  it("is once ITB's catalog names it", () => {
    expect(termCourses({ edunex, catalog, six: undefined })?.[0]).toMatchObject({ name: "Ekonomi dan Inovasi dalam Perencanaan", official: true });
  });

  it("is once SIX lists it", () => {
    expect(termCourses({ edunex, catalog: undefined, six })?.[0]).toMatchObject({ name: "Ekonomi dan Inovasi dalam Perencanaan", official: true });
  });
});
