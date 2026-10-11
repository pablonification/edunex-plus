// @vitest-environment jsdom
// v2-09 (#77), seam 2: Beranda as the Student sees it, with the real engine,
// the pretend EduNex, SIX and ITB calendar behind the bridge.
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const section = (id: string) => document.querySelector(`main section[aria-labelledby="${id}"]`);
const text = (id: string) => section(id)?.textContent ?? "";
/** The "Needs you" rows by band, each row's title. */
const needs = () =>
  [...(section("home-needs")?.querySelectorAll("[role=group]") ?? [])].map((group) => [group.querySelector("h3")?.textContent, ...[...group.querySelectorAll("li")].map((li) => li.querySelector("p")?.textContent)]);
const row = (id: string, start: string) => [...(section(id)?.querySelectorAll("li") ?? [])].find((li) => li.textContent?.startsWith(start))?.textContent ?? "";

describe("Beranda on the recorded Thursday morning", () => {
  it("leads with what needs the Student, ranked and grouped, each with its sources", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(document.querySelector("main h2")?.textContent).toBe("Perlu perhatianmu5");
    expect(needs()).toEqual([
      ["Sekarang", "Catat kehadiran PL3002"],
      ["Segera", "Jangan lewatkan DK4073 hari ini", "Jangan lewatkan PL3032 hari ini", "II4091 ada pertemuan daring besok, 15:00–17:00", "KU5014 tak bisa lagi capai 80%"],
    ]);
    const presence = row("home-needs", "Catat kehadiran PL3002");
    expect(presence).toContain("Buka mata kuliahnya di EduNex · Kuliah sampai 10:00 · R.SG PWK LT.6 · biasanya 08:00–09:30");
    expect(presence).toContain("Kehadiranmu dihitung di SIX; Presensi EduNex juga dibuka.");
    expect(presence).toContain("PL3002EduNexSIXtutup 09:30");
    expect(row("home-needs", "Jangan lewatkan DK4073")).toContain("11:00–12:59 · TVST C · Presensi di SIX · Tidak boleh absen lagi");
    expect(row("home-needs", "II4091 ada pertemuan")).toContain("Pertemuan 3 hanya diumumkan di EduNex, tidak ada di jadwal SIX.");
    expect(row("home-needs", "KU5014 tak bisa")).toContain("SIXKalender ITB");
    // The midterm week from ITB's calendar.
    expect(screen.text()).toContain("Kalender ITBMasa UTS mulai Senin, 12 Okt");
  });

  it("each item's one action: the official page, the online class, or the app's own screen", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click("Buka di EduNex: Catat kehadiran PL3002");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
    await screen.click(/^Gabung kelas daring: II4091 ada pertemuan/);
    expect(screen.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: expect.stringContaining("teams.microsoft.com") } });
    await screen.click("Lihat kehadiran: KU5014 tak bisa lagi capai 80%");
    expect(document.querySelector("h1")?.textContent).toBe("Presensi");
  });

  it("today: SIX's classes with time and room, where attendance counts, absences left, the moved class, the countdown and tomorrow's online meeting", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const today = text("home-today");
    // SIX is read at human pace: signing in took a minute or so of the morning.
    expect(today).toMatch(/Kuliah berikutnya dalam 2 jam 4\d mnt/);
    expect(row("home-today", "08:0010:00")).toBe("08:0010:00Ekonomi dan Inovasi dalam PerencanaanPL3002R.SG PWK LT.6Presensi di SIXBoleh absen 2x lagiBerubah · biasanya 08:00–09:30Sekarang");
    expect(row("home-today", "11:00")).toContain("Komunikasi PemasaranDK4073TVST CPresensi di SIXTidak boleh absen lagidalam 3 jam");
    expect(row("home-today", "16:00")).toContain("80% tak tercapai · maks. 73%");
    expect(row("home-today", "Besok")).toBe("Besok15:00–17:00II4091 Pertemuan 3 · daringTidak ada di SIXGabung");
    await screen.click("Gabung kelas daring: II4091");
    expect(screen.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: expect.stringContaining("teams.microsoft.com") } });
    expect(today).toContain("Tidak ada tenggat hari ini dan besok");
  });

  it("what changed: the moved class and the meeting announced outside SIX, by day, each opening its screen", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const changes = text("home-changes");
    expect(changes).toContain("Hari iniJadwal PL3002 berubahSIXKam, 8 Okt 08:00–10:00 · biasanya 08:00–09:30");
    expect(changes).toContain("Pertemuan 3 II4091 diumumkan di EduNexEduNexJum, 9 Okt 15:00–17:00 · tidak ada di jadwal SIX");
    // An old meeting re-read in the same text isn't news.
    expect(changes).not.toContain("Pertemuan 2 II4091");
    await screen.click(/^Pertemuan 3 II4091 diumumkan/);
    expect(document.querySelector("h1")?.textContent).toContain("Proposal Tugas Akhir");
  });

  it("speaks English", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(needs()[0]).toEqual(["Right now", "Record your PL3002 attendance"]);
    expect(needs()[1]).toContain("Don't miss DK4073 today");
    expect(needs()[1]).toContain("KU5014 can't reach 80% anymore");
    expect(row("home-needs", "Record your")).toContain("Open the course in EduNex · Class until 10:00 · R.SG PWK LT.6 · usually 08:00–09:30");
    expect(text("home-today")).toMatch(/Next class in 2h 4\dm/);
    expect(row("home-today", "08:00")).toContain("Attendance in SIX2 more absences allowedChanged · usually 08:00–09:30Now");
    expect(text("home-changes")).toContain("TodayPL3002 schedule changedSIXThu, 8 Oct 08:00–10:00 · usually 08:00–09:30");
    expect(screen.text()).toContain("Midterm week starts Monday, 12 Oct");
  });
});

describe("an exam on Beranda", () => {
  it("within the week: what, when and where, that SIX and EduNex disagree, and its page one click away", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-13T09:00:00+07:00" }), signedIn: true, six: true });
    const exam = row("home-needs", "UTS DK4073");
    expect(exam).toContain("UTS DK4073 Kam, 15 Okt, 11:00–12:59");
    expect(exam).toContain("Ruang TVST C · Dua tanggal berbeda. Pastikan ke dosen.");
    expect(exam).toContain("DK4073SIXEduNex");
    await screen.click(/^Persiapan: UTS DK4073/);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    expect(screen.text()).toContain("Kapan dan di mana");
  });

  it("speaks English", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-14T09:00:00+07:00" }), signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    const exam = row("home-needs", "DK4073 UTS");
    expect(exam).toContain("DK4073 UTS tomorrow, 11:00–12:59");
    expect(exam).toContain("Room TVST C · Two different dates. Check with your lecturer.");
  });
});

describe("a Presence window ahead", () => {
  it("a Task that takes attendance: what to hand in and when, said once, and the Task one click away", async () => {
    screen = await openApp({ signedIn: true, world: new PretendWorld({ now: "2026-10-11T21:00:00+07:00" }) });
    await screen.wait();
    const ahead = row("home-needs", "Kumpulkan Tugas 02 Bab II");
    expect(ahead).toContain("Kumpulkan Tugas 02 Bab II · Jum, 16 Okt, 15:00–23:59");
    expect(ahead).toContain("Ini Presensi-nya: hanya terhitung jika dikumpulkan di dalam jendela itu.");
    expect(ahead.match(/Tugas 02 Bab II/g)).toHaveLength(1);
    await screen.click(/^Buka tugas: Kumpulkan Tugas 02 Bab II/);
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });
});

describe("a class moved to another day", () => {
  it("names the usual day: today's Friday meeting stands in for the week's Thursday one", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-16T07:00:00+07:00" }), signedIn: true });
    const meeting = (id: string, start: string) => {
      const at = Date.parse(`${start}+07:00`);
      return { id, courseCode: "PL3002", courseName: "Ekonomi dan Inovasi dalam Perencanaan", start: at, end: at + 90 * 60_000, activity: "Kuliah", room: "R.SG PWK LT.6" };
    };
    const schedule = [meeting("1", "2026-10-01T08:00:00"), meeting("2", "2026-10-08T08:00:00"), meeting("3", "2026-10-16T10:00:00"), meeting("4", "2026-10-22T08:00:00")];
    await screen.apply({ type: "dataset", dataset: { name: "six.schedule", value: schedule, fetchedAt: 0, hash: "s1" } });
    await screen.apply({ type: "dataset", dataset: { name: "six.scheduleMonths", value: ["2026-10"], fetchedAt: 0, hash: "s2" } });
    expect(row("home-today", "10:00")).toContain("Berubah · biasanya Kamis 08:00–09:30");
  });
});

describe("Tasks on Beranda", () => {
  it("a Task due tonight is in Needs you and due today; edited after handing in, it says to check", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    screen.world.edunex.editTask(117432, { description: "<p>Tambahkan referensi.</p>" });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    expect(needs()[0]).toEqual(["Sekarang", "Catat kehadiran PL3002", "Tugas tentang Imfact on Innovation The Economy  Kampus Ganesha", "Ringkasan K5"]);
    expect(row("home-needs", "Tugas tentang Imfact")).toContain("Diubah dosen baru saja, setelah kamu kumpulkan · cek apakah perlu dikumpulkan ulang");
    expect(row("home-needs", "Ringkasan K5")).toContain("Tenggat Hari ini, 23:59");
    expect(text("home-today")).toContain("Tenggat hari ini dan besokPL3032Ringkasan K5Hari ini, 23:59");
    expect(text("home-changes")).toContain("Tugas baru · PL3032EduNexRingkasan K5");
    await screen.click("Buka tugas: Ringkasan K5");
    expect(document.querySelector("h1")?.textContent).toBe("Ringkasan K5");
  });
});

describe("nothing to do", () => {
  it("says so plainly, and claims nothing before EduNex's Tasks arrive", async () => {
    const world = new PretendWorld({ now: "2026-10-10T10:00:00+07:00" });
    world.edunex.tasks.clear();
    world.edunex.presences.clear();
    world.edunex.contents.clear();
    world.edunex.announcements.clear();
    screen = await openApp({ world, signedIn: true });
    expect(text("home-needs")).toContain("Tidak ada yang perlu kamu urus sekarang.");
    expect(text("home-today")).toContain("Jadwal dan ruang kuliah muncul setelah SIX terhubung.");
    expect(text("home-changes")).toContain("Tidak ada perubahan minggu ini");
    // SIX is a click away from where its classes would be.
    await screen.click("Masuk ke SIX");
    await screen.wait();
    expect(screen.store.status("six").state).toBe("live");
    expect(text("home-today")).not.toContain("muncul setelah SIX terhubung");
  });
});
