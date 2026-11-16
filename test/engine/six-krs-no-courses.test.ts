// #371: a Student who hasn't picked a course for the term yet. SIX shows "Belum ada mata kuliah yang diambil" where
// the course table goes, so the page has no course table: that's an empty plan, not a page SIX changed.
import { describe, expect, it } from "vitest";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { Skipped } from "../../src/engine/sources/skipped";
import { bodyText } from "../kit/fixtures";

const html = bodyText("six", "report-krs-tables-registrasi-rencanastudi-2021000001.html");

describe("a study plan with no course yet (#371)", () => {
  it("reads as not sent, with no courses, nothing left out", () => {
    const skipped = new Skipped();
    const plan = readKrs(html, skipped);
    expect(skipped.rows).toEqual([]);
    expect(plan).toMatchObject({ state: "not-sent", courses: [], sks: 0 });
    expect(plan.term).toBeTruthy();
  });

  it("still says SIX changed when the course panel is gone too", () => {
    const gone = html.replace(/<form [^>]*action="[^"]*\/registrasi\/rencanastudi\/[\s\S]*?<\/form>/, "");
    expect(gone).not.toContain("Daftar Mata Kuliah");
    expect(() => readKrs(gone)).toThrow(/its tables moved/);
  });

  it("still says SIX changed when the course panel holds something other than a note", () => {
    const odd = html
      .replace(/Belum ada mata kuliah yang diambil/, "")
      .replace(/(Daftar Mata Kuliah<\/h3><\/div><div class="panel-body">)<div class="alert alert-warning">/, "$1<div>");
    expect(() => readKrs(odd)).toThrow(/its tables moved/);
  });
});
