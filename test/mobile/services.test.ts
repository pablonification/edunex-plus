// Round 4's services (mobile/src/parts/services.tsx): every tile's colour carries its white icon at 3:1 or more in
// both themes, no two services share an icon (neighbours differ by shape, not only by colour), and "Sering kamu buka"
// (mobile/src/screens/services/frequent.ts) ranks this phone's counts, falling back to Beranda's first tiles.
// The list is read as text: the module draws with React Native, which doesn't load in Node.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { counted, FREQUENT_COUNT, frequent, readCounts } from "../../mobile/src/screens/services/frequent";

const source = readFileSync(path.resolve(import.meta.dirname, "../../mobile/src/parts/services.tsx"), "utf8");
const list = source.slice(source.indexOf("export const SERVICES"), source.indexOf("} as const satisfies"));
const entries = [...list.matchAll(/id: "(\w+)",([\s\S]*?)group: (?:"\w+"|null)/g)].map(([, id, body]) => ({
  id,
  colors: [...(body ?? "").matchAll(/(light|dark): "(#[0-9a-f]{6})"/gi)].map((m) => m[2] as string),
  icon: body?.match(/icon: \(\) => (\w+)/)?.[1],
}));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe("service tiles", () => {
  it("reads the whole list", () => {
    expect(entries.length).toBeGreaterThanOrEqual(17);
  });

  it("carries a white icon at 3:1 or more, light and dark", () => {
    for (const { id, colors } of entries) {
      if (id === "more") continue;
      expect(colors, id).toHaveLength(2);
      for (const color of colors) expect(onWhite(color), `${id} ${color}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives every service its own icon and colour", () => {
    const icons = entries.map((entry) => entry.icon);
    expect(new Set(icons).size).toBe(icons.length);
    const lights = entries.filter((entry) => entry.colors.length).map((entry) => entry.colors[0]?.toLowerCase());
    expect(new Set(lights).size).toBe(lights.length);
  });
});

describe("Sering kamu buka", () => {
  const known = ["tasks", "presence", "grades", "exams", "materials", "krs"] as const;
  const home = ["presence", "grades", "exams", "materials"] as const;

  it("shows Beranda's first four before anything is counted", () => {
    expect(frequent({}, known, home)).toEqual(["presence", "grades", "exams", "materials"]);
  });

  it("puts the most opened first and fills the rest from Beranda's", () => {
    let counts = {};
    for (const id of ["krs", "tasks", "krs"]) counts = counted(counts, id);
    expect(frequent(counts, known, home)).toEqual(["krs", "tasks", "presence", "grades"]);
  });

  it("keeps four, skipping services that are gone", () => {
    const counts = { gone: 9, tasks: 1, presence: 2, grades: 3, exams: 4, krs: 5 };
    const shown = frequent(counts, known, home);
    expect(shown).toHaveLength(FREQUENT_COUNT);
    expect(shown).toEqual(["krs", "exams", "grades", "presence"]);
  });

  it("trusts only counts from the saved file", () => {
    expect(readCounts(null)).toEqual({});
    expect(readCounts("not json")).toEqual({});
    expect(readCounts('{"krs":3,"x":"y","y":-1}')).toEqual({ krs: 3 });
  });
});
