// Notifikasi: a meeting Edunex announced and its Teams link or material posted close by are one row
// (mobile/src/screens/alerts/same-meeting.ts); when unsure, both rows stay.
import { describe, expect, it } from "vitest";
import { sameMeeting } from "../../mobile/src/screens/alerts/same-meeting";
import type { Alert } from "../../src/core/models";

const HOUR = 3_600_000;
const at = Date.parse("2026-10-07T10:00:00+07:00");

const meeting = (code = "II4091", number = 3, when = at): Alert => ({
  id: `meeting:${code}:${number}`,
  kind: "meeting",
  source: "edunex",
  at: when,
  title: { key: "home.change.meeting", vars: { course: code, number } },
  body: { key: "home.change.meeting.body", vars: {} },
  target: { screen: "course", code, tab: "meetings" },
});
const material = (title: string, code = "II4091", when = at + HOUR, id = title): Alert => ({
  id: `material:${id}`,
  kind: "newMaterial",
  source: "edunex",
  at: when,
  title: { key: "alert.newMaterial", vars: { course: code } },
  body: { key: "alert.plain", vars: { title } },
  target: { screen: "course", code, tab: "modules", module: 7 },
});

describe("sameMeeting", () => {
  it("folds the Teams link for the same course and meeting into the meeting's row, as a new link", () => {
    const link = material("Link Teams Pertemuan 03: Jumat, 9 Oktober 2026");
    const { folded, joined } = sameMeeting([meeting(), link]);
    expect([...folded]).toEqual([link.id]);
    expect(joined.get("meeting:II4091:3")).toEqual({ material: link, extra: "link" });
  });

  it("a file for that meeting reads as new material", () => {
    const slides = material("Slide Pertemuan 3 - Proposal");
    expect(sameMeeting([meeting(), slides]).joined.get("meeting:II4091:3")?.extra).toBe("material");
  });

  it("keeps both rows when unsure: another course, another meeting, no number, or days apart", () => {
    for (const other of [
      material("Link Teams Pertemuan 03", "DK4073"),
      material("Link Teams Pertemuan 04"),
      material("Link Teams kuliah"),
      material("Link Teams Pertemuan 03", "II4091", at + 4 * 24 * HOUR),
    ])
      expect(sameMeeting([meeting(), other]).folded.size).toBe(0);
  });
});
