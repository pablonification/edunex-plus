import { describe, expect, it } from "vitest";
import { withFields, withItem } from "./builder";
import { edunexJson, exchanges, publicPage, sixPage } from "./fixtures";

interface TaskList {
  data: { id: number; attributes: { end_at: string; name: string; answers: { is_sent: number; score: number }[] } }[];
}

describe("test kit", () => {
  it("serves recorded Edunex responses and SIX pages", () => {
    expect(exchanges("edunex").length).toBeGreaterThan(50);
    expect(edunexJson<{ name: string }>("/login/me").name).toBe("Dimas Pratama");
    expect(sixPage(/\/statusmhs$/)).toContain("Indeks Prestasi Kumulatif");
    expect(publicPage("kur2024-182")).toContain("Sistem dan Teknologi Informasi");
  });

  it("changes only the chosen fields of a recorded record", () => {
    const tasks = edunexJson<TaskList>("/course/tasks", { "filter[course_id][is]": "95326" });
    const original = tasks.data[0];
    const moved = withFields(original, { attributes: { end_at: "2026-10-20T23:59:00+07:00" } });
    expect(moved.attributes.end_at).toBe("2026-10-20T23:59:00+07:00");
    expect(moved.attributes.name).toBe(original.attributes.name);
    expect(moved).not.toBe(original);
    expect(original.attributes.end_at).not.toBe("2026-10-20T23:59:00+07:00");
  });

  it("changes one item in a recorded list", () => {
    const tasks = edunexJson<TaskList>("/course/tasks", { "filter[course_id][is]": "95326" });
    const target = tasks.data[1].id;
    const changed = withItem(tasks.data, (t) => t.id === target, { attributes: { name: "Renamed" } });
    expect(changed.find((t) => t.id === target)?.attributes.name).toBe("Renamed");
    expect(changed.filter((t) => t.attributes.name === "Renamed")).toHaveLength(1);
  });
});
