// v2-06 (#74): what the course page makes of the engine's data. Meetings
// merged from SIX, Edunex Presence and Edunex text; the course-contract
// calculator; and how a course's files are laid out for offline reading.
import { describe, expect, it } from "vitest";
import { EXAMPLE_CONTRACT, standing } from "../../src/core/course-contract";
import { materialAction, planOfflineFiles } from "../../src/core/course-materials";
import {
  announcedMeetings,
  courseMeetings,
  type Meeting,
  meetingModules,
  meetingState,
  openPresence,
  openPresences,
  pinnedMeeting,
} from "../../src/core/course-meetings";
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
      expect.objectContaining({
        number: 2,
        start: at("2026-09-11T15:00:00+07:00"),
        end: at("2026-09-11T17:00:00+07:00"),
        online: true,
        link: expect.stringContaining("teams.microsoft.com"),
      }),
      expect.objectContaining({
        number: 3,
        start: at("2026-10-09T15:00:00+07:00"),
        end: at("2026-10-09T17:00:00+07:00"),
        note: "Online - Link meeting teams",
        online: true,
      }),
    ]);
  });

  it("one meeting per number: when the lecturer posts a new time, the latest text wins", () => {
    const post = (id: number, text: string, postedAt: string) => ({ id, courseId: 95326, text, author: null, postedAt: at(postedAt) });
    const found = announcedMeetings(
      [],
      [
        post(2, "Pertemuan 03: Sabtu, 10 Oktober 2026 Pkl. 09:00 - 11:00 WIB", "2026-10-05T10:00:00+07:00"),
        post(
          1,
          "Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB\nPertemuan 04: Jumat, 16 Oktober 2026 Pkl. 15:00 - 17:00 WIB",
          "2026-10-01T10:00:00+07:00",
        ),
      ],
    );
    expect(found.map((m) => [m.number, m.start])).toEqual([
      [3, at("2026-10-10T09:00:00+07:00")],
      [4, at("2026-10-16T15:00:00+07:00")],
    ]);
  });

  it("SIX gives the time and room; a meeting only Edunex text announces is marked not in SIX", async () => {
    const h = await signedIn();
    const presence = h.dataset("edunex.presence")!.II4091;
    const announced = announcedMeetings(h.dataset("edunex.materials")!.II4091, h.dataset("edunex.announcements")!.II4091);
    // SIX lists October's Friday meeting at 15:00–17:00 in room 7602 (Edunex's Presence runs to 23:59).
    const six = [sixSession("2026-10-16T15:00:00+07:00", "2026-10-16T17:00:00+07:00")];
    const meetings = courseMeetings("II4091", presence, six, announced, ["2026-10"]);
    const oct16 = meetings.find((m) => m.presence?.start === at("2026-10-16T15:00:00+07:00"))!;
    expect(oct16).toMatchObject({ start: at("2026-10-16T15:00:00+07:00"), end: at("2026-10-16T17:00:00+07:00"), notInSix: false });
    expect(oct16.six?.room).toBe("7602");
    const oct9 = meetings.find((m) => m.announced?.number === 3)!;
    expect(oct9).toMatchObject({ presence: null, six: null, notInSix: true });
    // SIX's September isn't known here, so September's announced meeting isn't called missing from it.
    expect(meetings.find((m) => m.announced?.number === 2)!.notInSix).toBe(false);
    // Without SIX nothing is "not in SIX".
    expect(courseMeetings("II4091", presence, null, announced, ["2026-10"]).some((m) => m.notInSix)).toBe(false);
  });

  it("with a lab and a lecture the same day, a Presence joins the class its time overlaps, never one by the day alone", async () => {
    const h = await signedIn();
    const presence = h.dataset("edunex.presence")!.II4091.filter((p) => p.start === at("2026-10-16T15:00:00+07:00"));
    const lab = { ...sixSession("2026-10-16T08:00:00+07:00", "2026-10-16T10:00:00+07:00"), activity: "Praktikum" };
    const lecture = sixSession("2026-10-16T15:00:00+07:00", "2026-10-16T17:00:00+07:00");
    expect(courseMeetings("II4091", presence, [lab, lecture], []).find((m) => m.presence)?.six).toBe(lecture);
    // Edunex's time overlapping neither: no guess, the Presence keeps its own time.
    const elsewhen = presence.map((p) => ({ ...p, start: at("2026-10-16T12:00:00+07:00"), end: at("2026-10-16T13:00:00+07:00") }));
    expect(courseMeetings("II4091", elsewhen, [lab, lecture], []).find((m) => m.presence)).toMatchObject({ six: null, start: at("2026-10-16T12:00:00+07:00") });
    // With one class that day, the day pairs them.
    expect(courseMeetings("II4091", elsewhen, [lecture], []).find((m) => m.presence)?.six).toBe(lecture);
  });

  it("never calls a meeting missed: an unmarked one stays 'not marked in Edunex', a future one 'upcoming'", async () => {
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

  it("lists every Presence window still open and not recorded, the one closing first first", async () => {
    const h = await signedIn();
    const now = h.world.clock.now(); // Thursday 8 October, 08:12
    const all = h.dataset("edunex.presence")!.PL3002;
    // Last week's window kept open until Monday; today's closes at 09:30.
    const windows = all.map((p) => (p.start === at("2026-10-01T08:00:00+07:00") ? { ...p, closesAt: at("2026-10-12T23:00:00+07:00") } : p));
    expect(openPresences(windows, now).map((p) => p.start)).toEqual([at("2026-10-08T08:00:00+07:00"), at("2026-10-01T08:00:00+07:00")]);
    const recorded = windows.map((p) => (p.start === at("2026-10-08T08:00:00+07:00") ? { ...p, recorded: { present: true, at: now } } : p));
    expect(openPresences(recorded, now).map((p) => p.start)).toEqual([at("2026-10-01T08:00:00+07:00")]);
  });
});

describe("a meeting's module", () => {
  const meeting = (day: string): Meeting => ({
    key: day,
    start: at(`${day}T08:00:00+07:00`),
    end: at(`${day}T09:30:00+07:00`),
    six: null,
    presence: null,
    announced: null,
    notInSix: false,
  });
  const entry = (number: number, title: string, posted: string) => ({
    module: { id: number, courseId: 1, title, postedAt: at(`${posted}+07:00`) },
    number,
    parent: false,
  });
  const meetings = ["2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01"].map(meeting);

  it("is the one module posted in the week before it; a batch or two in one week names nothing", () => {
    const modules = meetingModules(meetings, [
      entry(1, "Info Awal", "2026-09-09T22:40:00"),
      entry(2, "Impact of Innovation", "2026-09-09T22:45:00"),
      entry(4, "Production Process Innovation", "2026-09-16T20:25:00"),
      entry(5, "Inovasi Kelembagaan Pasar", "2026-09-29T19:55:00"),
      entry(6, "Inovasi Keuangan", "2026-10-01T00:25:00"),
    ]);
    expect([...modules].map(([key, e]) => [key, e.number])).toEqual([["2026-09-17", 4]]);
  });

  it("never from a numbered placeholder, or a module posted long before", () => {
    expect(meetingModules(meetings, [entry(6, "Module 06", "2026-09-16T20:25:00"), entry(1, "Pengantar", "2026-08-01T10:00:00")]).size).toBe(0);
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
  it("each material type gets the action Edunex's own course page gives it", async () => {
    const base = { id: 1, courseId: 95001, moduleId: 470019, title: "Slide 1", content: "", sizeBytes: null, postedAt: null, updatedAt: null };
    const blob = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";
    const edunex = { kind: "edunex", url: "https://edunex.itb.ac.id/courses/95001/preview/470019" };
    expect(materialAction({ ...base, type: "pdf", content: blob })).toEqual({ kind: "download", url: blob, name: "Slide 1.pdf" });
    expect(materialAction({ ...base, type: "zoom", content: "https://itb.zoom.us/j/1" })).toEqual({ kind: "join", url: "https://itb.zoom.us/j/1" });
    expect(materialAction({ ...base, type: "webex", content: "https://itb.webex.com/meet/x" }).kind).toBe("join");
    // A CloudX room is joined through Edunex, never from an unknown address.
    expect(materialAction({ ...base, type: "cloudx", content: "https://cloudx.example/room" })).toEqual(edunex);
    // Notes are drawn right on the page, a picture-only one too (Course Tokens).
    expect(materialAction({ ...base, type: "text", content: "<p>Bab 2</p>" })).toEqual({ kind: "note", html: "<p>Bab 2</p>" });
    expect(materialAction({ ...base, type: "text", content: '<figure><img src="x"></figure>' })).toEqual({
      kind: "note",
      html: '<figure><img src="x"></figure>',
    });
    // A lecturer's link opens wherever it goes, as Edunex's "Open Link" does; never another scheme.
    expect(materialAction({ ...base, type: "url", content: "https://www.itb.ac.id/news" })).toEqual({ kind: "open", url: "https://www.itb.ac.id/news" });
    expect(materialAction({ ...base, type: "url", content: "https://docs.google.com/x" })).toEqual({ kind: "open", url: "https://docs.google.com/x" });
    expect(materialAction({ ...base, type: "url", content: "http://example.org/x" })).toEqual({ kind: "open", url: "http://example.org/x" });
    expect(materialAction({ ...base, type: "url", content: "javascript:alert(1)" })).toEqual(edunex);
    expect(materialAction({ ...base, type: "url", content: "https://user:secret@example.org/" })).toEqual(edunex);
    expect(materialAction({ ...base, type: "video", content: "https://www.youtube.com/watch?v=x" })).toEqual({
      kind: "open",
      url: "https://www.youtube.com/watch?v=x",
    });
    expect(materialAction({ ...base, type: "video", content: blob }).kind).toBe("download");
    // A whiteboard is a picture on Edunex's storage.
    expect(materialAction({ ...base, type: "board", content: blob })).toEqual({ kind: "image", url: blob });
    // What only Edunex can show (its embedded pages and packages) and types it doesn't know open there.
    for (const type of ["html", "scorm", "h5p", "quiz-of-the-future"]) expect(materialAction({ ...base, type, content: blob })).toEqual(edunex);
    // Other uploads carry their extension as the type (seen live: zip, ppt).
    expect(materialAction({ ...base, type: "zip", content: blob })).toEqual({ kind: "download", url: blob, name: "Slide 1.zip" });
    expect(materialAction({ ...base, type: "pptx", content: blob })).toEqual({ kind: "download", url: blob, name: "Slide 1.pptx" });
    expect(materialAction({ ...base, type: "zip", content: "https://example.org/x.zip" })).toEqual({ kind: "open", url: "https://example.org/x.zip" });
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
    // The modules' own uploads (zip templates, PDF slides) and the ones posted here; notes aren't files.
    expect(plan.files.map((f) => [...f.folders, f.name].join("/"))).toEqual([
      "02 Template Proposal dan Laporan TA - Latex/Template Proposal TA - LaTeX.zip",
      "02 Template Proposal dan Laporan TA - Latex/Template Laporan TA - LaTeX.zip",
      "02 Template Proposal dan Laporan TA - Latex/Template Proposal.pdf",
      "02 Template Proposal dan Laporan TA - Latex/Template Proposal (2).pdf",
      "03 01 Pengantar Proposal TA/Slide Pengantar Proposal TA.pdf",
      "Kelas induk/01 Penawaran Topik TA Dosen/Topik- TA-2026.pdf",
      "Kelas induk/02 Template Proposal TA & Laporan TA - Latex/Template Proposal TA - LaTeX.zip",
      "Kelas induk/03 01 Pengantar Proposal TA/Slide Pengantar Proposal TA.pdf",
    ]);
  });
});
