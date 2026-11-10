// Round 4's services (mobile/src/parts/services.tsx): colour means the group (every service in a group shares its
// group's one colour, each carrying a white icon at 3:1 or more in both themes), no two services share an icon (inside a
// group, shape tells them apart), Beranda's grid reads by group, and "Sering kamu buka"
// (mobile/src/screens/services/frequent.ts) shows only this phone's real counts, once there are enough.
// The list is read as text: the module draws with React Native, which doesn't load in Node.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { counted, FREQUENT_AFTER, FREQUENT_COUNT, frequent, readCounts } from "../../mobile/src/screens/services/frequent";

const source = readFileSync(path.resolve(import.meta.dirname, "../../mobile/src/parts/services.tsx"), "utf8");
const list = source.slice(source.indexOf("export const SERVICES"), source.indexOf("} as const satisfies"));
const entries = [...list.matchAll(/id: "(\w+)",([\s\S]*?)group: (?:"(\w+)"|null)/g)].map(([, id, body, group]) => ({
  id: id as string,
  icon: body?.match(/icon: \(\) => (\w+)/)?.[1],
  group,
}));
const palette = source.slice(source.indexOf("export const GROUP_COLORS"), source.indexOf("export interface Service"));
const groupColors = Object.fromEntries(
  [...palette.matchAll(/(\w+): \{ light: "(#[0-9a-f]{6})", dark: "(#[0-9a-f]{6})" \}/gi)].map(([, group, light, dark]) => [group, [light, dark]]),
);
const homeGrid = [...(source.match(/export const HOME_GRID[^=]*= \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"(\w+)"/g)].map((m) => m[1]);

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
    expect(entries.length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(groupColors).sort()).toEqual(["academic", "admin", "courses", "web"]);
  });

  it("gives each group one colour, a white icon on it at 3:1 or more, light and dark", () => {
    for (const [group, colors] of Object.entries(groupColors)) {
      for (const color of colors) expect(onWhite(color), `${group} ${color}`).toBeGreaterThanOrEqual(3);
    }
    const lights = Object.values(groupColors).map(([light]) => light?.toLowerCase());
    expect(new Set(lights).size).toBe(lights.length);
    for (const { id, group } of entries) {
      if (id === "more") expect(group, id).toBeUndefined();
      else expect(groupColors[group ?? ""], id).toBeDefined();
    }
  });

  it("gives every service its own icon", () => {
    const icons = entries.map((entry) => entry.icon);
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("lists no tile that only repeats a bottom tab", () => {
    for (const id of ["tasks", "schedule", "month"]) expect(entries.map((entry) => entry.id)).not.toContain(id);
  });

  it("orders Beranda's 8 tiles by group, Lainnya last", () => {
    expect(homeGrid).toHaveLength(8);
    expect(homeGrid.at(-1)).toBe("more");
    const order = ["courses", "academic", "admin"];
    const ranks = homeGrid.slice(0, -1).map((id) => order.indexOf(entries.find((entry) => entry.id === id)?.group ?? ""));
    expect(ranks.every((rank) => rank >= 0)).toBe(true);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("Sering kamu buka", () => {
  const known = ["presence", "materials", "exams", "grades", "krs", "calendar"] as const;

  it("isn't there until the phone has counted enough opens", () => {
    expect(frequent({}, known)).toEqual([]);
    expect(frequent({ krs: FREQUENT_AFTER - 1 }, known)).toEqual([]);
    expect(frequent({ krs: 2, gone: 9, grades: 1 }, known)).toEqual([]);
  });

  it("shows only what was counted, most opened first", () => {
    let counts = {};
    for (const id of ["krs", "grades", "krs", "krs", "grades"]) counts = counted(counts, id);
    expect(frequent(counts, known)).toEqual(["krs", "grades"]);
  });

  it("keeps four at most, skipping services that are gone", () => {
    const counts = { gone: 9, presence: 1, materials: 2, exams: 3, grades: 4, krs: 5 };
    const shown = frequent(counts, known);
    expect(shown).toHaveLength(FREQUENT_COUNT);
    expect(shown).toEqual(["krs", "grades", "exams", "materials"]);
  });

  it("trusts only counts from the saved file", () => {
    expect(readCounts(null)).toEqual({});
    expect(readCounts("not json")).toEqual({});
    expect(readCounts('{"krs":3,"x":"y","y":-1}')).toEqual({ krs: 3 });
  });
});
