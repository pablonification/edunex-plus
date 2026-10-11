// @vitest-environment jsdom
// Exams in one place (#77), seam 2: the exam list in Tugas & Ujian and the
// exam page, from the real engine reading the pretend EduNex, SIX and ITB
// calendar. Recorded: DK4073's UTS in class in SIX (15 October, TVST C) and
// its take-home UTS Task in EduNex due a week later: two dates that disagree.
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const examSection = () => document.querySelector('main section[aria-label="Ujian"]');
const examRow = (code: string) => [...(examSection()?.querySelectorAll("li button") ?? [])].find((b) => b.textContent?.includes(code)) as HTMLButtonElement | undefined;

async function openTasks() {
  screen = await openApp({ signedIn: true, six: true });
  await screen.click(/^Tugas & Ujian\d*$/);
  return screen;
}

describe("the exam list", () => {
  it("merges SIX's UTS in class and EduNex's take-home UTS, warns they disagree, and lists ITB's exam weeks", async () => {
    await openTasks();
    const row = examRow("DK4073")!.textContent ?? "";
    expect(row).toContain("UTS");
    expect(row).toContain("Komunikasi Pemasaran");
    expect(row).toContain("SIXDi kelas · Kam 15 Okt, 11:00–12:59 · TVST C");
    expect(row).toContain("EduNexTake-home · Tenggat Kam, 22 Okt, 23:50");
    expect(row).toContain("Dua tanggal berbeda. Pastikan ke dosen.");
    expect(row).toContain("dalam 7 hari");
    expect(examSection()?.textContent).toContain("Kalender ITBMasa UTS 12 Okt–16 Okt · Masa UAS 7 Des–22 Des");
  });

  it("an exam that has passed moves to Selesai", async () => {
    const s = await openTasks();
    await s.click("Selesai");
    expect(examSection()?.textContent).toContain("Belum ada ujian yang lewat");
    s.close();
    // The day after the take-home UTS was due: both dates are behind the Student.
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-23T09:00:00+07:00" }), signedIn: true, six: true });
    await screen.click(/^Tugas & Ujian\d*$/);
    expect(examRow("DK4073")).toBeUndefined();
    await screen.click("Selesai");
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
    expect(text).toContain("Di kelasSIXKam 15 Okt, 11:00–12:59");
    expect(text).toContain("TVST C · 119 menit");
    expect(text).toContain("Take-homeEduNexTenggat Kam, 22 Okt, 23:50");
    expect(text).toContain("SIX dan EduNex memberi tanggal berbeda untuk ujian ini.");
    expect(text).toContain("Bahan ujian");
    expect(text).toContain("Kehadiran 4/6");

    await s.click("Buka jadwal di SIX");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001" } });
    await s.click("Buka tugasnya di EduNex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117764" } });

    // The take-home card opens the Task page.
    await s.click(/^Take-homeEduNex/);
    expect(document.querySelector("main h1")?.textContent).toBe("UTS Markom");
  });

  it("exports the phone calendar from the page", async () => {
    const s = await openTasks();
    await s.click(examRow("DK4073")!);
    await s.click("Tambahkan ke kalender HP");
    expect(s.exported).toHaveLength(1);
  });

  it("an exam no longer listed says so", async () => {
    const s = await openTasks();
    await s.apply({ type: "navigate", route: { screen: "exam", examId: "PL3002-UAS" } });
    expect(s.text()).toContain("Ujian ini tidak ada lagi di SIX maupun EduNex");
  });

  it("speaks English", async () => {
    const s = await openTasks();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    const row = [...(document.querySelector('main section[aria-label="Exams"]')?.querySelectorAll("li button") ?? [])].find((b) => b.textContent?.includes("DK4073"))!;
    expect(row.textContent).toContain("In class · Thu 15 Oct, 11:00–12:59 · TVST C");
    expect(row.textContent).toContain("Two different dates. Check with your lecturer.");
    await s.click(row as HTMLButtonElement);
    expect(s.text()).toContain("When and where");
    expect(s.text()).toContain("SIX and EduNex give different dates for this exam.");
  });
});
