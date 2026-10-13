// @vitest-environment jsdom
// v2-09 (#77), seam 2: Beranda as the Student sees it, with the real engine,
// the pretend Edunex, SIX and ITB calendar behind the bridge.
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
/** A section's rows, each row's text. */
const rows = (id: string) => [...(section(id)?.querySelectorAll("li") ?? [])].map((li) => li.textContent ?? "");
const row = (id: string, start: string) => rows(id).find((text) => text.startsWith(start)) ?? "";
/** Source tags are gone from rows: the source shows only inside a sentence. */
const tags = () =>
  [...document.querySelectorAll("main li span")].filter((el) => /^(Edunex|SIX|Kalender ITB)$/.test(el.textContent ?? "") && el.children.length === 0);

describe("Beranda on the recorded Thursday morning", () => {
  it("answers first: the class going on, where attendance counts and what to do, without contradicting itself", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const now = text("home-now");
    expect(now).toContain("Sedang berlangsung · sampai 10:00");
    expect(now).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(now).toContain("PL3002·08:00–10:00·R.SG PWK LT.6");
    expect(now).toContain("Jam berubah · biasanya 08:00–09:30");
    // SIX counts PL3002: being in class is what counts, Edunex's window is optional (the audit's "Catat kehadiran" + "Buka di Edunex" + "dihitung di SIX").
    expect(now).toContain("Kehadiran dihitung di SIX: cukup hadir di kelas.");
    expect(now).toContain("Presensi Edunex juga dibuka sampai 09:30, tidak wajib.");
    expect(now).not.toContain("Catat kehadiran");
    // 6 of 7: the UTS-week lecture on 15 Oct may not run, so it buys no absence (#85: never one too many).
    expect(now).toContain("Boleh absen 1× lagi");
    expect(now).toContain("Setelah ini 11:00 · DK4073 Komunikasi Pemasaran");
    // Optional means quiet: not the primary button.
    expect(screen.button("Buka Presensi PL3002 di Edunex").className).not.toContain("bg-accent");
    await screen.click("Buka Presensi PL3002 di Edunex");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
    // The exam week from ITB's calendar is a calm line under the greeting, not a tag.
    expect(document.querySelector("main header")?.textContent).toContain("Masa UTS mulai Senin, 12 Okt · 4 hari lagi");
    expect(tags()).toEqual([]);
  });

  it("Perlu perhatianmu doesn't repeat today: today's classes and their risk are in Hari ini; a target out of reach stays, one click from Presensi", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(document.querySelector('main h2[id="home-needs"]')?.textContent).toBe("Perlu perhatianmu 1");
    expect(rows("home-needs")).toEqual(["KU5014 tak bisa lagi capai 80%Paling tinggi 73% · cek ke dosen kalau ada yang terlewat"]);
    await screen.click(/^KU5014 tak bisa lagi capai 80%/);
    expect(document.querySelector("h1")?.textContent).toBe("Presensi");
  });

  it("today: SIX's classes with time and room, absences left, the moved class, the overlap, and tomorrow's online meeting; rows open their course", async () => {
    screen = await openApp({ signedIn: true, six: true });
    // The now card above says "Jam berubah · biasanya 08:00–09:30" for this class; the row doesn't say it again.
    expect(row("home-today", "08:0010:00")).toBe("08:0010:00Ekonomi dan Inovasi dalam PerencanaanPL3002·R.SG PWK LT.6Boleh absen 1× lagiSekarang");
    expect(text("home-now")).toContain("Jam berubah · biasanya 08:00–09:30");
    expect(row("home-today", "11:00")).toBe("11:0012:59Komunikasi PemasaranDK4073·TVST CJangan absen lagidalam 3 jam");
    expect(row("home-today", "16:00")).toContain("80% tak terkejar · paling tinggi 73%");
    // PL3032 (15:00–16:30) and KU5014 (16:00–17:50) share half an hour: each row names the other.
    expect(row("home-today", "15:00")).toContain("Bentrok dengan KU5014 16:00–16:30");
    expect(row("home-today", "16:00")).toContain("Bentrok dengan PL3032 16:00–16:30");
    expect(row("home-today", "11:00")).not.toContain("Bentrok");
    expect(text("home-today")).toContain("Besok");
    expect(row("home-today", "15:0017:00")).toBe("15:0017:00Proposal Tugas AkhirII4091·Pertemuan 3 · daringTidak ada di jadwal SIX");
    await screen.click("Gabung kelas daring: II4091");
    expect(screen.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: expect.stringContaining("teams.microsoft.com") } });
    await screen.click(/^11:0012:59Komunikasi Pemasaran/);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
  });

  it("what changed: the moved class and the meeting announced outside SIX, each opening its screen; 'Lihat semua' opens the bell with the same items", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const changes = text("home-changes");
    expect(changes).toContain("Jadwal PL3002 berubahKam, 8 Okt 08:00–10:00 · biasanya 08:00–09:30");
    expect(changes).toContain("Pertemuan 3 II4091 diumumkan di EdunexJum, 9 Okt 15:00–17:00 · tidak ada di jadwal SIX");
    // An old meeting re-read in the same text isn't news.
    expect(changes).not.toContain("Pertemuan 2 II4091");
    await screen.click("Lihat semua");
    const bell = document.querySelector("[role=dialog][aria-label=Notifikasi]")?.textContent ?? "";
    expect(bell).toContain("Jadwal PL3002 berubah");
    expect(bell).toContain("Pertemuan 3 II4091 diumumkan di Edunex");
    await screen.key("Escape");
    await screen.click(/^Pertemuan 3 II4091 diumumkan/);
    expect(document.querySelector("h1")?.textContent).toContain("Proposal Tugas Akhir");
  });

  it("speaks English", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(text("home-now")).toContain("On now · until 10:00");
    expect(text("home-now")).toContain("Attendance counts in SIX: just be in class.");
    expect(text("home-now")).toContain("Edunex Presence is also open until 09:30; it's optional.");
    expect(row("home-today", "08:00")).toContain("You can miss 1 moreNow");
    expect(text("home-now")).toContain("New time · usually 08:00–09:30");
    expect(row("home-today", "15:00")).toContain("Clashes with KU5014 16:00–16:30");
    expect(rows("home-needs")[0]).toContain("KU5014 can't reach 80% anymore");
    expect(text("home-changes")).toContain("PL3002 schedule changedThu, 8 Oct 08:00–10:00 · usually 08:00–09:30");
    expect(screen.text()).toContain("UTS period starts Monday, 12 Oct · in 4 days");
  });
});

describe("an open window that counts", () => {
  it("the Presence is the one thing to do: the primary action opens it, with the time left", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-16T15:01:00+07:00" }), signedIn: true, six: true });
    const now = text("home-now");
    expect(now).toContain("Kumpulkan Tugas 02 Bab II sebelum 23:59");
    expect(now).toContain("Kehadiran dihitung lewat Presensi Edunex.");
    expect(now).toMatch(/tutup dalam 8 jam 5\d mnt/);
    expect(screen.button("Buka tugasnya").className).toContain("bg-accent");
    expect(document.querySelector('main [role="progressbar"]')).not.toBeNull();
    await screen.click("Buka tugasnya");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });
});

describe("with Edunex alone", () => {
  it("an open window leads, but where it counts isn't guessed before SIX is connected", async () => {
    screen = await openApp({ signedIn: true });
    const now = text("home-now");
    expect(now).toContain("Presensi PL3002 sedang dibuka");
    // Without SIX nobody knows whether Edunex counts: said as a just-in-case, the button quiet.
    expect(now).toContain("Tanpa SIX, belum pasti ini dihitung: catat saja untuk berjaga-jaga.");
    expect(now).not.toContain("dihitung lewat Presensi Edunex");
    const button = [...document.querySelectorAll<HTMLButtonElement>("section[aria-labelledby=home-now] button")].find((b) => b.textContent === "Buka Presensi");
    expect(button?.className).not.toContain("bg-accent ");
    expect(text("home-today")).toContain("Jadwal dan ruang kuliah muncul setelah SIX terhubung.");
  });
});

describe("an exam on Beranda", () => {
  it("within the week: what, when and where, that SIX and Edunex disagree, and its page one click away", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-13T09:00:00+07:00" }), signedIn: true, six: true });
    const exam = row("home-needs", "UTS Komunikasi Pemasaran");
    expect(exam).toBe("UTS Komunikasi PemasaranDK4073·Kam, 15 Okt, 11:00–12:59·TVST C·SIX dan Edunex beda tanggallusa");
    await screen.click(/^UTS Komunikasi Pemasaran/);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    expect(screen.text()).toContain("Kapan dan di mana");
  });

  it("speaks English", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-14T09:00:00+07:00" }), signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    const exam = rows("home-needs").find((r) => r.includes("UTS")) ?? "";
    expect(exam).toContain("Tomorrow, 11:00–12:59");
    expect(exam).toContain("SIX and Edunex give different dates");
  });
});

describe("a Presence window ahead", () => {
  it("a Task that takes attendance: what to hand in and when, said once, and the Task one click away", async () => {
    screen = await openApp({ signedIn: true, world: new PretendWorld({ now: "2026-10-11T21:00:00+07:00" }) });
    await screen.wait();
    const ahead = row("home-needs", "Kumpulkan Tugas 02 Bab II");
    expect(ahead).toContain("Juga presensi: Jum, 16 Okt, 15:00–23:59");
    expect(ahead.match(/Tugas 02 Bab II/g)).toHaveLength(1);
    await screen.click(/^Kumpulkan Tugas 02 Bab II/);
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });
});

describe("a class moved to another day", () => {
  it("names the usual day: today's Friday meeting stands in for the week's Thursday one", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-16T07:00:00+07:00" }), signedIn: true });
    const meeting = (id: string, start: string) => {
      const at = Date.parse(`${start}+07:00`);
      return {
        id,
        courseCode: "PL3002",
        courseName: "Ekonomi dan Inovasi dalam Perencanaan",
        start: at,
        end: at + 90 * 60_000,
        activity: "Kuliah",
        room: "R.SG PWK LT.6",
      };
    };
    const schedule = [
      meeting("1", "2026-10-01T08:00:00"),
      meeting("2", "2026-10-08T08:00:00"),
      meeting("3", "2026-10-16T10:00:00"),
      meeting("4", "2026-10-22T08:00:00"),
    ];
    await screen.apply({ type: "dataset", dataset: { name: "six.schedule", value: schedule, fetchedAt: 0, hash: "s1" } });
    await screen.apply({ type: "dataset", dataset: { name: "six.scheduleMonths", value: ["2026-10"], fetchedAt: 0, hash: "s2" } });
    expect(text("home-now")).toContain("Jam berubah · biasanya Kamis 08:00–09:30");
    // Said once: the now card shows this class, so its row in Hari ini doesn't repeat it.
    expect(row("home-today", "10:00")).not.toContain("biasanya");
  });
});

describe("Tasks on Beranda", () => {
  it("a Task due tonight is in Hari ini (not twice); edited after handing in, it says to check", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    screen.world.edunex.editTask(117432, { description: "<p>Tambahkan referensi.</p>" });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    expect(row("home-today", "23:59")).toMatch(/^23:59Ringkasan K5PL3032·Tenggatdalam 1\d jam$/);
    expect(rows("home-needs").some((r) => r.includes("Ringkasan K5"))).toBe(false);
    expect(row("home-needs", "Tugas tentang Imfact")).toContain("Diubah dosen setelah kamu kumpulkan · cek lagi");
    expect(text("home-changes")).toContain("Tugas baru · PL3032Ringkasan K5");
    await screen.click(/^23:59Ringkasan K5/);
    expect(document.querySelector("h1")?.textContent).toBe("Ringkasan K5");
  });
});

describe("nothing to do", () => {
  it("says so kindly, and claims nothing before Edunex's Tasks arrive", async () => {
    const world = new PretendWorld({ now: "2026-10-10T10:00:00+07:00" });
    world.edunex.tasks.clear();
    world.edunex.presences.clear();
    world.edunex.contents.clear();
    world.edunex.announcements.clear();
    screen = await openApp({ world, signedIn: true });
    expect(text("home-needs")).toContain("Bebas tenggat sampai Sabtu, 17 Okt");
    expect(text("home-today")).toContain("Jadwal dan ruang kuliah muncul setelah SIX terhubung.");
    expect(text("home-changes")).toContain("Tidak ada yang berubah minggu ini.");
    // SIX is a click away from where its classes would be.
    await screen.click("Masuk ke SIX");
    await screen.wait();
    expect(screen.store.status("six").state).toBe("live");
    expect(text("home-today")).not.toContain("muncul setelah SIX terhubung");
  });
});
