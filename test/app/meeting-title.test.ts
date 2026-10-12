// What a meeting is called on the Pertemuan tab and on the card above it:
// the module posted for it, its own name, Edunex's number, and "Kuliah" only
// when nothing says more (SIX calls nearly every class "Kuliah").
import { describe, expect, it } from "vitest";
import { meetingTitle } from "../../src/app/screens/course/meetings";
import type { Meeting } from "../../src/core/course-meetings";
import { translate } from "../../src/core/strings";

const t = ((key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate("id", key, vars)) as Parameters<typeof meetingTitle>[0];
const AT = Date.parse("2026-10-16T15:00:00+07:00");
const meeting = (parts: { activity?: string; number?: number; topic?: string }): Meeting => ({
  key: "s1",
  start: AT,
  end: AT + 2 * 3_600_000,
  six: parts.activity
    ? { id: "1", courseCode: "II4091", courseName: "Proposal Tugas Akhir", start: AT, end: AT + 7_200_000, activity: parts.activity, room: null }
    : null,
  presence: parts.topic ? ({ topic: parts.topic } as Meeting["presence"]) : null,
  announced: parts.number ? { number: parts.number, start: AT, end: AT + 7_200_000, note: null, online: true, link: null } : null,
  notInSix: false,
});

describe("a meeting's title", () => {
  it('is Edunex\'s number for a class SIX only calls "Kuliah"', () => {
    expect(meetingTitle(t, meeting({ activity: "Kuliah", number: 4 }), null)).toBe("Pertemuan 4");
  });

  it('is still "Kuliah" when nothing says more, and a real name or module wins', () => {
    expect(meetingTitle(t, meeting({ activity: "Kuliah" }), null)).toBe("Kuliah");
    expect(meetingTitle(t, meeting({}), null)).toBe("Kuliah");
    expect(meetingTitle(t, meeting({ activity: "Praktikum", number: 4 }), null)).toBe("Praktikum");
    expect(meetingTitle(t, meeting({ topic: "Presentasi Proposal", activity: "Kuliah", number: 4 }), null)).toBe("Presentasi Proposal");
    expect(meetingTitle(t, meeting({ activity: "Kuliah" }), "Modul 7 · Inovasi Pelayanan Publik")).toBe("Modul 7 · Inovasi Pelayanan Publik");
  });
});
