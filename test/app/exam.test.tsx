// @vitest-environment jsdom
// Exams in one place (#77), seam 2: the exam list in Tugas & Ujian and the
// exam page, from the real engine reading the pretend Edunex, SIX and ITB
// calendar. Recorded: DK4073's UTS in class in SIX (15 October, TVST C) and
// its take-home UTS Task in Edunex due a week later: two dates that disagree.
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

async function openTasks() {
  screen = await openApp({ signedIn: true, six: true });
  await screen.click(/^Tugas & Ujian\d*$/);
  return screen;
}

describe("the exam list", () => {
  it("merges SIX's UTS in class and Edunex's take-home UTS, warns they disagree, and lists ITB's exam weeks", async () => {
    await openTasks();
    const row = examRow("DK4073")!.textContent ?? "";
    // The date leads; the kind is a quiet label; no source tags, the source only where they disagree.
    expect(row.startsWith("Kam15Okt")).toBe(true);
    expect(row).toContain("UTSKomunikasi Pemasaran");
    expect(row).toContain("Di kelas · 11:00–12:59 · TVST C");
    expect(row).toContain("Take-home: UTS Markom · tenggat Kam, 22 Okt, 23:50");
    expect(row).toContain("SIX: Kam 15 Okt · Edunex: Kam 22 Okt. Pastikan ke dosen.");
    expect(row).toContain("dalam 7 hari");
    expect(examSection()?.querySelector("h2")?.parentElement?.textContent).toContain("Masa UTS 12–16 Okt");
    // A row with only ITB's exam week names the period on its date tile, never "Minggu" (it reads as Sunday).
    const weekOnly = [...(examSection()?.querySelectorAll("li button") ?? [])].map((b) => b.textContent ?? "").find((t) => t.startsWith("UAS7–22Des"));
    // The tile gives the week; the row says what's still missing instead of repeating it.
    expect(weekOnly).toContain("Hari dan jamnya belum diumumkan");
    expect(examSection()?.textContent).not.toMatch(/minggu/i);
  });

  it("an exam that has passed moves to Selesai", async () => {
    const s = await openTasks();
    await s.click(/^Selesai/);
    // No past exams: the group isn't there at all.
    expect(examSection()).toBeNull();
    s.close();
    // The day after the take-home UTS was due: both dates are behind the Student.
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-23T09:00:00+07:00" }), signedIn: true, six: true });
    await screen.click(/^Tugas & Ujian\d*$/);
    expect(examRow("DK4073")).toBeUndefined();
    await screen.click(/^Selesai/);
    expect(examRow("DK4073")).toBeDefined();
  });
});

describe("the exam page", () => {
  it("what, when, where, how long until, what it covers, the warning and the official pages", async () => {
    const s = await openTasks();
    await s.click(examRow("DK4073")!);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    const text = s.text();
    expect(text).toContain("Kamis, 15 Oktober · dalam 7 hari");
    // When and where first: the day, the time, the room.
    expect(text).toContain("Di kelasKam 15 Okt11:00–12:59 · 119 menitTVST C");
    expect(text).toContain("Take-homeKam 22 OktTenggat 23:50Buka tugas · UTS Markom");
    // The disagreement, with something to do about it.
    expect(text).toContain("SIX dan Edunex memberi tanggal berbeda");
    expect(text).toContain("SIX: Kam 15 Okt · Edunex: Kam 22 Okt.");
    await s.click("Lihat pengumuman");
    expect(s.text()).toContain("Pengumuman");
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "DK4073-UTS" } });
    // Real material: the lecturer's file to download, and the modules before the exam.
    expect(s.text()).toContain("Bahan belajar");
    await s.click("Unduh UTS MARKOM SEM 1 2026 2027.pdf");
    expect(s.calls.at(-1)?.name).toBe("files.download");
    expect(s.text()).toContain("Kehadiran sebelum ujian · Hadir 4 dari 6");

    // One quiet line of official pages.
    await s.click("Lihat di SIX");
    expect(s.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001" },
    });
    await s.click("Lihat tugas di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117764" } });

    // The take-home card opens the Task page.
    await s.click(/^Take-home/);
    expect(document.querySelector("main h1")?.textContent).toBe("UTS Markom");
  });

  it("the question for the lecturer greets for the time it's copied", async () => {
    const s = await openTasks();
    await s.click(examRow("DK4073")!);
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => void (copied = text) } });
    await s.click("Salin pertanyaan untuk dosen");
    // The demo's morning: "Selamat pagi", never a fixed "Selamat siang".
    expect(copied).toMatch(/^Selamat pagi Bapak\/Ibu, mohon maaf mengganggu\. Untuk UTS DK4073 Komunikasi Pemasaran, SIX mencantumkan/);
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
    await s.click(/^Tugas & Ujian\d*$/);
    expect(examSection()?.textContent).toContain("Ujian dari jadwal SIX (tanggal dan ruangnya) muncul setelah SIX terhubung.");
    expect(s.text().match(/muncul setelah SIX terhubung/g)).toHaveLength(1);
    await s.click(examRow("DK4073")!);
    const others = document.querySelector("main section[aria-labelledby=exam-others]")?.textContent ?? "";
    expect(others).toContain("PL3032Masa UTS");
    expect(others).not.toContain("Belum ada tanggal");
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
    expect(row.textContent).toContain("In class · 11:00–12:59 · TVST C");
    expect(row.textContent).toContain("SIX: Thu 15 Oct · Edunex: Thu 22 Oct. Check with your lecturer.");
    await s.click(row);
    expect(s.text()).toContain("When and where");
    expect(s.text()).toContain("SIX and Edunex give different dates");
    expect(s.has("Copy a question for your lecturer")).toBe(true);
  });
});
