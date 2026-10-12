// #81: quick search over what the app saved after the first full sync of the
// pretend Edunex and SIX (real recorded shapes): what each query finds, in
// which order, and where picking it goes. Also that a full term stays instant.
import { beforeAll, describe, expect, it } from "vitest";
import { htmlText } from "../../src/core/course-materials";
import type { Announcement, Material, Task } from "../../src/core/models";
import type { Saved } from "../../src/core/saved";
import { fold, SCREENS, type ScreenId, type SearchGroup, type SearchIndex, search, searchIndex, suggestions } from "../../src/core/search";
import { firstSync } from "./first-sync";

const ALL = Object.keys(SCREENS) as ScreenId[];

let saved: Saved;
let now: number;
let index: SearchIndex;
beforeAll(async () => {
  const h = await firstSync();
  saved = h.saved();
  now = h.world.clock.now();
  index = searchIndex(saved, { lang: "id", screens: ALL, now });
});

const keys = (groups: SearchGroup[]) => groups.flatMap((group) => group.items.map((item) => item.key));
const first = (query: string, within = index) => search(within, query)[0]?.items[0];
const kinds = (groups: SearchGroup[]) => groups.map((group) => group.kind);

describe("courses", () => {
  it("an exact course code comes first, however it's typed", () => {
    for (const query of ["PL3002", "pl3002", " pl 3002 ", "Pl-3002"]) {
      const groups = search(index, query);
      expect(groups[0].kind, query).toBe("course");
      expect(groups[0].items[0]).toMatchObject({
        key: "course:PL3002",
        title: "Ekonomi dan Inovasi dalam Perencanaan",
        target: { screen: "course", code: "PL3002" },
      });
    }
  });

  it("the course comes before its own Tasks, materials and modules, which follow", () => {
    const groups = search(index, "II4091");
    expect(groups[0].items.map((item) => item.key)).toEqual(["course:II4091"]);
    const rest = groups.slice(1).flatMap((group) => group.items);
    expect(rest.length).toBeGreaterThan(5);
    expect(rest.every((item) => item.code === "II4091")).toBe(true);
  });

  it("a code's beginning finds every course it starts", () => {
    expect(search(index, "pl30")[0].items.map((item) => item.key)).toEqual(["course:PL3002", "course:PL3032"]);
  });

  it("the course itself beats a title that starts with its code", () => {
    const syllabus: Material = {
      id: 990002,
      courseId: 95001,
      moduleId: null,
      title: "PL3002 Silabus dan Kontrak Kuliah",
      type: "pdf",
      content: null,
      sizeBytes: null,
      postedAt: null,
      updatedAt: null,
    };
    const withTitle = searchIndex({ ...saved, "edunex.materials": { ...saved["edunex.materials"], PL3002: [syllabus] } }, { lang: "id", screens: [], now });
    expect(
      search(withTitle, "PL3002")
        .map((group) => group.items[0].key)
        .slice(0, 2),
    ).toEqual(["course:PL3002", "material:990002"]);
    expect(search(withTitle, "pl30")[0].items.map((item) => item.key)).toEqual(["course:PL3002", "course:PL3032"]);
  });

  it("by its Indonesian or English name, in any word order, any case", () => {
    expect(first("inovasi ekonomi")?.key).toBe("course:PL3002");
    expect(first("ECONOMICS innovation")?.key).toBe("course:PL3002");
    expect(first("marketing")?.key).toBe("course:DK4073");
    expect(first("pemasaran")?.key).toBe("course:DK4073");
  });

  it("forgives a small typo: a letter missing, added, wrong or swapped", () => {
    expect(first("pemasran")?.key).toBe("course:DK4073");
    expect(first("trnasportasi")?.key).toBe("course:PL3032");
    expect(first("infrastrukturr")?.key).toBe("course:PL3032");
    // While still typing: "ekonmi" is "ekonomi" with a letter missing.
    expect(search(index, "ekonmi")[0].items.map((item) => item.key)).toEqual(["course:PL3002", "course:PL3032"]);
  });

  it("forgives accents", () => {
    const accented: Saved = { ...saved, "six.courses": saved["six.courses"]!.map((c) => (c.code === "DK4073" ? { ...c, name: "Komunikasi Pémasaran" } : c)) };
    const withAccent = searchIndex(accented, { lang: "id", screens: [], now });
    expect(first("pemasaran", withAccent)?.key).toBe("course:DK4073");
    expect(first("PÉMASARAN", index)?.key).toBe("course:DK4073");
    expect(fold("Pémasaran — Kelas 01")).toBe("pemasaran kelas 01");
  });

  it("shows the name in the Student's language", () => {
    const english = searchIndex(saved, { lang: "en", screens: ALL, now });
    expect(first("PL3002", english)?.title).toBe("Economics and Innovation in Planning");
    expect(first("ekonomi inovasi", english)?.key).toBe("course:PL3002");
  });

  it("without SIX, still the Indonesian name, from ITB's catalog, like the rest of the app", () => {
    const edunexOnly: Saved = {
      ...saved,
      "six.courses": undefined,
      "six.student": undefined,
      "itb.catalog": { courses: [{ code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan" }] },
    } as Saved;
    const noSix = searchIndex(edunexOnly, { lang: "id", screens: [], now });
    expect(first("PL3002", noSix)?.title).toBe("Ekonomi dan Inovasi dalam Perencanaan");
  });

  it("isn't so forgiving that unrelated words match", () => {
    expect(search(index, "zzzz")).toEqual([]);
    expect(search(index, "kuis")).toEqual([]);
    expect(search(index, "   ")).toEqual([]);
    // A code or number with one digit off is another course, not a typo.
    expect(search(index, "pl3003")).toEqual([]);
    expect(search(index, "pl3002")[0].items.map((item) => item.key)).toEqual(["course:PL3002"]);
  });
});

describe("Tasks", () => {
  it("by title, best match first, opening the Task", () => {
    const task = first("tugas 02");
    expect(task).toMatchObject({ kind: "task", key: "task:117003", title: "Tugas 02 Bab II", code: "II4091", target: { screen: "task", taskId: 117003 } });
  });

  it("by the module it's in, and by its course", () => {
    const tasks = (query: string) => search(index, query).flatMap((group) => (group.kind === "task" || group.kind === "doneTask" ? group.items : []));
    expect(tasks("pengantar proposal").map((item) => item.key)).toContain("task:113986");
    expect(
      tasks("kampus ganesha pl3002")
        .map((item) => item.key)
        .sort(),
    ).toEqual(["task:117432", "task:117873"]);
  });

  it("Tasks still to hand in come first, the one due first on top; done ones after everything else", () => {
    const groups = search(index, "tugas");
    expect(groups[0].kind).toBe("task");
    expect(groups.at(-1)?.kind).toBe("doneTask");
    const open = groups[0].items.map((item) => (item.kind === "task" ? item.task.dueAt : null));
    expect(open).toEqual([...open].sort((a, b) => (a ?? Infinity) - (b ?? Infinity)));
    expect(groups[0].items[0].key).toBe("task:117003");
  });

  it("before anything is typed: what was opened lately, the next three Tasks still to hand in, the courses, the screens and the verbs", () => {
    const groups = suggestions(index, now);
    expect(kinds(groups)).toEqual(["task", "course", "screen", "action"]);
    expect(kinds(suggestions(index, now, ["course:KU5014", "gone:1"]))).toEqual(["recent", "task", "course", "screen", "action"]);
    expect(suggestions(index, now, ["course:KU5014"])[0].items.map((item) => item.key)).toEqual(["course:KU5014"]);
    expect(groups[0].items.map((item) => item.key)).toEqual(["task:117003", "task:117010", "task:117023"]);
    expect(groups[1].items).toHaveLength(5);
    expect(groups[2].items.map((item) => item.title)).toEqual(["Beranda", "Tugas & Ujian", "Jadwal", "Presensi", "Nilai", "Rencana studi", "Pengaturan"]);
  });
});

describe("exams", () => {
  it("exams as Tugas & Ujian lists them (one per course and exam), soonest first, each opening its exam page", () => {
    const exams = search(index, "uts").find((group) => group.kind === "exam");
    expect(exams?.items.map((item) => [item.title, item.target])).toEqual([
      // PL3032's outline has "Midex/UTS" and SIX lists no UTS for it: ITB's UTS week (12–16 Oct) dates it.
      ["UTS Ekonomi Infrastruktur dan Transportasi", { screen: "exam", examId: "PL3032-UTS" }],
      // SIX's sitting and Edunex's take-home "UTS Markom" are one exam.
      ["UTS Komunikasi Pemasaran", { screen: "exam", examId: "DK4073-UTS" }],
    ]);
    // The take-home's title finds its exam, not one more Task.
    expect(keys(search(index, "markom")).sort()).toEqual(["exam:DK4073-UTS", "module:473251"]);
  });

  it("a take-home UAS is found as its exam too, never also as a Task", () => {
    const tasks = saved["edunex.tasks"] ?? [];
    const uas = { ...tasks.find((task) => task.id === 117764)!, id: 990001, title: "Proyek Akhir Markom", kind: "uas" as const };
    const withUas = searchIndex({ ...saved, "edunex.tasks": [...tasks, uas] }, { lang: "id", screens: ALL, now });
    expect(keys(search(withUas, "proyek akhir markom"))).toEqual(["exam:DK4073-UAS"]);
  });

  it("by its room, or the final exam by its outline module's name", () => {
    expect(first("tvst")).toMatchObject({ kind: "exam", title: "UTS Komunikasi Pemasaran" });
    const finex = search(index, "finex").find((group) => group.kind === "exam");
    expect(finex?.items.map((item) => item.title)).toEqual(["UAS Ekonomi Infrastruktur dan Transportasi"]);
  });
});

describe("materials, modules and announcements", () => {
  it("a material by title opens its course on the Modul tab", () => {
    expect(first("link teams pertemuan 03")).toMatchObject({
      kind: "material",
      code: "II4091",
      module: null,
      target: { screen: "course", code: "II4091", tab: "modules" },
    });
    const sap = first("sap ekonomi infrastruktur");
    expect(sap).toMatchObject({ kind: "material", title: "K1. SAP Ekonomi Infrastruktur dan Transportasi", code: "PL3032" });
  });

  it("a material inside a module also by the module's name", () => {
    const outline = saved["edunex.outline"]!.PL3002;
    const module = outline.modules.find((m) => m.title === "Product Innovation")!;
    const material: Material = {
      id: 990001,
      courseId: module.courseId,
      moduleId: module.id,
      title: "Slide kuliah minggu 3",
      type: "pdf",
      content: null,
      sizeBytes: null,
      postedAt: null,
      updatedAt: null,
    };
    const withMaterial = searchIndex({ ...saved, "edunex.materials": { ...saved["edunex.materials"], PL3002: [material] } }, { lang: "id", screens: [], now });
    const found = search(withMaterial, "product innovation slide").find((group) => group.kind === "material")?.items[0];
    // It opens on its module.
    expect(found).toMatchObject({ key: "material:990001", target: { screen: "course", code: "PL3002", tab: "modules", module: module.id } });
    expect(found?.kind === "material" && found.module).toMatchObject({ title: "Product Innovation", number: 3, parent: false });
  });

  it("a module by title, numbered as the course page numbers it", () => {
    const midex = first("midex");
    expect(midex).toMatchObject({ kind: "module", title: "Midex/UTS", code: "PL3032" });
    expect(midex?.kind === "module" && midex.module.number).toBe(8);
    expect(midex?.kind === "module" && midex.target).toEqual({
      screen: "course",
      code: "PL3032",
      tab: "modules",
      module: midex?.kind === "module" && midex.module.id,
    });
    // "Module 06" is found as module 6 too.
    expect(first("module 6")?.title).toBe("Module 06");
  });

  it("an announcement by its first line, opening the course's announcements", () => {
    expect(first("kuliah online proposal")).toMatchObject({
      kind: "announcement",
      title: "Link teams untuk kuliah online Proposal TA",
      target: { screen: "course", code: "II4091", tab: "announcements" },
    });
  });
});

describe("screens, their tabs, and Settings", () => {
  it("verbs: refresh and switch theme, by their words in either language", () => {
    expect(first("muat ulang")).toMatchObject({ kind: "action", target: { action: "refresh" } });
    expect(first("refresh")).toMatchObject({ kind: "action", target: { action: "refresh" } });
    expect(first("tema gelap")).toMatchObject({ kind: "action", target: { action: "theme" } });
    expect(first("dark mode")).toMatchObject({ kind: "action", target: { action: "theme" } });
  });

  it("by name in either language, or by what they hold", () => {
    expect(first("jadwal")).toMatchObject({ kind: "screen", target: { screen: "schedule" } });
    expect(first("schedule")).toMatchObject({ kind: "screen", target: { screen: "schedule" } });
    expect(first("pengaturan")).toMatchObject({ kind: "screen", target: "settings" });
    expect(first("settings")).toMatchObject({ kind: "screen", target: "settings" });
    expect(first("ipk")).toMatchObject({ kind: "screen", target: { screen: "grades" } });
    expect(first("transkrip")).toMatchObject({ kind: "screen", target: { screen: "grades" } });
  });

  it("Rencana studi's tabs: the planner, the curriculum, KRS, UKT and ITB's academic calendar", () => {
    expect(first("krs")).toMatchObject({ kind: "screen", title: "KRS", within: "Rencana studi", target: { screen: "plan", tab: "krs" } });
    expect(first("ukt")).toMatchObject({ kind: "screen", title: "UKT", target: { screen: "plan", tab: "bills" } });
    expect(first("tagihan")).toMatchObject({ target: { screen: "plan", tab: "bills" } });
    expect(first("kurikulum")).toMatchObject({ title: "Kurikulum", target: { screen: "plan", tab: "curriculum" } });
    expect(first("kalender akademik")).toMatchObject({ title: "Kalender akademik", target: { screen: "plan", tab: "deadlines" } });
    expect(first("dosen wali")).toMatchObject({ target: { screen: "plan", tab: "krs" } });
    // "Rencana studi" itself first, its planner tab next.
    expect(
      search(index, "rencana")[0]
        .items.slice(0, 2)
        .map((item) => item.target),
    ).toEqual([{ screen: "plan" }, { screen: "plan", tab: "planner" }]);
    const english = searchIndex(saved, { lang: "en", screens: ALL, now });
    expect(first("bills", english)).toMatchObject({ title: "UKT", within: "Study plan", target: { screen: "plan", tab: "bills" } });
  });

  it("only the screens and tabs that are built", () => {
    const fewer = searchIndex(saved, { lang: "id", screens: ["home", "tasks", "presence", "settings"], now });
    expect(search(fewer, "jadwal").find((group) => group.kind === "screen")).toBeUndefined();
    expect(search(fewer, "ukt").find((group) => group.kind === "screen")).toBeUndefined();
  });
});

describe("only this term's courses", () => {
  it("Edunex data of a course SIX doesn't list is left out", () => {
    const withoutPl3002: Saved = { ...saved, "six.courses": saved["six.courses"]!.filter((c) => c.code !== "PL3002") };
    const term = searchIndex(withoutPl3002, { lang: "id", screens: [], now });
    expect(keys(search(term, "PL3002")).filter((key) => key.includes("PL3002") || key.startsWith("task:1174") || key.startsWith("task:1178"))).toEqual([]);
    expect(first("ekonomi inovasi", term)?.key).not.toBe("course:PL3002");
  });
});

describe("a full term", () => {
  /** Eight courses with what a busy term holds: 16 modules, 60 materials, 20 Tasks and 15 announcements each. */
  function fullTerm(): Saved {
    const base = saved;
    const courses = base["six.courses"]!;
    const edunex = base["edunex.courses"]!;
    const codes = ["DK4073", "II4091", "KU5014", "PL3002", "PL3032", "II3120", "II3240", "PL4011"];
    const sixCourses = codes.map((code, i) => courses[i] ?? { ...courses[0], code, name: `${courses[i % 5].name} Lanjut` });
    const edunexCourses = codes.map(
      (code, i) =>
        edunex[i] ?? {
          ...edunex[i % 5],
          code,
          name: `${edunex[i % 5].name} Advanced`,
          edunex: { courseId: 80000 + i, classId: 70000 + i, relatedCourseIds: [] },
        },
    );
    const titles = (base["edunex.tasks"] ?? []).map((t) => t.title);
    // Real words, as varied as a term's titles: ITB's course names and the recorded Tasks' instructions.
    const texts = [
      ...(base["itb.catalog"]?.courses ?? []).map((c) => c.name),
      ...(base["six.curriculum"]?.catalog ?? []).map((c) => c.name),
      ...(base["six.transcript"]?.terms ?? []).flatMap((term) => term.courses.map((c) => c.name)),
      ...(base["edunex.tasks"] ?? []).map((t) => htmlText(t.instructions)),
      ...Object.values(base["edunex.materials"] ?? {}).flatMap((list) => list.map((m) => htmlText(m.content ?? ""))),
    ];
    const pool = [...new Set(texts.flatMap((text) => text.split(/\s+/)).filter((w) => w.length > 2))];
    let next = 0;
    const pick = (count: number) => Array.from({ length: count }, () => pool[(next += 7) % pool.length]).join(" ");
    const outline: NonNullable<Saved["edunex.outline"]> = {};
    const materials: NonNullable<Saved["edunex.materials"]> = {};
    const announcements: NonNullable<Saved["edunex.announcements"]> = {};
    const tasks: Task[] = [];
    let id = 500000;
    edunexCourses.forEach((course) => {
      const courseId = course.edunex.courseId;
      const modules = Array.from({ length: 16 }, (_, m) => ({ id: ++id, courseId, title: `${pick(3)} ${m + 1}`, postedAt: null }));
      outline[course.code] = { lecturer: null, credits: 3, modules, grade: null };
      materials[course.code] = Array.from({ length: 60 }, (_, m) => ({
        id: ++id,
        courseId,
        moduleId: modules[m % 16].id,
        title: `${["Slide", "Rekaman", "Bacaan", "Latihan", "Link Teams"][m % 5]} ${pick(3)}`,
        type: ["pdf", "video", "pdf", "docx", "ms-teams"][m % 5],
        content: null,
        sizeBytes: null,
        postedAt: null,
        updatedAt: null,
      }));
      announcements[course.code] = Array.from(
        { length: 15 },
        (_, a): Announcement => ({ id: ++id, courseId, text: `Pengumuman ${a + 1}: ${pick(4)}\nDetail`, author: null, postedAt: null }),
      );
      for (let t = 0; t < 20; t++)
        tasks.push({
          ...(base["edunex.tasks"]![t % 10] as Task),
          id: ++id,
          courseCode: course.code,
          courseId,
          title: `${titles[t % titles.length]} ${pick(2)}`,
        });
    });
    return {
      ...base,
      "six.courses": sixCourses,
      "edunex.courses": edunexCourses,
      "edunex.outline": outline,
      "edunex.materials": materials,
      "edunex.announcements": announcements,
      "edunex.tasks": tasks,
    };
  }

  it("builds in well under a tenth of a second and answers each query within a frame", () => {
    const term = fullTerm();
    const queries = [
      "pl3002",
      "slide",
      "ekonmi",
      "rekaman perencanaan",
      "tugas 02 bab",
      "infrastrukturr",
      "pengumuman 12",
      "lnk teams",
      "k",
      "sistem informasi manajemen",
      "pemrogaman",
    ];
    const ranked = (samples: number[], share: number) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length * share)];
    // Once to warm up, as the window has by the time the Student opens search.
    let big = searchIndex(term, { lang: "id", screens: ALL, now });
    for (const query of queries) search(big, query);

    const builds: number[] = [];
    for (let run = 0; run < 5; run++) {
      const start = performance.now();
      big = searchIndex(term, { lang: "id", screens: ALL, now });
      builds.push(performance.now() - start);
    }
    expect(big.entries.length).toBeGreaterThan(8 * (16 + 60 + 20 + 15));
    expect(big.vocabulary.length).toBeGreaterThan(800);
    const answers: number[] = [];
    for (let run = 0; run < 5; run++) {
      for (const query of queries) {
        const start = performance.now();
        search(big, query);
        answers.push(performance.now() - start);
      }
    }
    // Generous for a busy machine: unloaded, a build takes about 10 ms and a query about 1 ms.
    expect(ranked(builds, 0.5)).toBeLessThan(100);
    expect(ranked(answers, 0.5)).toBeLessThan(16);
    expect(ranked(answers, 0.9)).toBeLessThan(50);
    // And it still finds the right thing at that size.
    expect(search(big, "PL3002")[0].items[0].key).toBe("course:PL3002");
  });
});
