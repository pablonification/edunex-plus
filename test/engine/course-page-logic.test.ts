// v2-06 (#74): what the course page makes of the engine's data. Meetings
// merged from SIX, EduNex Presence and EduNex text; the course-contract
// calculator; and how a course's files are laid out for offline reading.
import { describe, expect, it } from "vitest";
import { EXAMPLE_CONTRACT, standing } from "../../src/core/course-contract";
import { materialAction, planOfflineFiles } from "../../src/core/course-materials";
import { announcedMeetings, courseMeetings, meetingState, openPresence, pinnedMeeting } from "../../src/core/course-meetings";
import type { ClassSession, CourseContract } from "../../src/core/models";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { startEngine } from "./harness";

const at = (text: string) => Date.parse(text);

const signedIn = async () => {
  const h = await startEngine();
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
};

const sixSession = (start: string, end: string, room = "7602"): ClassSession => ({
  id: `six-${start}`,
  courseCode: "II4091",
  courseName: "Proposal Tugas Akhir",
  start: at(start),
  end: at(end),
  activity: "Kuliah",
  room,
});

describe("meetings", () => {
  it("finds meetings announced only in the parent class's text, with the Teams link posted for each", async () => {
    const h = await signedIn();
    const announced = announcedMeetings(h.dataset("edunex.materials")!.II4091, h.dataset("edunex.announcements")!.II4091);
    expect(announced).toEqual([
      expect.objectContaining({ number: 2, start: at("2026-09-11T15:00:00+07:00"), end: at("2026-09-11T17:00:00+07:00"), online: true, link: expect.stringContaining("teams.microsoft.com") }),
      expect.objectContaining({ number: 3, start: at("2026-10-09T15:00:00+07:00"), end: at("2026-10-09T17:00:00+07:00"), note: "Online - Link meeting teams", online: true }),
    ]);
  });

  it("SIX gives the time and room; a meeting only EduNex text announces is marked not in SIX", async () => {
    const h = await signedIn();
    const presence = h.dataset("edunex.presence")!.II4091;
    const announced = announcedMeetings(h.dataset("edunex.materials")!.II4091, h.dataset("edunex.announcements")!.II4091);
    // SIX lists October's Friday meeting at 15:00–17:00 in room 7602 (EduNex's Presence runs to 23:59).
    const six = [sixSession("2026-10-16T15:00:00+07:00", "2026-10-16T17:00:00+07:00")];
    const meetings = courseMeetings("II4091", presence, six, announced);
    const oct16 = meetings.find((m) => m.presence?.start === at("2026-10-16T15:00:00+07:00"))!;
    expect(oct16).toMatchObject({ start: at("2026-10-16T15:00:00+07:00"), end: at("2026-10-16T17:00:00+07:00"), notInSix: false });
    expect(oct16.six?.room).toBe("7602");
    const oct9 = meetings.find((m) => m.announced?.number === 3)!;
    expect(oct9).toMatchObject({ presence: null, six: null, notInSix: true });
    // SIX's September isn't known here, so September's announced meeting isn't called missing from it.
    expect(meetings.find((m) => m.announced?.number === 2)!.notInSix).toBe(false);
    // Without SIX nothing is "not in SIX".
    expect(courseMeetings("II4091", presence, null, announced).some((m) => m.notInSix)).toBe(false);
  });

  it("never calls a meeting missed: an unmarked one stays 'not marked in EduNex', a future one 'upcoming'", async () => {
    const h = await signedIn();
    const now = h.world.clock.now(); // Thursday 8 October, 08:12
    const meetings = courseMeetings("PL3002", h.dataset("edunex.presence")!.PL3002, null, []);
    const states = meetings.map((m) => meetingState(m, now));
    expect(states[0]).toBe("present");
    expect(states[1]).toBe("unmarked");
    // Today's 08:00–09:30 meeting is on, its window open.
    expect(states[6]).toBe("open");
    expect(states.slice(7).every((s) => s === "upcoming")).toBe(true);
    expect(pinnedMeeting(meetings, now)).toMatchObject({ current: true, meeting: { start: at("2026-10-08T08:00:00+07:00") } });
    expect(openPresence(h.dataset("edunex.presence")!.PL3002, now)?.start).toBe(at("2026-10-08T08:00:00+07:00"));
  });
});

describe("course-contract calculator", () => {
  const contract = (scores: Partial<Record<string, number>>): CourseContract => ({
    ...EXAMPLE_CONTRACT,
    parts: EXAMPLE_CONTRACT.parts.map((p) => ({ ...p, score: scores[p.id] ?? null })),
  });

  it("says what's needed on what's left for each letter", () => {
    // UTS 80 (24 points) and full tasks (20): 44 secured, 50% of the weight still open.
    const result = standing(contract({ uts: 80, tasks: 100 }), null);
    expect(result).toMatchObject({ secured: 44, openWeight: 50, final: null });
    expect(result.needs.find((n) => n.letter === "A")).toEqual({ letter: "A", reached: false, need: 62 });
    expect(result.needs.find((n) => n.letter === "D")).toEqual({ letter: "D", reached: false, need: 2 });
  });

  it("uses SIX's attendance for the attendance part, and gives the final score once everything is in", () => {
    const result = standing(contract({ uts: 70, uas: 60, tasks: 90, quizzes: 50 }), 100);
    expect(result.final).toBeCloseTo(21 + 18 + 18 + 5 + 10);
    expect(result.letter).toBe("AB");
  });

  it("an out-of-reach letter says so, and a secured one too", () => {
    const result = standing(contract({ uts: 0, uas: 0, tasks: 100, quizzes: 100, attendance: 100 }), null);
    expect(result.letter).toBe("E");
    const low = standing(contract({ uts: 10, uas: 10 }), null);
    expect(low.needs.find((n) => n.letter === "A")!.need).toBeNull();
    const high = standing(contract({ uts: 100, uas: 100, tasks: 100 }), null);
    expect(high.needs.find((n) => n.letter === "A")!.reached).toBe(true);
  });
});

describe("materials and offline files", () => {
  it("each material type gets its action; unknown or unsafe ones fall back to EduNex", async () => {
    const base = { id: 1, courseId: 95001, moduleId: 470019, title: "Slide 1", content: "", sizeBytes: null, postedAt: null, updatedAt: null };
    const blob = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";
    expect(materialAction({ ...base, type: "pdf", content: blob })).toEqual({ kind: "download", url: blob, name: "Slide 1.pdf" });
    expect(materialAction({ ...base, type: "zoom", content: "https://itb.zoom.us/j/1" })).toEqual({ kind: "join", url: "https://itb.zoom.us/j/1" });
    expect(materialAction({ ...base, type: "webex", content: "https://itb.webex.com/meet/x" }).kind).toBe("join");
    expect(materialAction({ ...base, type: "text", content: "<p>Bab 2</p>" })).toEqual({ kind: "read", html: "<p>Bab 2</p>" });
    // A note that is only a picture has nothing to read here.
    expect(materialAction({ ...base, type: "text", content: '<figure><img src="x"></figure>' }).kind).toBe("edunex");
    expect(materialAction({ ...base, type: "url", content: "https://www.itb.ac.id/news" })).toEqual({ kind: "open", url: "https://www.itb.ac.id/news" });
    expect(materialAction({ ...base, type: "url", content: "https://example.org/x" })).toEqual({ kind: "edunex", url: "https://edunex.itb.ac.id/courses/95001/preview/470019" });
    expect(materialAction({ ...base, type: "h5p", content: "https://example.org/h5p" }).kind).toBe("edunex");
    expect(materialAction({ ...base, type: "quiz-of-the-future", content: blob }).kind).toBe("edunex");
    // Other uploads carry their extension as the type (seen live: zip, ppt).
    expect(materialAction({ ...base, type: "zip", content: blob })).toEqual({ kind: "download", url: blob, name: "Slide 1.zip" });
    expect(materialAction({ ...base, type: "pptx", content: blob })).toEqual({ kind: "download", url: blob, name: "Slide 1.pptx" });
    expect(materialAction({ ...base, type: "zip", content: "https://example.org/x.zip" }).kind).toBe("edunex");
  });

  it("lays a course's files out by module, the parent class's apart, names never colliding", async () => {
    const h = await signedIn();
    const modules = h.dataset("edunex.outline")!.II4091.modules;
    const blob = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";
    h.world.edunex.postMaterial(95326, { name: "Template Proposal", type: "pdf", content: blob, moduleId: modules[1].id });
    h.world.edunex.postMaterial(95326, { name: "Template Proposal", type: "pdf", content: `${blob}?2`, moduleId: modules[1].id });
    h.world.edunex.postMaterial(97602, { name: "Topik: TA/2026", type: "pdf", content: blob, moduleId: modules[5].id });
    await h.engine.refresh("edunex");
    const plan = planOfflineFiles(
      { code: "II4091", name: "Final Project Proposal", mainCourseId: 95326 },
      h.dataset("edunex.outline")!.II4091,
      h.dataset("edunex.materials")!.II4091,
      "id",
    );
    expect(plan.folder).toBe("II4091 Final Project Proposal");
    expect(plan.files.map((f) => [...f.folders, f.name].join("/"))).toEqual([
      "02 Template Proposal dan Laporan TA - Latex/Template Proposal.pdf",
      "02 Template Proposal dan Laporan TA - Latex/Template Proposal (2).pdf",
      "Kelas induk/01 Penawaran Topik TA Dosen/Topik- TA-2026.pdf",
    ]);
  });
});
