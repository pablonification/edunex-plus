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

// Every row of the one list (a period line's own button aside: it opens and closes, it doesn't go anywhere).
const rows = () => [...document.querySelectorAll<HTMLButtonElement>("main li button")].filter((b) => !b.hasAttribute("aria-expanded") && b.closest("li"));
/** An exam's row that opens its page: a sitting, a window, or an exam with no day under its period's line (never its take-home). */
const examRow = (code: string) => rows().find((b) => b.textContent?.includes(code) && !/Take-home · /.test(b.textContent ?? ""));
const takeHomeRow = (code: string) => rows().find((b) => b.textContent?.includes(code) && /Take-home · /.test(b.textContent ?? ""));
const periodLine = (kind: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("main li > button[aria-expanded]")].find((b) => b.textContent?.startsWith(kind));
const section = (title: string) => [...document.querySelectorAll("main section")].find((s) => s.querySelector("h2")?.textContent?.startsWith(title));

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

describe("exams in the one list", () => {
  it("SIX's UTS in class and Edunex's take-home UTS are two parts, each at its own moment, calmly; ITB's weeks are one line each", async () => {
    await openTasks();
    // No Exams section on top: the exam's parts sit among the Tasks.
    expect(document.querySelector("main section[aria-labelledby=tasks-exams]")).toBeNull();
    const sitting = examRow("DK4073")!.textContent ?? "";
    // The kind is a quiet tag; the source only where it changes what to do; the date column says day and time range.
    expect(sitting).toBe("UTSKomunikasi PemasaranDK4073 · Di kelas · TVST CKam, 15 Okt11:00–12:59");
    expect(examRow("DK4073")!.querySelector(".text-warning-fg")).toBeNull();
    // The take-home is its own row at its deadline, with its exam's tag, opening the Task page.
    expect(takeHomeRow("DK4073")!.textContent).toBe("UTSKomunikasi PemasaranDK4073 · Take-home · UTS MarkomKam, 22 Okt, 23:50dalam 14 hari");
    expect(sitting).not.toContain("SIX juga");
    expect(sitting).not.toContain("Pastikan ke dosen");
    // An exam known only by ITB's week is under that week's line, which gives the range and never "Minggu" (it reads as Sunday).
    expect(periodLine("Masa UTS")!.textContent).toBe("Masa UTSHari ujian PL3032 belum diumumkan12–16 Oktdalam 4 hari");
    expect(periodLine("Masa UAS")!.textContent).toBe("Masa UASHari ujian PL3032 belum diumumkan7–22 Desdalam 60 hari");
    expect(periodLine("Masa UAS")!.textContent).not.toMatch(/minggu/i);
    expect(examRow("PL3032")!.textContent).toBe("UTSEkonomi Infrastruktur dan TransportasiPL3032 · Hari dan jamnya belum diumumkan");
    // No footnote on how a take-home is told from a Task: its row says "Take-home".
    expect(screen!.text()).not.toContain("Take-home: tugas Edunex yang ditandai");
    await screen!.click(takeHomeRow("DK4073")!);
    expect(document.querySelector("main h1")?.textContent).toBe("UTS Markom");
  });

  it("a take-home due before SIX's sitting comes first, at its own day", async () => {
    const world = new PretendWorld();
    world.edunex.moveDeadline(117764, "2026-10-12T23:59:00+07:00");
    await openTasks(world);
    const order = rows().map((b) => b.textContent ?? "");
    expect(order.findIndex((t) => t.includes("Take-home · UTS Markom"))).toBeLessThan(order.findIndex((t) => t.includes("DK4073 · Di kelas")));
    expect(takeHomeRow("DK4073")!.textContent).toContain("Sen, 12 Okt, 23:59");
  });

  it("an exam is over once every part is: then it waits in Selesai under Past exams", async () => {
    const s = await openTasks();
    await s.click(/^Selesai/);
    // No past exams: the group isn't there at all.
    expect(section("Ujian yang sudah lewat")).toBeUndefined();
    s.close();
    // The day after the take-home UTS was due (not taken late): the sitting and the take-home are both behind the Student.
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-23T09:00:00+07:00" }), signedIn: true, six: true });
    await screen.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(examRow("DK4073")).toBeUndefined();
    // PL3032's UTS week ended with no day ever given: over too.
    expect(periodLine("Masa UTS")).toBeUndefined();
    await screen.click(/^Selesai/);
    expect(section("Ujian yang sudah lewat")?.textContent).toContain("Ujian yang sudah lewat 2");
    expect(examRow("DK4073")!.textContent).toBe("UTSKomunikasi PemasaranDK4073 · Di kelas · TVST CKam, 15 Okt11:00–12:59");
    expect(examRow("PL3032")!.textContent).toBe("UTSEkonomi Infrastruktur dan TransportasiPL3032 · Harinya tidak pernah diumumkan12–16 OktMasa UTS");
    // The take-home, closed without a hand-in, is with the Tasks that closed, in its exam's look.
    expect(section("Ditutup, tidak dikumpulkan")?.textContent).toContain("UTSKomunikasi PemasaranDK4073 · Take-home · UTS Markom");
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
    // Both sittings say it, each at its own day.
    expect(examRow("DK4073")!.textContent).toContain("SIX: Kam 15 Okt · Edunex: Jum 16 Okt. Pastikan ke dosen.");
    expect(rows().find((b) => b.textContent?.includes("DK4073 · Di Edunex · UTS Markom"))!.textContent).toContain("Pastikan ke dosen.");
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
    // Said once, at the end of the list, with the way to SIX.
    expect(s.text()).toContain("Ujian dari jadwal SIX (tanggal dan ruangnya) muncul setelah SIX terhubung.");
    expect(s.text().match(/muncul setelah SIX terhubung/g)).toHaveLength(1);
    // Without SIX, DK4073's UTS is only its take-home: its row opens the Task page, which leads to the exam.
    await s.click(takeHomeRow("DK4073")!);
    await s.click(/^Bagian dari UTS DK4073/);
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

  it("once it's over: its day and how long ago, no attendance to watch, and the exams still ahead first among the others", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-23T09:00:00+07:00" }), signedIn: true, six: true });
    const s = screen;
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "DK4073-UTS" } });
    expect(document.querySelector("main header")?.textContent).toContain("Kamis, 15 Oktober · 8 hari yang lalu");
    expect(s.text()).not.toContain("Kehadiran sebelum ujian");
    const others = [...document.querySelectorAll("main section[aria-labelledby=exam-others] li")].map((li) => li.textContent);
    // PL3032's UAS is still to come; its UTS week ended with no day.
    expect(others).toEqual(["UASPL3032Masa UAS 7–22 Des", "UTSPL3032Masa UTS 12–16 Okt"]);
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "PL3032-UTS" } });
    expect(document.querySelector("main header")?.textContent).toContain("Harinya tidak pernah diumumkan");
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
    expect(row.textContent).toBe("UTSKomunikasi PemasaranDK4073 · In class · TVST CThu, 15 Oct11:00–12:59");
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
