// @vitest-environment jsdom
// #81 (spec story 68), seam 2: the first-run scan as the Student sees it,
// after the real engine's first full sync of the pretend Edunex, SIX and ITB
// calendar: when it opens by itself (once), what each line says, where each
// line goes, and opening it again from Settings.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const TIMETABLE = /\/kelas\/jadwal\/mahasiswa\/\d+$/;

const dialog = () =>
  [...document.querySelectorAll<HTMLElement>("[role=dialog]")].find(
    (d) => d.querySelector("h2")?.textContent === "Ringkasan saat pertama terhubung" || d.querySelector("h2")?.textContent === "Your first-connection summary",
  );
const lines = () => [...(dialog()?.querySelectorAll<HTMLButtonElement>("ol > li > button") ?? [])];
/** Each line's title (its accessible name). */
const titles = () => lines().map((line) => document.getElementById(line.getAttribute("aria-labelledby") ?? "")?.textContent);
const line = (title: string) =>
  lines().find((button) => document.getElementById(button.getAttribute("aria-labelledby") ?? "")?.textContent?.startsWith(title))!;
/** What a line says under its title. */
const detail = (title: string) => document.getElementById(line(title).getAttribute("aria-describedby") ?? "")?.textContent;
const h1 = () => document.querySelector("main h1")?.textContent;
const activeTab = () => document.querySelector("main [role=tab][data-state=active]")?.textContent;

async function press(key: string) {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("after the first full sync of Edunex and SIX", () => {
  it("opens by itself with what neither system says: each line with its number, the specifics and where they come from", async () => {
    screen = await openApp({ firstScan: true, signedIn: true, six: true });
    expect(dialog()).toBeDefined();
    expect(dialog()?.querySelector("p")?.textContent).toBe("Edunex dan SIX terhubung · 5 mata kuliah, 10 tugas dibaca");
    expect(dialog()?.querySelector("h3")?.textContent).toBe("7 hal yang tidak disampaikan kedua sistem");
    expect(titles()).toEqual([
      "Kehadiran 3 mata kuliah berisiko",
      "KU5014 dan PL3032 bentrok di 5 pertemuan",
      "Kehadiran 1 mata kuliah dihitung di SIX, bukan Edunex",
      "3 ujian akan datang",
      "1 pertemuan hanya diumumkan di Edunex",
      "Dosen mengubah 6 tugas setelah diunggah",
      "IPK 3,26 · di bawah cum laude",
    ]);
    // Calm and action-first: the facts, then what to do. PL3002, with one absence still allowed, isn't at risk.
    expect(detail("Kehadiran 3")).toBe("KU5014: hadir 2 dari 6 · paling tinggi 73% dari target 80%DK4073: jangan absen lagiPL3032: jangan absen lagi");
    expect(detail("KU5014 dan PL3032")).toBe("Berikutnya Hari ini, 16:00–16:30. Pilih yang akan kamu hadiri, atau tanyakan ke dosen.");
    expect(detail("Kehadiran 1")).toBe('PL3002: SIX mencatat hadir 6 dari 7; abaikan 5 "absen" di EdunexTandai Hadir di SIX; Presensi Edunex tidak wajib.');
    // DK4073's UTS is one exam: SIX's sitting, with the take-home a week later said calmly as its second part.
    expect(detail("3 ujian")).toBe(
      "UTS PL3032, minggu UTS 12–16 OktUTS DK4073: Kam 15 Okt, 11:00 · TVST C · Take-home tenggat Kam 22 OktUAS PL3032, minggu UAS 7–22 Des",
    );
    expect(detail("1 pertemuan")).toBe("II4091 pertemuan 3: Besok, 15:00–17:00 · daringTidak ada di jadwal SIX; sudah ada di Beranda.");
    expect(detail("Dosen mengubah")).toBe("2 di antaranya setelah kamu mengumpulkan. Cek lagi instruksinya; Edunex tidak mengabarkannya.");
    expect(detail("IPK")).toBe("Kurang 0,24 untuk cum laude (3,50).");
    // No source tags: a line is its title and its facts.
    expect(line("Kehadiran 3").textContent).toBe(`Kehadiran 3 mata kuliah berisiko${detail("Kehadiran 3")}`);
    // "Ke Beranda" is always in reach, however long the list.
    expect(screen.button("Ke Beranda").closest(".sticky")).not.toBeNull();
    // Shown once: remembered right away.
    expect(screen.engine.snapshot().settings.firstScanDone).toBe(true);
  });

  it("each line opens the screen that shows it, and the scan closes", async () => {
    screen = await openApp({ firstScan: true, signedIn: true, six: true });
    // The overlap opens Jadwal, where both classes show side by side.
    await screen.click(line("KU5014 dan PL3032"));
    expect(dialog()).toBeUndefined();
    expect(h1()).toBe("Jadwal");

    const again = async () => {
      await screen!.apply({ type: "command", command: "settings" });
      await screen!.click("Lihat: Ringkasan saat pertama terhubung");
    };
    await again();
    // The soonest exam's page: PL3032's UTS, named only in its Edunex outline.
    await screen.click(line("3 ujian"));
    expect(h1()).toBe("Ekonomi Infrastruktur dan Transportasi");
    expect(document.querySelector("main")?.textContent).toContain("UTS");

    await again();
    await screen.click(line("Kehadiran 3"));
    expect(h1()).toBe("Presensi");

    await again();
    await screen.click(line("IPK"));
    expect(h1()).toBe("Nilai");

    await again();
    await screen.click(line("1 pertemuan"));
    expect(h1()).toBe("Proposal Tugas Akhir");
    expect(activeTab()).toMatch(/^Pertemuan/);

    await again();
    await screen.click("Ke Beranda");
    expect(dialog()).toBeUndefined();
    expect(document.getElementById("home-needs")?.textContent).toMatch(/^Perlu perhatianmu/);
  });

  it("is shown once: Escape closes it, it doesn't come back at the next launch, and Settings opens it again", async () => {
    const world = new PretendWorld();
    const storage = new MemoryStorage();
    const vault = new MemoryVault();
    screen = await openApp({ world, storage, vault, firstScan: true, signedIn: true, six: true });
    expect(dialog()).toBeDefined();
    await press("Escape");
    expect(dialog()).toBeUndefined();
    screen.close();

    screen = await openApp({ world, storage, vault, firstScan: true });
    await screen.wait(60_000);
    expect(screen.store.status("six").state).toBe("live");
    expect(dialog()).toBeUndefined();

    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Lihat: Ringkasan saat pertama terhubung");
    expect(titles()).toHaveLength(7);
  });
});

describe("after the welcome screen", () => {
  it("with SIX connected right after Edunex, it waits for SIX's first read and speaks for both", async () => {
    screen = await openApp({ firstScan: true });
    await screen.click("Hubungkan Edunex");
    await screen.click("Hubungkan SIX");
    expect(dialog()).toBeUndefined();
    await screen.click("Lanjut");
    expect(dialog()?.querySelector("h3")?.textContent).toBe("7 hal yang tidak disampaikan kedua sistem");
  });

  it("with Edunex alone, what Edunex doesn't say; connecting SIX later doesn't bring it back by itself", async () => {
    screen = await openApp({ firstScan: true });
    await screen.click("Hubungkan Edunex");
    await screen.click("Lanjut");
    // ITB's calendar is still on its way: the scan waits for it.
    expect(screen.store.status("itb").state).toBe("connecting");
    expect(dialog()).toBeUndefined();
    await screen.wait();
    expect(dialog()?.querySelector("p")?.textContent).toBe("Edunex terhubung · 5 mata kuliah, 10 tugas dibaca");
    expect(dialog()?.querySelector("h3")?.textContent).toBe("2 hal yang tidak disampaikan Edunex");
    expect(titles()).toEqual(["3 ujian akan datang", "Dosen mengubah 6 tugas setelah diunggah"]);
    await press("Escape");

    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Masuk ke SIX");
    await press("Escape");
    expect(screen.store.status("six").state).toBe("live");
    await screen.wait();
    expect(dialog()).toBeUndefined();
  });
});

describe("only with something to say", () => {
  it("nothing found: it doesn't open; from Settings it says so", async () => {
    // Long after the term's exams, with no Tasks, Presence, materials or announcements.
    const world = new PretendWorld({ now: "2027-01-10T10:00:00+07:00" });
    world.edunex.tasks.clear();
    world.edunex.presences.clear();
    world.edunex.contents.clear();
    world.edunex.announcements.clear();
    screen = await openApp({ world, firstScan: true, signedIn: true });
    await screen.wait();
    expect(dialog()).toBeUndefined();
    expect(screen.engine.snapshot().settings.firstScanDone).toBe(true);

    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Lihat: Ringkasan saat pertama terhubung");
    expect(dialog()?.textContent).toContain("Tidak ada yang perlu kamu perhatikan");
    expect(dialog()?.querySelector("h3")).toBeNull();
  });

  it("names what couldn't be read, and leaves out the lines that need it", async () => {
    const world = new PretendWorld();
    world.six.fail(TIMETABLE, 503);
    screen = await openApp({ world, firstScan: true, signedIn: true, six: true });
    expect(screen.store.status("six").state).toBe("offline");
    // Without SIX's timetable: no attendance budget, no overlaps, no meetings outside it, no SIX exam session.
    expect(titles()).toEqual([
      "Kehadiran 1 mata kuliah dihitung di SIX, bukan Edunex",
      "3 ujian akan datang",
      "Dosen mengubah 6 tugas setelah diunggah",
      "IPK 3,26 · di bawah cum laude",
      "1 bagian tidak terbaca",
    ]);
    expect(detail("1 bagian")).toBe("SIX tidak bisa dihubungi: Jadwal");
    // What couldn't be read isn't counted as something neither system says.
    expect(dialog()?.querySelector("h3")?.textContent).toBe("4 hal yang tidak disampaikan kedua sistem");
    await screen.click(line("1 bagian"));
    expect(document.getElementById("home-needs")?.textContent).toMatch(/^Perlu perhatianmu/);
  });
});

describe("a course with one absence left", () => {
  it("isn't at risk, as Beranda and Presensi (green) say: an absence is still allowed", async () => {
    const world = new PretendWorld();
    world.six.setAttendance("DK4073", 7, 7);
    screen = await openApp({ world, firstScan: true, signedIn: true, six: true });
    expect(detail("Kehadiran 2")).toBe("KU5014: hadir 2 dari 6 · paling tinggi 73% dari target 80%PL3032: jangan absen lagi");
    expect(detail("Kehadiran 2")).not.toContain("PL3002");
  });
});

describe("in English", () => {
  it("says the same", async () => {
    const world = new PretendWorld();
    const storage = new MemoryStorage();
    screen = await openApp({ world, storage, signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en", firstScanDone: false }));
    await screen.wait(1_000);
    expect(dialog()?.querySelector("h2")?.textContent).toBe("Your first-connection summary");
    expect(dialog()?.querySelector("p")?.textContent).toBe("Edunex and SIX connected · 5 courses, 10 Tasks read");
    expect(dialog()?.querySelector("h3")?.textContent).toBe("7 things neither system tells you");
    expect(titles()).toEqual([
      "Attendance at risk in 3 courses",
      "KU5014 and PL3032 overlap in 5 meetings",
      "1 course counts attendance in SIX, not Edunex",
      "3 upcoming exams",
      "1 meeting announced only in Edunex",
      "Lecturers edited 6 Tasks after posting them",
      "IPK 3.26 · below cum laude",
    ]);
    expect(detail("Attendance")).toBe("KU5014: 2 of 6 · best case 73% of the 80% targetDK4073: don't miss another classPL3032: don't miss another class");
    expect(detail("IPK")).toBe("0.24 short of cum laude (3.50).");
    expect(screen.button("Go to Home")).toBeDefined();
  });
});
