// v2-15 (#84): SIX's public course catalog: every Sarjana program's required
// courses, own courses, specializations and minors, read politely (one page
// at a time, at least 3 s apart), kept for days, and robust to pages that fail.
import { describe, expect, it } from "vitest";
import { MemoryStorage } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { startEngine } from "./harness";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Long enough to read the list and all 53 program pages. */
const FULL_READ = 200_000;

type H = Awaited<ReturnType<typeof startEngine>>;
const catalogRequests = (h: H) => h.world.itb.requests.filter((r) => r.host === "six.itb.ac.id");
const program = (h: H, id: string) => h.dataset("itb.catalog")!.programs.find((p) => p.id === id)!;
const course = (h: H, code: string) => h.dataset("itb.catalog")!.courses.find((c) => c.code === code);

describe("SIX public course catalog", () => {
  it("reads every Sarjana program and the recorded program pages", async () => {
    const h = await startEngine();
    await h.wait(FULL_READ);
    const catalog = h.dataset("itb.catalog")!;
    expect(catalog.programs).toHaveLength(53);
    expect(catalog.programs.filter((p) => p.state === "ready").map((p) => p.id).sort()).toEqual(["154", "174", "182"]);
    // The others aren't in the recording (the pretend SIX answers 404): skipped, not failed.
    expect(catalog.programs.filter((p) => p.state === "missing")).toHaveLength(50);

    const sti = program(h, "182");
    expect(sti).toMatchObject({ name: "Sistem dan Teknologi Informasi", faculty: "STEI", prefix: "II" });
    expect(sti.required.slice(0, 4)).toEqual([
      { code: "MA1101", semester: 1 },
      { code: "II1200", semester: 2 },
      { code: "FI1101", semester: 1 },
      { code: "IF1210", semester: 2 },
    ]);
    expect(sti.required.filter((r) => r.semester === 7).map((r) => r.code)).toContain("II4090");
    expect(sti.specializations).toEqual([
      { name: "Keamanan dan Privasi Siber", sks: 12, courses: ["II4021", "II4022", "II4023", "II4024"] },
      expect.objectContaining({ name: "Sistem Informasi Cerdas", sks: 12 }),
    ]);
    // Electives: its own courses that aren't required.
    expect(sti.electives).toEqual(expect.arrayContaining(["II4021", "II4010"]));
    expect(sti.electives).not.toContain("II1200");
    expect(sti.minors).toContain("1810");
    expect(catalog.minors.find((m) => m.id === "1810")).toEqual({
      id: "1810",
      program: "Matematika",
      name: "Program Minor Matematika",
      sks: 16,
      courses: ["MA2121", "MA2181", "MA2231", "MA3131"],
    });
    // Desain Komunikasi Visual has a multidisciplinary package.
    expect(program(h, "174").multidisciplinary).toEqual([expect.objectContaining({ name: "Bisnis DKV Digital", sks: 30 })]);

    expect(course(h, "II2210")).toEqual({ code: "II2210", name: "Teknologi Platform", sks: 3, category: "Kuliah", owner: "182" });
    expect(course(h, "II4090")).toMatchObject({ category: "Kerja Praktik", owner: "182" });
    expect(course(h, "PL4111")).toMatchObject({ owner: "154" });
    // Listed in this program's semester 1, but not its course: its own program (Matematika, Fisika) isn't read here.
    expect(course(h, "MA1101")).toMatchObject({ name: "Matematika I", sks: 4, category: null, owner: null });
    expect(course(h, "FI1101")!.owner).toBeNull();
    expect(h.status("itb").state).toBe("live");
  });

  it("a course belongs to the program whose code prefix it carries", async () => {
    const world = new PretendWorld();
    // Fisika's page, made from a recorded one with its own courses renamed to Fisika's prefix.
    world.itb.pages.set("/pub/kur2024/102", world.itb.pages.get("/pub/kur2024/182")!.replace(/(>\s*)II(\d{3}[0-9X]\s*<)/g, "$1FI$2"));
    const h = await startEngine({ world });
    await h.wait(FULL_READ);
    expect(program(h, "102").prefix).toBe("FI");
    // FI1101 is required in semester 1 by Sistem dan Teknologi Informasi and Perencanaan Wilayah dan Kota, and owned by Fisika.
    expect(program(h, "182").required).toContainEqual({ code: "FI1101", semester: 1 });
    expect(course(h, "FI1101")!.owner).toBe("102");
    expect(course(h, "II2210")!.owner).toBe("182");
  });

  it("fetches one page at a time, at least 3 seconds apart", async () => {
    const h = await startEngine();
    await h.wait(FULL_READ);
    const requests = catalogRequests(h);
    expect(requests[0]!.path).toBe("/pub/kur2024");
    expect(requests).toHaveLength(54);
    const gaps = requests.slice(1).map((r, i) => r.at - requests[i]!.at);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3_000);
  });

  it("is kept for days: nothing is fetched again the same day or on restart", async () => {
    const h = await startEngine();
    await h.wait(FULL_READ);
    const before = catalogRequests(h).length;
    await h.wait(13 * HOUR);
    h.engine.stop();
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault });
    await again.wait(FULL_READ);
    expect(catalogRequests(h).length).toBe(before);
    expect(again.dataset("itb.catalog")!.programs.filter((p) => p.state === "ready")).toHaveLength(3);
    // After a few days it's read again.
    await again.wait(3 * DAY);
    expect(catalogRequests(h).length).toBeGreaterThan(before);
  });

  it("program page missing: a page answering 500 is skipped, the rest is read, and it's tried again later", async () => {
    const world = new PretendWorld();
    world.itb.fail(/^\/pub\/kur2024\/174$/, 500, 1);
    const h = await startEngine({ world });
    await h.wait(FULL_READ);
    expect(program(h, "174")).toMatchObject({ state: "missing", required: [] });
    expect(program(h, "182").state).toBe("ready");
    expect(program(h, "154").state).toBe("ready");
    expect(h.status("itb").state).toBe("live");
    await h.wait(DAY + FULL_READ);
    expect(program(h, "174").state).toBe("ready");
  });

  it("catalog page layout changed: that program says SIX changed something, the others stay usable", async () => {
    const world = new PretendWorld();
    world.itb.changeLayout("/pub/kur2024/182", "<th>Kategori</th>", "<th>Jenis</th>");
    const h = await startEngine({ world });
    await h.wait(FULL_READ);
    expect(program(h, "182").state).toBe("changed");
    expect(program(h, "154").state).toBe("ready");
    expect(course(h, "PL4111")).toMatchObject({ owner: "154", category: "Kuliah" });
    expect(h.status("itb")).toMatchObject({ state: "changed", detail: "SIX's catalog page for Sistem dan Teknologi Informasi (182) changed" });
  });

  it("a changed program list is a vendor change and stores nothing", async () => {
    const world = new PretendWorld();
    world.itb.changeLayout("/pub/kur2024", "No Prodi", "Kode Prodi");
    const h = await startEngine({ world });
    await h.wait(FULL_READ);
    expect(h.dataset("itb.catalog")).toBeUndefined();
    expect(h.status("itb")).toMatchObject({ state: "changed", detail: 'SIX\'s catalog program list: columns are "Fakultas, Kode Prodi, Program Studi"' });
    expect(catalogRequests(h).every((r) => r.path === "/pub/kur2024")).toBe(true);
  });

  it("offline with a cached copy: the catalog stays and the status says offline", async () => {
    const first = await startEngine();
    await first.wait(FULL_READ);
    first.engine.stop();
    await first.world.clock.advance(4 * DAY);
    first.world.setOffline(true);
    const again = await startEngine({ world: first.world, storage: first.storage, vault: first.vault });
    await again.wait(FULL_READ);
    expect(again.status("itb").state).toBe("offline");
    const catalog = again.dataset("itb.catalog")!;
    expect(catalog.programs.filter((p) => p.state === "ready")).toHaveLength(3);
    expect(catalog.courses.find((c) => c.code === "II2210")?.owner).toBe("182");
  });

  it("dropping offline halfway keeps the programs already read", async () => {
    const h = await startEngine();
    while (!catalogRequests(h).some((r) => r.path === "/pub/kur2024/182")) await h.wait(1_000);
    h.world.setOffline(true);
    await h.wait(FULL_READ);
    expect(h.status("itb").state).toBe("offline");
    // Sistem dan Teknologi Informasi comes before Perencanaan Wilayah dan Kota in SIX's list.
    expect(program(h, "182").state).toBe("ready");
    expect(program(h, "154").state).toBe("pending");
  });

  it("reads the Student's own program first", async () => {
    const storage = new MemoryStorage();
    const value = { nim: "18223901", name: "Dimas Pratama", studentId: "2021000001", term: "2026-1", program: "Perencanaan Wilayah dan Kota", programCode: "154" };
    await storage.write("datasets/six.student.json", JSON.stringify({ format: 1, name: "six.student", value, fetchedAt: 0, hash: "x" }));
    const h = await startEngine({ storage });
    await h.wait(10_000);
    expect(catalogRequests(h).map((r) => r.path).slice(0, 2)).toEqual(["/pub/kur2024", "/pub/kur2024/154"]);
    expect(program(h, "154").state).toBe("ready");
  });
});
