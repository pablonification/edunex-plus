// The course page's "now" (audit B §1.11, §1.16): an online meeting's join
// link from the class's own announcements, the next meeting, and a clash with
// another course's class.
import { describe, expect, it } from "vitest";
import { announcedMeetings, clashes, classMeetingLink, meetingLinks, nextMeetingIndex } from "../../src/core/course-meetings";
import type { Announcement, ClassSession } from "../../src/core/models";

const at = (iso: string) => Date.parse(iso);
const post = (id: number, text: string, postedAt: string): Announcement => ({ id, courseId: 1, text, author: null, postedAt: at(postedAt) });
const session = (code: string, start: string, end: string): ClassSession => ({
  id: `${code}${start}`,
  courseCode: code,
  courseName: code,
  start: at(start),
  end: at(end),
  activity: "Kuliah",
  room: null,
});

describe("online-meeting links", () => {
  it("finds Teams, Zoom and Meet links in a text, without trailing punctuation", () => {
    expect(meetingLinks("Link: https://teams.microsoft.com/meet/123?p=x. Cadangan https://itb.zoom.us/j/9 dan https://edunex.itb.ac.id/x")).toEqual([
      "https://teams.microsoft.com/meet/123?p=x",
      "https://itb.zoom.us/j/9",
    ]);
  });

  it("the class's standing link is the newest one posted", () => {
    const list = [
      post(1, "Link lama https://meet.google.com/aaa", "2026-09-01T10:00:00+07:00"),
      post(2, "Link teams https://teams.microsoft.com/meet/new", "2026-09-10T10:00:00+07:00"),
    ];
    expect(classMeetingLink(list)).toBe("https://teams.microsoft.com/meet/new");
    expect(classMeetingLink([post(3, "Tidak ada kuliah minggu ini", "2026-09-10T10:00:00+07:00")])).toBeNull();
  });

  it("an online meeting with no link of its own gets the class's link", () => {
    const found = announcedMeetings(
      [],
      [
        post(1, "Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB (Online - Link meeting teams)", "2026-10-01T10:00:00+07:00"),
        post(2, "Link teams untuk kuliah online https://teams.microsoft.com/meet/class", "2026-09-10T10:00:00+07:00"),
      ],
    );
    expect(found[0]).toMatchObject({ number: 3, online: true, link: "https://teams.microsoft.com/meet/class" });
  });
});

describe("next and clashing meetings", () => {
  it("marks the next meeting to start", () => {
    const meetings = [
      session("KU5014", "2026-10-01T16:00:00+07:00", "2026-10-01T18:00:00+07:00"),
      session("KU5014", "2026-10-08T16:00:00+07:00", "2026-10-08T18:00:00+07:00"),
    ].map((s) => ({ key: s.id, start: s.start, end: s.end, six: s, presence: null, announced: null, notInSix: false }));
    expect(nextMeetingIndex(meetings, at("2026-10-08T08:12:00+07:00"))).toBe(1);
    expect(nextMeetingIndex(meetings, at("2026-10-09T08:12:00+07:00"))).toBe(-1);
  });

  it("finds another course's class overlapping a meeting, never the course's own", () => {
    const meeting = { start: at("2026-10-08T16:00:00+07:00"), end: at("2026-10-08T18:00:00+07:00") };
    const schedule = [
      session("PL3032", "2026-10-08T15:00:00+07:00", "2026-10-08T16:30:00+07:00"),
      session("KU5014", "2026-10-08T16:00:00+07:00", "2026-10-08T18:00:00+07:00"),
      session("PL3002", "2026-10-08T08:00:00+07:00", "2026-10-08T10:00:00+07:00"),
    ];
    expect(clashes(meeting, "KU5014", schedule).map((s) => s.courseCode)).toEqual(["PL3032"]);
  });
});

describe("the Modul tab opens on something to read", () => {
  it("the newest entry with content, the class's own first, never an empty one", async () => {
    const { newestWithContent } = await import("../../src/core/course-materials");
    const e = (hasContent: boolean, at: number | null, parent = false) => ({ hasContent, at, parent });
    expect(newestWithContent([e(true, 1), e(false, 9), e(true, 5), e(false, null)])).toBe(2);
    expect(newestWithContent([e(false, null), e(false, null)])).toBe(0);
    expect(newestWithContent([e(true, 9, true), e(true, 1)])).toBe(1);
    expect(newestWithContent([e(true, 3), e(true, 3)])).toBe(1);
  });

  it("counts what a module holds by kind", async () => {
    const { contentCounts } = await import("../../src/core/course-materials");
    const m = (type: string) => ({ id: 1, courseId: 1, moduleId: 1, title: "x", type, content: null, sizeBytes: null, postedAt: null, updatedAt: null });
    expect(contentCounts([m("pdf"), m("pdf"), m("ms-teams"), m("h5p")], 1)).toEqual([
      { kind: "task", count: 1 },
      { kind: "pdf", count: 2 },
      { kind: "vicon", count: 1 },
      { kind: "file", count: 1 },
    ]);
  });
});
