// Beranda's strip says each fact once (round 4): what's due today, or this week, counted from "Perlu kamu urus"'s rows;
// and Beranda's "Perlu kamu urus" leaves out what the strip counts (mobile/src/screens/home/strip-facts.ts).
import { describe, expect, it } from "vitest";
import { stripFacts, stripSays } from "../../mobile/src/screens/home/strip-facts";
import type { UrusRow } from "../../mobile/src/screens/home/urus";
import type { Need } from "../../src/core/needs";

const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const now = wib("2026-11-10T09:00:00");

const task = (id: string, at: number, late = false): UrusRow =>
  ({
    kind: "todo",
    key: id,
    item: { need: { id, kind: "task" }, code: null, title: id, when: "", late, presence: null, presenceTag: false, course: "", at },
  }) as unknown as UrusRow;
const absence = { kind: "absence", key: "absence:KU5014", item: { code: "KU5014", health: { state: "out" } } } as unknown as UrusRow;
const clash = { kind: "clash", key: "clash:a+b:1", item: {} } as unknown as UrusRow;

describe("Beranda's strip", () => {
  it("counts what's due today when something is, and Perlu kamu urus keeps the rest of the week", () => {
    const rows = [absence, clash, task("tonight", wib("2026-11-10T23:59:00")), task("friday", wib("2026-11-13T23:59:00"))];
    const facts = stripFacts(rows, [], now);
    expect([...facts.due]).toEqual(["tonight"]);
    expect(facts.today).toBe(true);
    expect(rows.filter((row) => !stripSays(facts, row)).map((row) => row.key)).toEqual(["clash:a+b:1", "friday"]);
  });

  it("counts the week with nothing due today, and nothing past seven days", () => {
    const rows = [task("friday", wib("2026-11-13T23:59:00")), task("later", wib("2026-11-20T23:59:00"))];
    const facts = stripFacts(rows, [], now);
    expect([...facts.due]).toEqual(["friday"]);
    expect(facts.today).toBe(false);
    expect(rows.filter((row) => !stripSays(facts, row)).map((row) => row.key)).toEqual(["later"]);
  });

  it("says 0 with nothing due this week, and leaves the next exam to the strip", () => {
    const exam = { id: "uts", kind: "exam", at: null, sitting: { start: wib("2026-11-17T08:00:00"), end: null } } as unknown as Need;
    const row = { kind: "todo", key: "uts", item: { need: exam, late: false, presenceTag: false, at: wib("2026-11-17T08:00:00") } } as unknown as UrusRow;
    const facts = stripFacts([row], [exam], now);
    expect(facts.due.size).toBe(0);
    expect(facts.exam?.need.id).toBe("uts");
    expect(stripSays(facts, row)).toBe(true);
  });
});
