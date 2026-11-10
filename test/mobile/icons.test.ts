// The phone's icons are Fluent's (mobile/src/ui/icons.tsx, data in mobile/src/ui/fluent/ from
// mobile/scripts/make-ui-icons.mjs): every icon the app names has a drawing, regular and filled, at sizes Fluent drew;
// the app carries no icon it doesn't name; each draws the form nearest the size it shows at; and the bottom tabs have
// their five drawables, at rest and picked (mobile/scripts/make-tab-icons.mjs).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type Drawn, nearest } from "../../mobile/src/ui/icon-size";

const MOBILE = path.resolve(import.meta.dirname, "../../mobile");
const UI = path.join(MOBILE, "src/ui");
const source = fs.readFileSync(path.join(UI, "icons.tsx"), "utf8");
/** Each import's local name → its file in ./fluent. */
const imports = new Map([...source.matchAll(/^import (\w+) from "\.\/fluent\/([\w-]+)";$/gm)].map((m) => [m[1], m[2]]));

/** Every entry of one exported set: its name and the drawings it names. */
function entries(set: "Icons" | "ServiceIcons"): [name: string, files: string[]][] {
  const start = source.indexOf(`export const ${set} = {`);
  const block = source.slice(start, source.indexOf("\n};", start));
  return [...block.matchAll(/^ {2}(\w+): icon\((.*)\),?$/gm)].map((m) => [
    m[1],
    [...m[2].matchAll(/\b(\w+)\b/g)]
      .map((w) => w[1])
      .filter((w) => imports.has(w))
      .map((w) => imports.get(w) as string),
  ]);
}

async function drawn(file: string): Promise<Drawn> {
  return (await import(path.join(UI, "fluent", `${file}.ts`))).default;
}

describe("the phone's icons", () => {
  for (const set of ["Icons", "ServiceIcons"] as const) {
    it(`every one of ${set} has Fluent's path data, regular and filled`, async () => {
      const all = entries(set);
      expect(all.length).toBeGreaterThan(set === "Icons" ? 70 : 18);
      for (const [name, files] of all) {
        expect(files, name).not.toHaveLength(0);
        for (const file of files) {
          const rows = await drawn(file);
          expect(rows.length, `${name} (${file})`).toBeGreaterThan(0);
          for (const [size, regular, filled] of rows) {
            expect([12, 16, 20, 24, 28, 32, 48], `${name} (${file})`).toContain(size);
            expect(regular, `${name} (${file}) ${size} regular`).toMatch(/^[Mm][\d.\s,-]/);
            expect(filled, `${name} (${file}) ${size} filled`).toMatch(/^[Mm][\d.\s,-]/);
          }
        }
      }
    });
  }

  it("carries only the icons it names", () => {
    const files = fs.readdirSync(path.join(UI, "fluent")).map((f) => f.replace(/\.ts$/, ""));
    expect(files.sort()).toEqual([...new Set(imports.values())].sort());
  });

  it("the services' grid has its icons at 24, 28 and 32 px (or the nearest Fluent drew)", () => {
    const names = entries("ServiceIcons").map(([name]) => name);
    for (const name of ["Schedule", "Tasks", "Courses", "Attendance", "Grades", "Exams", "Materials", "Krs", "Bills"]) expect(names).toContain(name);
    for (const name of ["AcademicCalendar", "StudyPlan", "Transcript", "Notifications", "Settings", "Search", "More", "Curriculum", "Files", "Profile"])
      expect(names).toContain(name);
  });

  it("draws the form made for the size nearest the one it shows at", () => {
    const rows: Drawn = [
      [16, "M16r", "M16f"],
      [20, "M20r", "M20f"],
      [24, "M24r", "M24f"],
      [32, "M32r", "M32f"],
    ];
    expect(nearest(rows, 12)[0]).toBe(16);
    expect(nearest(rows, 16)[0]).toBe(16);
    expect(nearest(rows, 18)[0]).toBe(20); // between two, the bigger
    expect(nearest(rows, 22)[0]).toBe(24);
    expect(nearest(rows, 28)[0]).toBe(32);
    expect(nearest(rows, 64)[0]).toBe(32);
  });
});

describe("the bottom tabs' icons", () => {
  it("are five drawables, at rest and picked, Fluent's at 24 px", () => {
    const dir = path.join(MOBILE, "assets/tab-icons");
    const names = ["home", "schedule", "tasks", "courses", "profile"].flatMap((n) => [`tab_${n}.xml`, `tab_${n}_filled.xml`]);
    expect(
      fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".xml"))
        .sort(),
    ).toEqual(names.sort());
    for (const file of names) {
      const xml = fs.readFileSync(path.join(dir, file), "utf8");
      expect(xml, file).toContain('android:viewportWidth="24"');
      expect(xml, file).toMatch(/android:pathData="[Mm][^"]+"/);
    }
  });
});
