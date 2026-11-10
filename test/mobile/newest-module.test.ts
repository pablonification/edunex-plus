// A course's page shows the way to this week's material: "Modul terbaru: {title}" under its header when something new
// came to a module in the last 7 days (mobile/src/screens/course/contents.ts newestEntry).
import { describe, expect, it } from "vitest";
import { type Entry, newestEntry } from "../../mobile/src/screens/course/contents";
import type { Material } from "../../src/core/models";

const DAY = 86_400_000;
const now = Date.parse("2026-11-10T10:00:00+07:00");

const entry = (id: string, posted: number | null, unopened = false): Entry => ({
  id,
  label: id,
  title: `Modul ${id}`,
  intro: false,
  parent: false,
  unopened,
  opensAt: null,
  postedAt: null,
  tasks: [],
  materials: posted === null ? [] : [{ id: Number(id), postedAt: posted, updatedAt: null } as unknown as Material],
});

describe("newestEntry", () => {
  it("picks the module with the newest material from the last 7 days", () => {
    expect(newestEntry([entry("1", now - 6 * DAY), entry("2", now - DAY), entry("3", null)], now)?.id).toBe("2");
  });

  it("nothing when everything is older than a week, or only in a module not opened yet", () => {
    expect(newestEntry([entry("1", now - 8 * DAY), entry("2", null)], now)).toBeUndefined();
    expect(newestEntry([entry("1", now - DAY, true)], now)).toBeUndefined();
  });
});
