// v2-06 (#74), seam 1: the engine reads each course's Edunex outline,
// materials, Presence, announcements, exams and published grade, the parent
// and child classes merged under one course code.
import { describe, expect, it } from "vitest";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { startEngine } from "./harness";

const HOUR = 3_600_000;
const at = (text: string) => Date.parse(text);

const signedIn = async () => {
  const h = await startEngine();
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
};

describe("course outline", () => {
  it("lists the class's modules, then its parent class's, leaving out the ones the lecturer switched off", async () => {
    const h = await signedIn();
    const outline = h.dataset("edunex.outline")!.II4091;
    expect(outline.lecturer).toBe("Dr. Hadi Halim, S.T., M.T.");
    expect(outline.credits).toBe(2);
    // The program offering it: where ITB's catalog has its official name.
    expect(outline.program).toBe("S1 - Sistem dan Teknologi Informasi");
    expect(outline.modules.map((m) => [m.courseId, m.title])).toEqual([
      [95326, "List Penawaran Topik TA"],
      [95326, "Template Proposal dan Laporan TA - Latex"],
      [95326, "01 Pengantar Proposal TA"],
      [95326, "02 Penyusunan Proposal TA"],
      [95326, "Tugas"],
      [97602, "Penawaran Topik TA Dosen"],
      ...outline.modules.slice(6).map((m) => [97602, m.title]),
    ]);
    expect(outline.modules).toHaveLength(9);
    expect(outline.modules.map((m) => m.title)).not.toContain("Module 06");
    expect(Object.keys(h.dataset("edunex.outline")!).sort()).toEqual(["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]);
  });

  it("never takes Edunex's unpublished gradebook (0 · E) for a grade", async () => {
    const h = await signedIn();
    for (const outline of Object.values(h.dataset("edunex.outline")!)) expect(outline.grade).toBeNull();
    expect(h.world.log.some((e) => e.url.includes("/gradebook"))).toBe(false);
  });

  it("shows the grade once the lecturer publishes it, but still never a 0 · E", async () => {
    const h = await signedIn();
    h.world.edunex.publishGradebook(95001, 82.5, "A");
    h.world.edunex.publishGradebook(95059, 0, "E");
    await h.engine.refresh("edunex");
    expect(h.dataset("edunex.outline")!.PL3002.grade).toEqual({ total: 82.5, letter: "A" });
    expect(h.dataset("edunex.outline")!.PL3032.grade).toBeNull();
  });
});

describe("materials", () => {
  it("reads the course's and its parent class's contents with their real fields", async () => {
    const h = await signedIn();
    const materials = h.dataset("edunex.materials")!;
    expect(materials.PL3032[0]).toEqual({
      id: 864414,
      courseId: 95059,
      moduleId: null,
      title: "K1. SAP Ekonomi Infrastruktur dan Transportasi",
      type: "pdf",
      content: "https://edunexfixture.blob.core.windows.net/edunex/fixture-1",
      sizeBytes: 1947726,
      postedAt: at("2026-09-01T11:40:00+07:00"),
      updatedAt: at("2026-09-01T11:40:00+07:00"),
    });
    // The online-class links exist only in the parent class.
    const teams = materials.II4091.filter((m) => m.type === "ms-teams");
    expect(teams.map((m) => m.courseId)).toEqual([97602, 97602]);
    expect(materials.II4091.filter((m) => m.type === "text").map((m) => m.courseId)).toEqual([95326, 95326, 97602]);
  });

  it("an empty course is read and empty, not missing", async () => {
    const h = await signedIn();
    expect(h.dataset("edunex.materials")!.KU5014).toEqual([]);
    expect(h.dataset("edunex.materials")!.DK4073).toEqual([]);
  });

  it("a material added to a module shows within the hour, and goes when the lecturer removes it", async () => {
    const h = await signedIn();
    const moduleId = h.dataset("edunex.outline")!.PL3002.modules[1].id;
    const id = h.world.edunex.postMaterial(95001, { name: "Slide Pertemuan 3", type: "pdf", moduleId });
    await h.wait(61 * 60_000);
    const added = h.dataset("edunex.materials")!.PL3002.find((m) => m.id === id);
    expect(added).toMatchObject({ title: "Slide Pertemuan 3", type: "pdf", moduleId, courseId: 95001 });
    h.world.edunex.deleteMaterial(id);
    await h.engine.refresh("edunex");
    expect(h.dataset("edunex.materials")!.PL3002.some((m) => m.id === id)).toBe(false);
  });

  it("keeps every material type as Edunex names it", async () => {
    const h = await signedIn();
    const types = ["video", "audio", "url", "file", "h5p", "zoom", "google-meet", "webex", "cloudx", "quiz-of-the-future"];
    for (const type of types) h.world.edunex.postMaterial(95001, { name: `A ${type}`, type, content: `https://example.org/${type}` });
    await h.engine.refresh("edunex");
    expect(h.dataset("edunex.materials")!.PL3002.map((m) => m.type)).toEqual(types);
  });

  it("a content shape Edunex never sent says Edunex changed something, and keeps the last materials", async () => {
    const h = await signedIn();
    h.world.edunex.mangle(/^\/course\/contents$/, { kind: "missing-field", field: "type" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");
    expect(h.dataset("edunex.materials")!.PL3032).toHaveLength(1);
  });
});

describe("Presence", () => {
  it("fetches every page of a class's sessions, with the window and what Edunex recorded", async () => {
    const h = await signedIn();
    const sessions = h.dataset("edunex.presence")!.PL3002;
    expect(sessions).toHaveLength(15);
    expect(new Set(sessions.map((s) => s.id)).size).toBe(15);
    expect(h.world.log.filter((e) => e.url.includes("/course/presences?") && e.url.includes("86778")).length).toBe(2);
    expect(sessions[0]).toMatchObject({
      start: at("2026-08-27T08:00:00+07:00"),
      end: at("2026-08-27T09:30:00+07:00"),
      opensAt: at("2026-08-27T08:00:00+07:00"),
      closesAt: at("2026-08-27T09:30:00+07:00"),
      topic: "Pendahuluan, CPL,CPMK, Kontrak Belajar",
      recorded: { present: true, at: at("2026-08-27T08:00:00+07:00") },
    });
    expect(sessions[1].recorded).toBeNull();
    expect(sessions.at(-1)!.start).toBe(at("2026-12-03T08:00:00+07:00"));
  });

  it("knows which activity counts and where to do it", async () => {
    const h = await signedIn();
    const session = h.dataset("edunex.presence")!.II4091.find((s) => s.note === "Presensi dengan submit Tugas 01 Bab I")!;
    expect(session).toMatchObject({
      closesAt: at("2026-09-18T23:59:00+07:00"),
      countsBy: [{ kind: "assignment", id: "117001" }],
      url: "https://edunex.itb.ac.id/courses/95326/preview/450222",
      // Edunex writes this time without a zone: it is WIB.
      recorded: { present: true, at: at("2026-09-18T17:16:13+07:00") },
    });
  });

  it("a class without Edunex Presence has none, and a new session shows after the next check", async () => {
    const h = await signedIn();
    expect(h.dataset("edunex.presence")!.KU5014).toEqual([]);
    h.world.edunex.schedulePresence(92948, 84725, { start: "2026-10-08T13:00:00+07:00", end: "2026-10-08T15:00:00+07:00" });
    await h.wait(31 * 60_000);
    expect(h.dataset("edunex.presence")!.KU5014).toHaveLength(1);
  });
});

describe("announcements and exams", () => {
  it("reads announcements of the class and its parent, newest first", async () => {
    const h = await signedIn();
    expect(h.dataset("edunex.announcements")!.II4091).toEqual([
      expect.objectContaining({ id: 2602, courseId: 97602, author: "Dr. Hadi Halim, S.T., M.T.", postedAt: at("2026-09-10T12:31:29+07:00") }),
    ]);
    h.world.edunex.postAnnouncement(95001, { announcement: "Kuliah minggu depan daring", created_at: "2026-10-08 09:00:00" });
    await h.wait(HOUR + 10 * 60_000);
    expect(h.dataset("edunex.announcements")!.PL3002).toEqual([expect.objectContaining({ text: "Kuliah minggu depan daring", courseId: 95001 })]);
  });

  it("every course is checked for Edunex exams, none on this account", async () => {
    const h = await signedIn();
    expect(h.dataset("edunex.exams")).toEqual({ DK4073: [], II4091: [], KU5014: [], PL3002: [], PL3032: [] });
  });
});
