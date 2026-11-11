// "Sembunyikan nilai": what a figure prints and a screen reader hears while grades are hidden, the setting kept and
// read (off by default, hidden until known), and a new grade's notification without the grade or the IPK.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { noticeContent } from "../../mobile/src/host/booking";
import { endRoomFor } from "../../mobile/src/screens/plan/chart-room";
import { segmentLines } from "../../mobile/src/ui/segment-lines";
import { gradesHidden, HIDDEN_FIGURE, shownFigure, withoutGrades } from "../../src/core/hide-grades";
import { DEFAULT_SETTINGS, Settings } from "../../src/core/models";
import { translate } from "../../src/core/strings";

vi.mock("../../src/core/strings/wording", async () => ({ wording: (await import("../../src/core/strings/wording.native")).wording }));

const said = (name: string) => translate("id", "mobile.hideGrades.said", { name });

describe("hiding grades", () => {
  it("a figure shown prints itself; hidden, it prints dots and is said as hidden, the number nowhere", () => {
    expect(shownFigure("3,42", "IPK", false, said)).toEqual({ text: "3,42", label: "IPK 3,42" });
    const hidden = shownFigure("3,42", "IPK", true, said);
    expect(hidden).toEqual({ text: HIDDEN_FIGURE, label: "IPK disembunyikan" });
    expect(JSON.stringify(hidden)).not.toContain("3,42");
  });

  it("is off by default, kept in the settings, and hidden until the settings are known", () => {
    expect(DEFAULT_SETTINGS.hideGrades).toBe(false);
    expect(gradesHidden(DEFAULT_SETTINGS)).toBe(false);
    expect(gradesHidden(Settings.parse({ ...DEFAULT_SETTINGS, hideGrades: true }))).toBe(true);
    // Settings saved before the feature have no such field: shown.
    const { hideGrades: _none, ...older } = DEFAULT_SETTINGS;
    expect(gradesHidden(Settings.parse(older))).toBe(false);
    expect(gradesHidden(null)).toBe(true);
  });

  const grade = {
    id: "grade:20261:IF2110:AB",
    kind: "grade" as const,
    source: "six" as const,
    title: { key: "alert.grade.new" as const, vars: { course: "IF2110", grade: "AB" } },
    body: { key: "alert.grade.body" as const, vars: { name: "Algoritme dan Pemrograman", ipk: "3.42" } },
    target: { screen: "grades" as const },
  };

  it("a new grade's notification says the grade and the IPK while shown", () => {
    expect(noticeContent(grade, "id")).toMatchObject({ title: "Nilai baru · IF2110: AB", body: "Algoritme dan Pemrograman · IPK sekarang 3.42" });
  });

  it("hidden, it names the course only: no grade, no IPK, in either language", () => {
    expect(noticeContent(grade, "id", false, true)).toMatchObject({ title: "Nilai baru · IF2110", body: "Algoritme dan Pemrograman" });
    expect(noticeContent(grade, "en", false, true)).toMatchObject({ title: "New grade · IF2110", body: "Algoritme dan Pemrograman" });
    const changed = { ...grade, title: { key: "alert.grade.changed" as const, vars: { course: "IF2110", from: "B", grade: "AB" } } };
    const words = JSON.stringify(noticeContent(changed, "id", false, true));
    expect(words).toContain("Nilai berubah · IF2110");
    expect(words).not.toMatch(/AB|3\.42|→/);
  });

  it("leaves every other alert as it was", () => {
    const task = { title: { key: "alert.newTask" as const, vars: { course: "IF2110" } } };
    expect(withoutGrades(task)).toBe(task);
  });
});

describe("the chart's room at its end", () => {
  const width = (text: string) => text.length * 7 + 10;
  it("a label that fits takes its own width", () => {
    expect(endRoomFor(600, "3,54 saat lulus", "3,54", width)).toBe(width("3,54 saat lulus"));
  });
  it("a label that doesn't fit gives way to its figure, and the plot takes the rest: no empty band", () => {
    expect(endRoomFor(330, "3.54 at graduation", "3.54", width)).toBe(width("3.54"));
  });
  it("no end label, no room kept", () => {
    expect(endRoomFor(330, undefined, "3.54", width)).toBe(0);
  });
});

describe("a segment's label", () => {
  it("a number or a single word keeps to one line; words may take two", () => {
    expect(segmentLines("3,50")).toBe(1);
    expect(segmentLines("3.75")).toBe(1);
    expect(segmentLines("Minggu")).toBe(1);
    expect(segmentLines("Kalender lengkap")).toBe(2);
  });
});

// The screens aren't drawn in tests here (no React Native), so, as test/mobile/touch-targets.test.ts does, their source
// is read: every phone file that prints a grade asks whether grades are hidden.
describe("on the screens", () => {
  const read = (file: string) => readFileSync(path.resolve(import.meta.dirname, "../../mobile", file), "utf8");
  const PRINTS_A_GRADE = [
    "src/screens/academic/academic-screen.tsx",
    "src/parts/standing.tsx",
    "src/screens/grades/grades-screen.tsx",
    "src/screens/grades/transcript.tsx",
    "src/screens/course/grades.tsx",
    "src/screens/home/grid.tsx",
    "src/screens/services/tags.ts",
    "src/screens/plan/projection.tsx",
    "src/screens/plan/planner-outlook.tsx",
    "src/screens/plan/planner-summary.tsx",
    "src/screens/plan/planner-term.tsx",
    "src/screens/plan/planner-add.tsx",
    "src/screens/plan/planner-minors.tsx",
    "src/screens/plan/planner.tsx",
    "src/screens/plan/curriculum.tsx",
    "src/screens/first-scan/first-scan-screen.tsx",
    "src/screens/tasks/rows.tsx",
    "src/screens/tasks/hand-in.tsx",
    "src/screens/home/changes.tsx",
    "app/alerts.tsx",
  ];
  it.each(PRINTS_A_GRADE)("%s asks whether grades are hidden", (file) => {
    expect(read(file)).toMatch(/useGradesHidden|useGradeWords/);
  });

  it("Profil's card and Nilai's big number: dots in the number's place while hidden, the number only when shown, the eye beside it", () => {
    for (const file of ["src/screens/academic/academic-screen.tsx", "src/screens/grades/grades-screen.tsx"]) {
      const source = read(file);
      // The counting number sits in the branch after `hidden ? <HiddenFigure`: hidden, it is never mounted, so it can't count up to the value.
      expect(source).toMatch(/hidden \? \(\s*(\/\/[^\n]*\n\s*)?<HiddenFigure[^>]*\/>\s*\) : \(\s*<(RollTo|Figure) /);
      expect(source).toContain("<HideGradesButton");
    }
  });

  it("the phone's notifier is told whether grades are hidden, and hides until the settings are known", () => {
    const host = read("src/host/host.ts");
    expect(host).toContain("let hideGrades = true;");
    expect(host).toContain("hideGrades = gradesHidden(event.settings)");
  });
});
