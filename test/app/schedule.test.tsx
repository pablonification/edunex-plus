// @vitest-environment jsdom
// v2-09 (#77), seam 2: Jadwal in the window. The real engine reads the
// pretend EduNex, SIX and ITB calendar behind the bridge; the tests look at
// what the Student sees. The recorded week of 5 October: PL3002 ran long on
// Thursday, PL3032 and KU5014 overlap, and II4091's meeting 3 on Friday is
// announced only in EduNex.
import { afterEach, describe, expect, it } from "vitest";
import { parseIcs } from "../../src/engine/sources/itb/ics";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** A day column (week view) by its long date. */
const day = (label: string) => document.querySelector(`main section[aria-label="${label}"]`)?.textContent ?? "";
/** What a day column holds below its heading. */
const body = (label: string) => document.querySelector(`main section[aria-label="${label}"] > div`)?.textContent ?? "";
const days = () => [...document.querySelectorAll("main section[aria-label]")].map((s) => s.getAttribute("aria-label"));
const subtitle = () => document.querySelector("main h1")?.nextElementSibling?.textContent ?? "";

async function openSchedule(options: Parameters<typeof openApp>[0] = { signedIn: true, six: true }) {
  screen = await openApp(options);
  await screen.click(/^Jadwal\d*$/);
  return screen;
}

describe("Jadwal: the week", () => {
  it("busy day: each class with time, course and room; the moved class and the overlap marked", async () => {
    await openSchedule();
    expect(subtitle()).toBe("5 Okt – 11 Okt · SIX");
    expect(days()).toEqual(["Senin, 5 Oktober", "Selasa, 6 Oktober", "Rabu, 7 Oktober", "Kamis, 8 Oktober", "Jumat, 9 Oktober"]);
    const thursday = day("Kamis, 8 Oktober");
    for (const fact of ["08:00–10:00", "Ekonomi dan Inovasi dalam Perencanaan", "R.SG PWK LT.6", "11:00–12:59", "TVST C", "15:00–16:30", "16:00–17:50", "9134"]) expect(thursday).toContain(fact);
    expect(thursday).toContain("Berubah · biasanya 08:00–09:30");
    expect(thursday).toContain("Bentrok KU5014 16:00–16:30");
    expect(thursday).toContain("Bentrok PL3032 16:00–16:30");
    expect(thursday.match(/Berubah/g)).toHaveLength(1);
  });

  it("empty days say so; a meeting announced only in EduNex shows on its day", async () => {
    await openSchedule();
    expect(body("Senin, 5 Oktober")).toBe("Tidak ada kuliah");
    expect(body("Rabu, 7 Oktober")).toBe("Tidak ada kuliah");
    const friday = day("Jumat, 9 Oktober");
    expect(friday).toContain("15:00–17:00");
    expect(friday).toContain("Pertemuan 3 · Daring");
    expect(friday).toContain("II4091");
    expect(friday).toContain("EduNex");
    expect(friday).toContain("Tidak ada di jadwal SIX");
    expect(friday).not.toContain("Tidak ada kuliah");
  });

  it("next week: ITB's UTS week, the UTS in class, a deadline; back to this week", async () => {
    const s = await openSchedule();
    await s.click("Minggu berikutnya");
    expect(subtitle()).toBe("12 Okt – 18 Okt · SIX");
    expect(s.text()).toContain("Kalender ITBMasa UTS · 12 Okt–16 Okt");
    expect(day("Kamis, 15 Oktober")).toContain("UTS");
    expect(day("Jumat, 16 Oktober")).toContain("23:59 II4091 · Tugas 02 Bab II");
    expect(s.has("Tenggat 23:59: Tugas 02 Bab II")).toBe(true);
    await s.click("Tenggat 23:59: Tugas 02 Bab II");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
    await s.click(/^Jadwal\d*$/);
    await s.click("Minggu ini");
    expect(subtitle()).toBe("5 Okt – 11 Okt · SIX");
  });

  it("month change: the week across October and November, and November itself", async () => {
    const s = await openSchedule();
    for (let i = 0; i < 3; i++) await s.click("Minggu berikutnya");
    expect(subtitle()).toBe("26 Okt – 1 Nov · SIX");
    expect(day("Kamis, 29 Oktober")).toContain("PL3002");
    expect(day("Jumat, 30 Oktober")).toContain("II4091");
    await s.click("Minggu berikutnya");
    expect(body("Senin, 2 November")).toBe("Tidak ada kuliah");
    // Past the months SIX's timetable covers, nothing pretends to be empty.
    for (let i = 0; i < 5; i++) await s.click("Minggu berikutnya");
    expect(s.text()).toContain("SIX belum menampilkan jadwal untuk tanggal ini");
    expect(s.text()).not.toContain("Tidak ada kuliah");
  });

  it("a class SIX moves shows at its new time and room, marked", async () => {
    const s = await openSchedule();
    s.world.six.moveMeeting("2194343", "10:00", "11:30", "9009");
    await s.engineDoes(() => s.engine.refresh("six"));
    await s.click("Minggu berikutnya");
    const thursday = day("Kamis, 15 Oktober");
    expect(thursday).toContain("10:00–11:30");
    expect(thursday).toContain("9009");
    expect(thursday).toContain("Berubah · biasanya 08:00–09:30");
    expect(thursday).toContain("Ruang berubah · biasanya R.SG PWK LT.6");
  });

  it("an extra meeting is marked extra, never as the class having moved", async () => {
    const s = await openSchedule();
    const pl = { code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan", room: "R.SG PWK LT.6" };
    s.world.six.addMeeting({ ...pl, id: "2194360", day: "2026-11-12", start: "08:00", end: "09:30" });
    s.world.six.addMeeting({ ...pl, id: "2194361", day: "2026-11-13", start: "10:00", end: "11:30", room: "9009" });
    await s.engineDoes(() => s.engine.refresh("six"));
    for (let i = 0; i < 5; i++) await s.click("Minggu berikutnya");
    expect(subtitle()).toBe("9 Nov – 15 Nov · SIX");
    const friday = day("Jumat, 13 November");
    expect(friday).toContain("10:00–11:30");
    expect(friday).toContain("Pertemuan tambahan");
    expect(friday).not.toMatch(/Berubah|Pindah|biasanya/);
    expect(day("Kamis, 12 November")).not.toMatch(/Berubah|tambahan/);
  });

  it("holiday: ITB's holiday on its days", async () => {
    await openSchedule({ world: new PretendWorld({ now: "2026-12-21T09:00:00+07:00" }), signedIn: true, six: true });
    expect(day("Kamis, 24 Desember")).toContain("Libur Kuliah dalam rangka Hari Raya Natal");
    expect(day("Jumat, 25 Desember")).toContain("Libur Kuliah dalam rangka Hari Raya Natal");
    expect(body("Senin, 21 Desember")).toBe("Tidak ada kuliah");
    expect(screen!.text()).toContain("Masa UAS · 7 Des–22 Des");
  });

  it("a class opens its course; an exam session opens the exam", async () => {
    const s = await openSchedule();
    await s.click(/^08:00–10:00Ekonomi dan Inovasi/);
    expect(document.querySelector("main h1")?.textContent).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    await s.click(/^Jadwal\d*$/);
    await s.click("Minggu berikutnya");
    await s.click(/^11:00–12:59Komunikasi Pemasaran/);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    expect(s.text()).toContain("Kapan dan di mana");
  });

  it("speaks English", async () => {
    const s = await openSchedule();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(subtitle()).toBe("5 Oct – 11 Oct · SIX");
    const thursday = day("Thursday 8 October");
    expect(thursday).toContain("Changed · usually 08:00–09:30");
    expect(thursday).toContain("Overlaps KU5014 16:00–16:30");
    expect(day("Friday 9 October")).toContain("Meeting 3 · Online");
    expect(day("Friday 9 October")).toContain("Not in SIX's timetable");
    expect(body("Monday 5 October")).toBe("No classes");
  });

  it("without SIX: says where the timetable comes from, with sign-in", async () => {
    const s = await openSchedule({ signedIn: true });
    expect(s.text()).toContain("Jadwal kuliah dan ruangnya datang dari SIX");
    expect(s.has("Masuk")).toBe(true);
  });
});

describe("Jadwal: the month", () => {
  it("shows the month, marks the UTS and a moved class, and a day opens its week", async () => {
    const s = await openSchedule();
    await s.click("Bulan");
    expect(subtitle()).toBe("Oktober 2026 · SIX");
    const cell = s.button(/^Lihat minggu Kamis, 15 Oktober/);
    expect(cell.getAttribute("aria-label")).toContain("11:00 DK4073 · UTS");
    expect(s.button(/^Lihat minggu Kamis, 8 Oktober/).getAttribute("aria-label")).toContain("08:00 PL3002 · Berubah");
    expect(s.button(/^Lihat minggu Kamis, 8 Oktober/).getAttribute("aria-label")).toContain("Bentrok KU5014");
    expect(s.button(/^Lihat minggu Jumat, 9 Oktober/).getAttribute("aria-label")).toContain("15:00 II4091 · EduNex");
    await s.click("Bulan berikutnya");
    expect(subtitle()).toBe("November 2026 · SIX");
    await s.click("Bulan ini");
    await s.click(cell.getAttribute("aria-label")!);
    expect(subtitle()).toBe("12 Okt – 18 Okt · SIX");
  });
});

describe("schedule and exam alerts in Settings", () => {
  it("say what they cover, once each, and switch off", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    const text = screen.text();
    expect(text).toContain("Ada perubahanRuang/jam pindah, tugas diubah, pertemuan baru");
    expect(text).toContain("UjianSaat dijadwalkan, dan sehari sebelumnya");
    expect(text.match(/Ada perubahan/g)).toHaveLength(1);
    await screen.click("Ada perubahan");
    await screen.click("Ujian");
    expect(screen.engine.snapshot().settings.mutedAlerts).toEqual(["changes", "exams"]);
  });
});

describe("the phone calendar", () => {
  it("saves classes with rooms, exams and deadlines; saving again keeps every event's UID", async () => {
    const s = await openSchedule();
    await s.click("Tambahkan ke kalender HP");
    expect(s.calls.at(-1)?.name).toBe("schedule.export");
    const [first] = s.exported;
    const events = parseIcs(first);
    expect(s.text()).toContain(`${events.length} acara disimpan`);
    const uts = events.find((e) => e.uid === "six-2179909@edunex-plus");
    expect(uts?.summary).toBe("UTS DK4073 · Komunikasi Pemasaran");
    expect(first).toContain("LOCATION:TVST C");
    expect(events.some((e) => e.summary === "Tenggat II4091: Tugas 02 Bab II")).toBe(true);
    expect(events.some((e) => e.summary.startsWith("Pertemuan 3 II4091"))).toBe(true);

    await s.wait(60_000);
    await s.click("Tambahkan ke kalender HP");
    const again = parseIcs(s.exported[1]);
    expect(again.map((e) => e.uid).sort()).toEqual(events.map((e) => e.uid).sort());
  });
});
