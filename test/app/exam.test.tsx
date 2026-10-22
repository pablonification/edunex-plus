// @vitest-environment jsdom
// Exams in one place (#77), seam 2: the exam list in Tugas & Ujian and the
// exam page, from the real engine reading the pretend Edunex, SIX and ITB
// calendar. Recorded: DK4073's UTS in class in SIX (15 October, TVST C) and
// its take-home UTS Task in Edunex due a week later: one exam in two parts.
// Two sittings on different days (SIX's and an Edunex exam's) disagree.
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const examSection = () => document.querySelector("main section[aria-labelledby=tasks-exams]");
const examRow = (code: string) =>
  [...(examSection()?.querySelectorAll("li button") ?? [])].find((b) => b.textContent?.includes(code)) as HTMLButtonElement | undefined;

async function openTasks(world?: PretendWorld) {
  screen = await openApp({ world, signedIn: true, six: true });
  await screen.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
  return screen;
}

/** DK4073's lecturer also sets the UTS as an Edunex exam, on Friday: SIX says Thursday. */
function withEdunexSitting(): PretendWorld {
  const world = new PretendWorld();
  world.edunex.exams.set(93409, [
    { id: 7001, type: "exams", attributes: { name: "UTS Markom", start_at: "2026-10-16T09:00:00+07:00", end_at: "2026-10-16T11:00:00+07:00" } },
  ]);
  return world;
}

describe("the exam list", () => {
  it("merges SIX's UTS in class and Edunex's take-home UTS as two parts, calmly, and lists ITB's exam weeks", async () => {
    await openTasks();
    const row = examRow("DK4073")!.textContent ?? "";
    // The date leads; the kind is a quiet label; no source tags, the source only where it changes what to do.
    expect(row.startsWith("Kam15Okt")).toBe(true);
    expect(row).toContain("UTSKomunikasi Pemasaran");
    // A take-home due a week after SIX's sitting is no conflict: the sitting is said plainly, the take-home on its own line.
    expect(row).toContain("DK4073 · Di kelas · 11:00–12:59 · TVST C");
    expect(row).not.toContain("SIX juga");
    expect(row).toContain("Take-home: UTS Markom · tenggat Kam, 22 Okt, 23:50");
    expect(row).not.toContain("Pastikan ke dosen");
    expect(examRow("DK4073")!.querySelector(".text-warning-fg")).toBeNull();
    expect(row).toContain("dalam 7 hari");
    expect(examSection()?.querySelector("h2")?.parentElement?.textContent).toContain("Masa UTS 12–16 Okt");
    // A row with only ITB's exam week gives the week's range on its date tile, never "Minggu" (it reads as Sunday);
    // the kind is said once, by the row's tag.
    const weekOnly = [...(examSection()?.querySelectorAll("li button") ?? [])].map((b) => b.textContent ?? "").find((t) => t.startsWith("7–22DesUAS"));
    // The tile gives the week; the row says what's still missing instead of repeating it.
    expect(weekOnly).toContain("Hari dan jamnya belum diumumkan");
    expect(examSection()?.textContent).not.toMatch(/minggu/i);
    // Under the list, once: how a take-home is told from a Task.
    expect(examSection()?.textContent).toContain("Take-home: tugas Edunex yang ditandai UTS atau UAS, atau yang namanya diawali UTS, UAS, Midex atau Finex.");
  });

  it("a take-home due before SIX's sitting: the tile shows the deadline's day, and the class sitting names its own", async () => {
    const world = new PretendWorld();
    world.edunex.moveDeadline(117764, "2026-10-12T23:59:00+07:00");
    await openTasks(world);
    const row = examRow("DK4073")!.textContent ?? "";
    expect(row.startsWith("Sen12Okt")).toBe(true);
    expect(row).toContain("DK4073 · Di kelas · Kam 15 Okt · 11:00–12:59 · TVST C");
    expect(row).toContain("Take-home: UTS Markom · tenggat Sen, 12 Okt, 23:59");
  });

  it("an exam that has passed moves to Selesai", async () => {
    const s = await openTasks();
    await s.click(/^Selesai/);
    // No past exams: the group isn't there at all.
    expect(examSection()).toBeNull();
    s.close();
    // The day after the take-home UTS was due: both dates are behind the Student.
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-23T09:00:00+07:00" }), signedIn: true, six: true });
    await screen.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(examRow("DK4073")).toBeUndefined();
    await screen.click(/^Selesai/);
    expect(examRow("DK4073")).toBeDefined();
  });
});

describe("the exam page", () => {
  it("what, when, where, how long until, what it covers, the take-home's note and the official pages", async () => {
    const s = await openTasks();
    await s.click(examRow("DK4073")!);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    const text = s.text();
    expect(text).toContain("Kamis, 15 Oktober · dalam 7 hari");
    // When and where first: the day, the time, the room.
    expect(text).toContain("Di kelasKam 15 Okt11:00–12:59 · 119 menitTVST C");
    // The take-home's card says how the app knows it's the exam's: Edunex files the Task under UTS.
    expect(text).toContain("Take-home · Edunex menandainya UTSKam 22 OktTenggat 23:50Buka tugas · UTS Markom");
    // Two parts, said calmly by the two cards: no warning, no strip repeating them, no question for the lecturer;
    // one link to where the lecturer says whether the sitting happens.
    expect(text).toContain("Buka tugas · UTS MarkomCek pengumuman dosen");
    expect(text).not.toContain("SIX juga");
    expect(text).not.toContain("SIX dan Edunex memberi tanggal berbeda");
    expect(s.has("Salin pertanyaan untuk dosen")).toBe(false);
    expect(document.querySelector("main section[aria-labelledby=exam-when] .bg-warning-bg")).toBeNull();
    await s.click("Cek pengumuman dosen");
    expect(s.text()).toContain("Pengumuman");
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "DK4073-UTS" } });
    // Real material: the lecturer's file to read in the app, and the modules before the exam.
    expect(s.text()).toContain("Bahan belajar");
    await s.click("Lihat UTS MARKOM SEM 1 2026 2027.pdf");
    expect(s.calls.at(-1)).toMatchObject({ name: "files.read", input: { as: "pdf" } });
    await s.key("Escape");
    expect(s.text()).toContain("Kehadiran sebelum ujian · Hadir 4 dari 6");

    // One quiet line of official pages.
    await s.click("Buka jadwal di SIX");
    expect(s.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001" },
    });
    await s.click("Buka tugasnya di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117764" } });

    // The take-home card opens the Task page.
    await s.click(/^Take-home/);
    expect(document.querySelector("main h1")?.textContent).toBe("UTS Markom");
  });

  it("two sittings on different days: the warning, and a question for the lecturer that greets for the time it's copied", async () => {
    const s = await openTasks(withEdunexSitting());
    expect(examRow("DK4073")!.textContent).toContain("SIX: Kam 15 Okt · Edunex: Jum 16 Okt. Pastikan ke dosen.");
    await s.click(examRow("DK4073")!);
    expect(s.text()).toContain("SIX dan Edunex memberi tanggal berbeda");
    expect(s.text()).toContain("SIX: Kam 15 Okt · Edunex: Jum 16 Okt.");
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => void (copied = text) } });
    await s.click("Salin pertanyaan untuk dosen");
    // The demo's morning: "Selamat pagi", never a fixed "Selamat siang". The take-home's deadline isn't one of the dates asked about.
    expect(copied).toMatch(
      /^Selamat pagi Bapak\/Ibu, mohon maaf mengganggu\. Untuk UTS DK4073 Komunikasi Pemasaran, SIX mencantumkan Kam 15 Okt, sedangkan Edunex Jum 16 Okt\./,
    );
  });

  it("exports the phone calendar from the page", async () => {
    const s = await openTasks();
    await s.click(examRow("DK4073")!);
    await s.click("Tambahkan ke kalender HP");
    await s.click(/^Simpan \d+ acara$/);
    expect(s.exported).toHaveLength(1);
  });

  it("without SIX: says SIX's exam timetable is missing, once, and an exam known only by its week says the week", async () => {
    screen = await openApp({ signedIn: true });
    const s = screen;
    // ITB's calendar (the exam weeks) is read after Edunex.
    await s.wait(5 * 60_000);
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(examSection()?.textContent).toContain("Ujian dari jadwal SIX (tanggal dan ruangnya) muncul setelah SIX terhubung.");
    expect(s.text().match(/muncul setelah SIX terhubung/g)).toHaveLength(1);
    await s.click(examRow("DK4073")!);
    const others = document.querySelector("main section[aria-labelledby=exam-others]")?.textContent ?? "";
    expect(others).toContain("PL3032Masa UTS");
    expect(others).not.toContain("Belum ada tanggal");
  });

  it("an exam known only by its week says, once and as its row does, that the day isn't announced", async () => {
    const s = await openTasks();
    await s.click(examRow("PL3032")!);
    expect(document.querySelector("main header")?.textContent).toContain("Hari dan jamnya belum diumumkan");
    const when = document.querySelector("main section[aria-labelledby=exam-when]")?.textContent ?? "";
    // The week, and where it's known from; "no date" isn't said again in other words.
    expect(when).toContain("Masa UTS 12–16 OktAda di daftar isi Edunex");
    expect(s.text()).not.toContain("belum ada tanggal");
    expect(s.text()).not.toContain("Belum ada tanggal");
    expect(s.text()).not.toContain("Belum dijadwalkan");
  });

  it("an exam known only from the outline, with no exam week in ITB's calendar either, says it has no date once", async () => {
    const world = new PretendWorld();
    world.itb.fail(/Kalender/i, 500);
    const s = await openTasks(world);
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "PL3032-UTS" } });
    const header = document.querySelector("main header")?.textContent ?? "";
    const when = document.querySelector("main section[aria-labelledby=exam-when]")?.textContent ?? "";
    expect(header).toContain("Belum ada tanggal");
    expect(when).toContain("Ada di daftar isi Edunex");
    expect(when).not.toContain("Belum ada tanggal");
    expect(when).not.toContain("Belum dijadwalkan");
  });

  it("an exam no longer listed says so", async () => {
    const s = await openTasks();
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "PL3002-UAS" } });
    expect(s.text()).toContain("Ujian ini tidak ada lagi di SIX maupun Edunex");
  });

  it("speaks English", async () => {
    const s = await openTasks();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    const row = examRow("DK4073")!;
    expect(row.textContent).toContain("DK4073 · In class · 11:00–12:59 · TVST C");
    await s.click(row);
    expect(s.text()).toContain("When and where");
    expect(s.text()).toContain("Check your lecturer's announcements");
    s.close();
    const other = await openTasks(withEdunexSitting());
    await other.engineDoes(() => other.engine.updateSettings({ lang: "en" }));
    expect(examRow("DK4073")!.textContent).toContain("SIX: Thu 15 Oct · Edunex: Fri 16 Oct. Check with your lecturer.");
    await other.click(examRow("DK4073")!);
    expect(other.text()).toContain("SIX and Edunex give different dates");
    expect(other.has("Copy a question for your lecturer")).toBe(true);
  });
});
