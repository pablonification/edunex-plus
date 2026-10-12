// @vitest-environment jsdom
// v2-09 (#77), seam 2: Jadwal in the window. The real engine reads the
// pretend Edunex, SIX and ITB calendar behind the bridge; the tests look at
// what the Student sees. The recorded week of 5 October: PL3002 ran long on
// Thursday, PL3032 and KU5014 overlap, and II4091's meeting 3 on Friday is
// announced only in Edunex. The week after is ITB's UTS week.
import { act } from "react";
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
const section = (label: string) => document.querySelector(`main section[aria-label="${label}"]`);
const day = (label: string) => section(label)?.textContent ?? "";
/** The names of what's on a day: its blocks and lane items, as screen readers read them. */
const items = (label: string) => [...(section(label)?.querySelectorAll("button") ?? [])].map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
const days = () => [...document.querySelectorAll("main section[aria-label]")].map((s) => s.getAttribute("aria-label"));
/** The line under the title: the week ("Minggu ke-7 · 5–11 Okt") or the month. */
const subtitle = () => document.querySelector("main h1")?.nextElementSibling?.textContent ?? "";
/** The open popover's text. */
const popover = () => document.querySelector("[role=dialog]")?.textContent ?? "";

async function openSchedule(options: Parameters<typeof openApp>[0] = { signedIn: true, six: true }) {
  screen = await openApp(options);
  await screen.click(/^Jadwal\d*$/);
  return screen;
}

/** Opens a block's details and returns what they say (then closes them). */
async function details(s: NonNullable<typeof screen>, name: string | RegExp): Promise<string> {
  await s.click(name);
  const text = popover();
  await s.key("Escape");
  // Closing hands focus back to the block on the next tick, as for a person; let it land before the next click.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  return text;
}

describe("Jadwal: the week as a timetable", () => {
  it("busy day: each class with time, course and room; the moved class and the overlap marked", async () => {
    const s = await openSchedule();
    expect(subtitle()).toBe("Minggu ke-7 · 5–11 Okt");
    // Weekends are always there.
    expect(days()).toEqual([
      "Senin, 5 Oktober",
      "Selasa, 6 Oktober",
      "Rabu, 7 Oktober",
      "Kamis, 8 Oktober",
      "Jumat, 9 Oktober",
      "Sabtu, 10 Oktober",
      "Minggu, 11 Oktober",
    ]);
    const thursday = items("Kamis, 8 Oktober");
    expect(thursday).toEqual([
      "PL3002 · 08:00–10:00 · R.SG PWK LT.6 · Berubah",
      "DK4073 · 11:00–12:59 · TVST C",
      "PL3032 · 15:00–16:30 · R.SG PWK LT.6 · Bentrok KU5014",
      "KU5014 · 16:00–17:50 · 9134 · Bentrok PL3032",
    ]);
    expect(day("Kamis, 8 Oktober")).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(day("Kamis, 8 Oktober").match(/Berubah/g)).toHaveLength(1);

    const moved = await details(s, /^PL3002 · 08:00–10:00/);
    expect(moved).toContain("Kamis, 8 Oktober · 08:00–10:00");
    expect(moved).toContain("Sedang berlangsung");
    expect(moved).toContain("R.SG PWK LT.6");
    expect(moved).toContain("Dr. Ir. Maya Saputra, M.Si.");
    expect(moved).toContain("Berubah · biasanya 08:00–09:30");
    expect(await details(s, /^PL3032 · 15:00/)).toContain("Bentrok dengan KU5014 · 16:00–16:30");
    expect(await details(s, /^KU5014 · 16:00/)).toContain("Bentrok dengan PL3032 · 16:00–16:30");
  });

  it("clashing classes side by side: each block names the other course, in amber (a choice to make, nothing lost)", async () => {
    await openSchedule();
    const blocks = [...(section("Kamis, 8 Oktober")?.querySelectorAll("button") ?? [])];
    const block = (code: string) => blocks.find((b) => b.getAttribute("aria-label")?.startsWith(`${code} ·`))!;
    // Half-width blocks: the overlap icon and the other code on the line under the course code, not words cut short.
    expect(block("PL3032").textContent).toMatch(/^15:00–16:30PL3032KU5014/);
    expect(block("KU5014").textContent).toMatch(/^16:00–17:50KU5014PL3032/);
    for (const code of ["PL3032", "KU5014"]) {
      expect(block(code).querySelector("[class*=danger]")).toBeNull();
      expect(block(code).querySelector(".text-warning-fg")).not.toBeNull();
    }
  });

  it("a block's details: where attendance counts, the Presence window open now, and the way to the course", async () => {
    const s = await openSchedule();
    await s.click(/^PL3002 · 08:00–10:00/);
    expect(popover()).toContain("Kehadiran dihitung di SIX · Masih bisa absen 1× lagi");
    expect(popover()).toContain("Presensi Edunex dibuka sampai 09:30");
    await s.click("Catat di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
    await s.click("Buka mata kuliah");
    expect(document.querySelector("main h1")?.textContent).toContain("Ekonomi dan Inovasi dalam Perencanaan");
  });

  it("empty days say so; a meeting announced only in Edunex shows on its day, with the way to join", async () => {
    const s = await openSchedule();
    expect(day("Senin, 5 Oktober")).toContain("Kosong");
    expect(day("Rabu, 7 Oktober")).toContain("Kosong");
    expect(items("Jumat, 9 Oktober")).toEqual(["II4091 · Pertemuan 3 · 15:00–17:00 · Daring · Tidak ada di SIX", "Gabung"]);
    expect(day("Jumat, 9 Oktober")).not.toContain("Kosong");
    // Easy to miss, so amber, as Beranda says it.
    const mark = [...(section("Jumat, 9 Oktober")?.querySelectorAll("span") ?? [])].find((el) => el.textContent === "Tidak ada di SIX");
    expect(mark?.className).toContain("text-warning-fg");
    const meeting = await details(s, /^II4091 · Pertemuan 3/);
    expect(meeting).toContain("Diumumkan dosen di Edunex; jadwal SIX tidak mencantumkannya.");
    await s.click("Gabung");
    expect(s.calls.at(-1)?.name).toBe("shell.openExternal");
    expect(String((s.calls.at(-1)!.input as { url: string }).url)).toMatch(/^https:\/\/teams\.microsoft\.com\//);
  });

  it("next week: ITB's UTS week, the UTS as an exam, lectures that may not run, and Presence by handing in a Task", async () => {
    const s = await openSchedule();
    await s.click("Minggu berikutnya");
    expect(subtitle()).toBe("Minggu ke-8 · 12–18 Okt");
    expect(s.text()).toContain("Masa UTS · 12–16 Okt · kuliah lain belum pasti ada, cek pengumuman dosen");
    expect(items("Kamis, 15 Oktober")).toEqual([
      "PL3002 · 08:00–09:30 · R.SG PWK LT.6 · Belum pasti",
      "UTS DK4073 · 11:00–12:59 · TVST C",
      "PL3032 · 15:00–16:30 · R.SG PWK LT.6 · Belum pasti · Bentrok KU5014",
      "KU5014 · 16:00–17:50 · 9134 · Belum pasti · Bentrok PL3032",
    ]);
    expect(await details(s, /^PL3002 · 08:00–09:30/)).toContain("Masa UTS: belum pasti ada kuliah. Cek pengumuman dosen.");
    const uts = await details(s, /^UTS DK4073/);
    expect(uts).toContain("TVST C");
    expect(uts).toContain("119 menit");
    // SIX's roomless 15:00–23:00 "meeting" is the window to hand in Tugas 02: not a class, and its deadline isn't said twice.
    expect(items("Jumat, 16 Oktober")).toEqual(["II4091 · Kumpulkan Tugas 02 Bab II sebelum 23:59 untuk hadir"]);
    await s.click(/^II4091 · Kumpulkan Tugas 02/);
    expect(popover()).toContain("Hadir tercatat hanya jika dikumpulkan dalam jendela ini.");
    expect(popover()).toContain("Di jadwal SIX: pertemuan 15:00–23:00");
    await s.click("Buka tugas");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });

  it("a Task's deadline sits above the day, and opens the Task", async () => {
    const s = await openSchedule();
    for (let i = 0; i < 2; i++) await s.click("Minggu berikutnya");
    expect(items("Kamis, 22 Oktober")).toContain("Tenggat 23:50: UTS Markom");
    await s.click("Tenggat 23:50: UTS Markom");
    expect(popover()).toContain("Kam, 22 Okt, 23:50");
    await s.click("Buka tugas");
    expect(document.querySelector("main h1")?.textContent).toBe("UTS Markom");
  });

  it("remembers the week and the view while the app is open: going to a course and back keeps the Student's place", async () => {
    const s = await openSchedule();
    await s.click("Minggu berikutnya");
    await s.click(/^UTS DK4073/);
    await s.click("Buka mata kuliah");
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    await s.click(/^Jadwal\d*$/);
    expect(subtitle()).toBe("Minggu ke-8 · 12–18 Okt");
    await s.click("Bulan");
    await s.click(/^Beranda/);
    await s.click(/^Jadwal\d*$/);
    expect(subtitle()).toBe("Oktober 2026");
    await s.click("Minggu");
    await s.click("Minggu ini");
    expect(subtitle()).toBe("Minggu ke-7 · 5–11 Okt");
  });

  it("month change: the week across October and November, and November itself", async () => {
    const s = await openSchedule();
    for (let i = 0; i < 3; i++) await s.click("Minggu berikutnya");
    expect(subtitle()).toBe("Minggu ke-10 · 26 Okt – 1 Nov");
    expect(day("Kamis, 29 Oktober")).toContain("PL3002");
    expect(day("Jumat, 30 Oktober")).toContain("II4091");
    await s.click("Minggu berikutnya");
    expect(day("Senin, 2 November")).toContain("Kosong");
    // Past the months SIX's timetable covers, nothing pretends to be empty.
    for (let i = 0; i < 5; i++) await s.click("Minggu berikutnya");
    expect(s.text()).toContain("SIX belum menampilkan jadwal untuk tanggal ini");
    expect(s.text()).not.toContain("Kosong");
  });

  it("a class SIX moves shows at its new time and room, marked", async () => {
    const s = await openSchedule();
    s.world.six.moveMeeting("2194343", "10:00", "11:30", "9009");
    await s.engineDoes(() => s.engine.refresh("six"));
    await s.click("Minggu berikutnya");
    // It now runs into the UTS at 11:00 too.
    expect(items("Kamis, 15 Oktober")[0]).toBe("PL3002 · 10:00–11:30 · 9009 · Belum pasti · Berubah · Bentrok DK4073");
    const moved = await details(s, /^PL3002 · 10:00–11:30/);
    expect(moved).toContain("Berubah · biasanya 08:00–09:30");
    expect(moved).toContain("Ruang berubah · biasanya R.SG PWK LT.6");
  });

  it("an extra meeting is marked extra, never as the class having moved", async () => {
    const s = await openSchedule();
    const pl = { code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan", room: "R.SG PWK LT.6" };
    s.world.six.addMeeting({ ...pl, id: "2194360", day: "2026-11-12", start: "08:00", end: "09:30" });
    s.world.six.addMeeting({ ...pl, id: "2194361", day: "2026-11-13", start: "10:00", end: "11:30", room: "9009" });
    await s.engineDoes(() => s.engine.refresh("six"));
    for (let i = 0; i < 5; i++) await s.click("Minggu berikutnya");
    expect(subtitle()).toBe("Minggu ke-12 · 9–15 Nov");
    expect(items("Jumat, 13 November")).toContain("PL3002 · 10:00–11:30 · 9009 · Tambahan");
    const extra = await details(s, /^PL3002 · 10:00–11:30/);
    expect(extra).toContain("Pertemuan tambahan");
    expect(extra).not.toMatch(/Berubah|Pindah|biasanya/);
    expect(items("Kamis, 12 November").join()).not.toMatch(/Berubah|Tambahan/);
  });

  it("holiday: ITB's holiday over its days, the UAS too", async () => {
    await openSchedule({ world: new PretendWorld({ now: "2026-12-21T09:00:00+07:00" }), signedIn: true, six: true });
    expect(screen!.text()).toContain("Libur Hari Raya Natal · 24–25 Des");
    expect(screen!.text()).toContain("Masa UAS · 7–22 Des");
    expect(day("Senin, 21 Desember")).toContain("Kosong");
  });

  it("an exam session opens the exam", async () => {
    const s = await openSchedule();
    await s.click("Minggu berikutnya");
    await s.click(/^UTS DK4073/);
    await s.click("Buka ujian");
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    expect(s.text()).toContain("Kapan dan di mana");
  });

  it("speaks English", async () => {
    const s = await openSchedule();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(subtitle()).toBe("Week 7 · 5–11 Oct");
    expect(items("Thursday 8 October")[0]).toBe("PL3002 · 08:00–10:00 · R.SG PWK LT.6 · Changed");
    expect(await details(s, /^PL3002 · 08:00–10:00/)).toContain("Changed · usually 08:00–09:30");
    expect(await details(s, /^KU5014 · 16:00/)).toContain("Clashes with PL3032 · 16:00–16:30");
    expect(items("Friday 9 October")[0]).toBe("II4091 · Meeting 3 · 15:00–17:00 · Online · Not in SIX");
    expect(day("Monday 5 October")).toContain("Free");
  });

  it("without SIX: what Edunex knows, and one line saying classes and rooms need SIX", async () => {
    const s = await openSchedule({ signedIn: true });
    // ITB's public calendar arrives on the engine's own rhythm.
    await s.wait();
    expect(s.text()).toContain("Jadwal kuliah & ruang butuh SIX");
    expect(subtitle()).toBe("Minggu ke-7 · 5–11 Okt");
    // Edunex's Presence windows and its announced meeting; never "free" (SIX would say).
    expect(items("Kamis, 8 Oktober")).toEqual(["PL3002 · Economics and Innovation in Planning · 08:00–09:30 · Dari Edunex"]);
    expect(items("Jumat, 9 Oktober")[0]).toBe("II4091 · Pertemuan 3 · 15:00–17:00 · Daring · Dari Edunex");
    expect(s.text()).not.toContain("Kosong");
    expect(s.text()).toContain("Pertemuan dan tenggat dari Edunex");
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.text()).not.toContain("Jadwal kuliah & ruang butuh SIX");
    expect(items("Kamis, 8 Oktober")).toHaveLength(4);
  });
});

describe("Jadwal: the month", () => {
  it("shows what's unusual, not the routine; ITB's periods tinted; a day opens its details and its week", async () => {
    const s = await openSchedule();
    await s.click("Bulan");
    expect(subtitle()).toBe("Oktober 2026");
    const cell = (date: string) => s.button(new RegExp(`^${date}`)).getAttribute("aria-label") ?? "";
    expect(cell("Kamis, 15 Oktober")).toContain("UTS DK4073 11:00 · TVST C");
    expect(cell("Kamis, 15 Oktober")).toContain("3 kuliah belum pasti");
    expect(cell("Kamis, 15 Oktober")).toContain("Masa UTS");
    expect(cell("Kamis, 8 Oktober")).toContain("PL3002 08:00: jadwal berubah");
    expect(cell("Kamis, 8 Oktober")).toContain("Bentrok KU5014 · PL3032 · 16:00–16:30");
    expect(cell("Kamis, 8 Oktober")).toContain("4 kuliah");
    // On the cell: the day's classes, then the clash among them with its time, never read as all four clashing.
    expect(s.button(/^Kamis, 8 Oktober/).textContent).toMatch(/4 kuliah\s*Bentrok 16:00$/);
    expect(cell("Jumat, 9 Oktober")).toContain("II4091 15:00: tidak ada di SIX");
    expect(cell("Jumat, 16 Oktober")).toContain("II4091 · Kumpulkan Tugas 02 Bab II sebelum 23:59 untuk hadir");
    // The routine is a count, not lines: no class codes on an ordinary Thursday.
    expect(s.button(/^Kamis, 22 Oktober/).textContent).not.toMatch(/PL3002|DK4073/);
    await s.click("Bulan berikutnya");
    expect(subtitle()).toBe("November 2026");
    await s.click("Bulan ini");
    await s.click(/^Kamis, 15 Oktober/);
    expect(popover()).toContain("Masa UTS");
    expect(popover()).toContain("11:00–12:59");
    await s.click("Lihat minggunya");
    expect(subtitle()).toBe("Minggu ke-8 · 12–18 Okt");
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
  it("a dialog: what goes in and how far, then the file, the way to it and how to get it onto a phone", async () => {
    const s = await openSchedule();
    await s.click("Tambahkan ke kalender HP");
    const dialog = popover();
    expect(dialog).toContain("Kuliah");
    expect(dialog).toContain("Tenggat tugas");
    expect(dialog).toContain("Kalender ITB");
    expect(dialog).toContain("Sampai akhir semestersampai Sel, 22 Des");
    expect(dialog).toContain("Jadwal kuliah dari SIX baru ada sampai Sen, 30 Nov.");
    expect(dialog).toContain("Ini salinan sekali ambil: ekspor lagi jika jadwal berubah.");
    await s.click(/^Simpan \d+ acara$/);
    expect(s.calls.at(-1)).toEqual({
      name: "schedule.export",
      input: { include: { classes: true, exams: true, deadlines: true, itb: true }, from: "2026-10-08", until: "2026-12-22" },
    });
    const [first] = s.exported;
    const events = parseIcs(first);
    expect(popover()).toContain(`${events.length} acara tersimpan`);
    expect(popover()).toContain("Edunex Plus.ics");
    expect(popover()).toContain("Kirim berkasnya lewat AirDrop");
    expect(popover()).toContain("Buka dengan Google Calendar");
    const uts = events.find((e) => e.uid === "six-2179909@edunex-plus");
    expect(uts?.summary).toBe("UTS DK4073 · Komunikasi Pemasaran");
    expect(first).toContain("LOCATION:TVST C");
    expect(events.some((e) => e.summary === "Tenggat II4091: Tugas 02 Bab II")).toBe(true);
    expect(events.some((e) => e.summary.startsWith("Pertemuan 3 II4091"))).toBe(true);
    expect(events.some((e) => e.summary === "Masa Ujian Tengah Semester I-2026/2027" && e.allDay)).toBe(true);
    await s.click("Tampilkan di Finder");
    expect(s.calls.at(-1)?.name).toBe("schedule.reveal");
    await s.click("Selesai");
    expect(document.querySelector("[role=dialog]")).toBeNull();

    // Saved again later: every event keeps its UID, so the phone updates them.
    await s.wait(60_000);
    await s.click("Tambahkan ke kalender HP");
    await s.click(/^Simpan \d+ acara$/);
    const again = parseIcs(s.exported[1]);
    expect(again.map((e) => e.uid).sort()).toEqual(events.map((e) => e.uid).sort());
  });

  it("with nothing to put in it, the button says why instead of opening an empty dialog", async () => {
    const s = await openSchedule({ signedIn: true });
    await s.wait();
    for (const name of ["edunex.tasks", "itb.calendar"]) await s.apply({ type: "dataset.removed", name });
    const button = s.button("Tambahkan ke kalender HP");
    expect(button.disabled).toBe(true);
    await act(async () => (button.parentElement as HTMLElement).focus());
    expect(s.text()).toContain("Belum ada jadwal untuk ditambahkan");
  });

  it("only what the Student picks, as far ahead as they pick", async () => {
    const s = await openSchedule();
    await s.click("Tambahkan ke kalender HP");
    const deadlines = [...document.querySelectorAll<HTMLInputElement>("[role=dialog] input[type=checkbox]")].find((box) =>
      box.closest("label")?.textContent?.startsWith("Tenggat tugas"),
    )!;
    await s.click(deadlines);
    const fourWeeks = [...document.querySelectorAll<HTMLInputElement>("[role=dialog] input[type=radio]")].find((radio) =>
      radio.closest("label")?.textContent?.startsWith("4 minggu ke depan"),
    )!;
    await s.click(fourWeeks);
    await s.click(/^Simpan \d+ acara$/);
    expect(s.calls.at(-1)?.input).toEqual({ include: { classes: true, exams: true, deadlines: false, itb: true }, from: "2026-10-08", until: "2026-11-04" });
    const events = parseIcs(s.exported[0]);
    expect(events.some((e) => e.summary.startsWith("Tenggat"))).toBe(false);
    expect(events.every((e) => e.start < Date.parse("2026-11-05T00:00:00+07:00"))).toBe(true);
  });
});
