// @vitest-environment jsdom
// v2-16 (#85), seam 2: the Presensi screen as the Student sees it, with the
// real engine, the pretend Edunex and ITB calendar behind the bridge, and
// SIX's datasets injected (until #76 lands its source).
import { afterEach, describe, expect, it } from "vitest";
import type { ClassSession, SixCourse, Task } from "../../src/core/models";
import { aTask } from "../kit/tasks";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

function weekly(code: string, firstIso: string, weeks: number, room = "9134"): ClassSession[] {
  return Array.from({ length: weeks }, (_, i) => {
    const start = wib(firstIso) + i * 7 * DAY;
    return { id: `${code}-${i}`, courseCode: code, courseName: code, start, end: start + 2 * HOUR, activity: "Kuliah", room };
  });
}
const course = (code: string, attended: number, held: number): SixCourse => ({ code, name: code, classNo: "01", sks: 3, attendance: { attended, held } });
/** SIX puts the UTS in the course's slot in UTS week (12–16 Oct). */
const withUts = (sessions: ClassSession[]) =>
  sessions.map((s) => (s.start >= wib("2026-10-12T00:00:00") && s.start < wib("2026-10-17T00:00:00") ? { ...s, activity: "UTS" } : s));

let hash = 0;
async function six(courses: SixCourse[], schedule: ClassSession[]) {
  await screen!.apply({ type: "dataset", dataset: { name: "six.courses", value: courses, fetchedAt: 0, hash: `c${++hash}` } });
  await screen!.apply({ type: "dataset", dataset: { name: "six.schedule", value: schedule, fetchedAt: 0, hash: `s${++hash}` } });
}

async function openPresence(now?: string) {
  screen = await openApp({ signedIn: true, world: new PretendWorld({ now }) });
  await screen.wait();
  await screen.click(/^Presensi/);
  return screen;
}

/** A course's row on the screen. */
const row = (code: string) =>
  [...document.querySelectorAll('main ul[aria-label="Mata kuliah"] > li, main ul[aria-label="Courses"] > li')].find((li) => li.textContent?.startsWith(code));
const card = (code: string) => row(code)?.textContent ?? "";
/** A course's meetings, as a screen reader hears the strip, and each square's own words. */
const strip = (code: string) => row(code)?.querySelector("[role=list]")?.getAttribute("aria-label") ?? "";
const squares = (code: string) => [...(row(code)?.querySelectorAll("[role=listitem]") ?? [])].map((sq) => sq.getAttribute("aria-label") ?? "");
/** The Presence window open now. */
const opened = () => document.querySelector('main section[aria-label="Presensi yang dibuka sekarang"]')?.textContent ?? "";
const answer = () => document.querySelector("main h1")?.nextElementSibling?.textContent ?? "";

describe("the Presensi screen", () => {
  it("a course counted in SIX: Edunex's unused windows are explained, never called absences", async () => {
    const s = await openPresence();
    await six([course("PL3002", 6, 7)], withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)));
    const pl = card("PL3002");
    expect(pl).toContain("Dihitung di SIX");
    // 6 of 7 is 85.7 %: shares round down everywhere, so no one reads a target as reached before it is.
    expect(pl).toContain("hadir 6/7 · 85%");
    // 22, 29 Oct on SIX's timetable, then Thursdays to 3 Dec: one absence left, until the last lecture day.
    expect(strip("PL3002")).toBe("Pertemuan: 6 hadir, 1 absen, sekitar 7 lagi");
    expect(pl).toContain("Boleh absen 1× lagi");
    expect(pl).toContain("Sampai 4 Des");
    expect(pl).toContain("Edunex mencatat hadir 1 dari 6 Presensi; yang dihitung adalah SIX (hadir 6 dari 7). Presensi Edunex yang tak tercatat bukan absen.");
    expect(s.text()).not.toMatch(/\bAbsent\b|Tidak hadir/);
  });

  it("which meeting was missed: SIX gives only the tally, each meeting to come has its date", async () => {
    const s = await openPresence();
    await six([course("KU5014", 2, 6)], withUts(weekly("KU5014", "2026-08-27T16:00:00", 10)));
    const each = squares("KU5014");
    expect(each.slice(0, 2)).toEqual(["Hadir · 2 dari 6 pertemuan, hitungan SIX", "Hadir · 2 dari 6 pertemuan, hitungan SIX"]);
    expect(each[2]).toBe("Absen · 4 dari 6, hitungan SIX. SIX tidak menyebut pertemuan mana: cek di SIX.");
    expect(each[6]).toBe("Kam 8 Okt, 16:00 · 9134");
    expect(each[7]).toBe("Kam 22 Okt, 16:00 · 9134");
    expect(each.at(-1)).toBe("Kam 3 Des, 16:00 · perkiraan dari jadwal mingguan");
    expect(s.text()).toContain("SIX hanya memberi jumlah hadir dan absen, bukan tanggalnya.");
    // SIX's own pages say which meeting: one click away once SIX knows the Student.
    const student = { nim: "18223901", name: "Dimas Pratama", studentId: "2021000001", term: "2026-1", program: null, programCode: null };
    await s.apply({ type: "dataset", dataset: { name: "six.student", value: student, fetchedAt: 0, hash: "st1" } });
    await s.click("Buka jadwal di SIX");
    expect(s.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001" },
    });
  });

  it("the next meeting inside Masa UTS is said to be uncertain, and buys no absence (it may not run)", async () => {
    const s = await openPresence("2026-10-09T09:00:00+07:00");
    // SIX still lists the Thursday lecture in UTS week.
    await six([course("PL3002", 6, 7)], weekly("PL3002", "2026-08-27T08:00:00", 10));
    expect(card("PL3002")).toContain("Berikutnya: Kam, 15 Okt, 08:00 · 9134 · belum pasti, cek pengumuman");
    // Counted, it would say "2× lagi": one absence too many if the lecture doesn't run.
    expect(card("PL3002")).toContain("Boleh absen 1× lagi");
    expect(s.text()).toContain(
      "Kuliah yang masih dijadwalkan SIX di minggu UTS, UAS atau hari libur belum pasti ada, jadi tidak dihitung sebagai jatah absen.",
    );
    expect(squares("PL3002")[7]).toBe("Kam 15 Okt, 08:00 · masa ujian atau libur: belum pasti ada kuliah");
    expect(strip("PL3002")).toBe("Pertemuan: 6 hadir, 1 absen, sekitar 8 lagi");
  });

  it("a next meeting that overlaps another course's class says so, in Jadwal's words", async () => {
    await openPresence("2026-10-08T09:00:00+07:00");
    // PL3032 15:00–17:00 and KU5014 16:00–18:00 every Thursday.
    await six(
      [course("PL3032", 5, 6), course("KU5014", 5, 6)],
      [...weekly("PL3032", "2026-08-27T15:00:00", 10), ...weekly("KU5014", "2026-08-27T16:00:00", 10)],
    );
    expect(card("PL3032")).toContain("Bentrok dengan KU5014 · 16:00–17:00");
    expect(card("KU5014")).toContain("Bentrok dengan PL3032 · 16:00–17:00");
    const note = [...(row("PL3032")?.querySelectorAll("li") ?? [])].find((li) => li.textContent?.includes("Bentrok"));
    expect(note?.className).toContain("text-warning-fg");
    // First under the row: it's today's choice.
    expect(row("PL3032")?.querySelector("ul li")?.textContent).toContain("Bentrok dengan KU5014");
  });

  it("the window open now, action first: until when, what to do, the time left, and the button to that place in Edunex; optional where only SIX counts, as Beranda says", async () => {
    const s = await openPresence();
    await six([course("PL3002", 6, 7)], weekly("PL3002", "2026-08-27T08:00:00", 10));
    expect(opened()).toContain("Presensi PL3002 dibuka sampai 09:30");
    // PL3002 isn't recorded in Edunex (SIX counts it), so the window is optional, the same story as Beranda's.
    expect(opened()).toContain("Kehadiran dihitung di SIX: cukup hadir di kelas. Mencatat di Edunex tidak wajib.");
    expect(opened()).not.toContain("agar tercatat");
    expect(opened()).not.toContain("Salinan");
    expect(opened()).toMatch(/1 jam \d+ mnt lagi/);
    await s.click("Catat di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
    // The app never records presence itself.
    expect(s.world.log.every((request) => request.method === "GET")).toBe(true);
  });

  it("Answer Assignment: hand in that Task inside the window, from the Task's page", async () => {
    const s = await openPresence("2026-10-16T15:30:00+07:00");
    const task: Task = aTask({ id: 117003, courseCode: "II4091", courseId: 95326, moduleId: 450222, title: "Tugas 02 Bab II", status: "not_started" });
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [task], fetchedAt: 0, hash: "t1" } });
    expect(opened()).toContain("Presensi II4091 dibuka sampai 23:59");
    expect(opened()).toContain("Kumpulkan Tugas 02 Bab II agar tercatat hadir.");
    expect(card("II4091")).toContain("hanya terhitung jika tugasnya dikumpulkan di dalam jendela waktunya");
    await s.click("Buka tugasnya");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });

  it("no absences left and target out of reach, worst first, said once on top, counted in the sidebar", async () => {
    const s = await openPresence();
    await six(
      [course("KU5014", 2, 6), course("DK4073", 4, 6), course("PL3002", 6, 7)],
      [
        ...withUts(weekly("KU5014", "2026-08-27T16:00:00", 10)),
        ...withUts(weekly("DK4073", "2026-08-24T11:00:00", 10)),
        ...withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)),
      ],
    );
    expect(answer()).toBe("3 mata kuliah perlu perhatianmu");
    const codes = [...document.querySelectorAll('main ul[aria-label="Mata kuliah"] > li')].map((li) => li.textContent?.slice(0, 6));
    expect(codes.slice(0, 3)).toEqual(["KU5014", "DK4073", "PL3002"]);
    expect(card("KU5014")).toContain("80% tak terkejar");
    expect(card("KU5014")).toContain("Sekarang 33% · paling tinggi 71%");
    expect(card("KU5014")).toContain("minta dosen memperbaikinya sekarang");
    expect(card("DK4073")).toContain("Jangan absen lagi");
    expect(row("DK4073")?.querySelector("[role=img]")?.getAttribute("aria-label")).toBe("Kehadiran 66%, target 80%, paling tinggi 84%");
    expect(card("DK4073")).toContain("Kembali ke 80% setelah 4× hadir berturut-turut");
    expect(card("DK4073")).toContain("UTS Sen 12 Okt memakai slot kuliah, bukan pertemuan.");
    // The sidebar counts the three courses at risk.
    expect(s.button(/^Presensi/).textContent).toBe("Presensi3");
  });

  it("the summary filters the list; an empty kind can't be picked", async () => {
    const s = await openPresence();
    await six(
      [course("KU5014", 2, 6), course("DK4073", 4, 6), course("PL3002", 7, 7)],
      [
        ...withUts(weekly("KU5014", "2026-08-27T16:00:00", 10)),
        ...withUts(weekly("DK4073", "2026-08-24T11:00:00", 10)),
        ...withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)),
      ],
    );
    expect(s.button("0 · Hati-hati").disabled).toBe(true);
    await s.click("1 · Target tak terkejar");
    expect(s.button("1 · Target tak terkejar").getAttribute("aria-pressed")).toBe("true");
    expect([...document.querySelectorAll('main ul[aria-label="Mata kuliah"] > li')].map((li) => li.textContent?.slice(0, 6))).toEqual(["KU5014"]);
    await s.click("Tampilkan semua (5)");
    expect(document.querySelectorAll('main ul[aria-label="Mata kuliah"] > li')).toHaveLength(5);
    // A row opens the course's meetings.
    await s.click(/^PL3002 · /);
    expect(s.text()).toContain("Kam, 27 Agu08:00–10:00");
  });

  it("follows a mid-semester schedule change", async () => {
    const s = await openPresence();
    const regular = weekly("KU5014", "2026-08-27T16:00:00", 10);
    await six([course("KU5014", 5, 6)], regular);
    expect(card("KU5014")).toContain("16:00 · 9134");
    // SIX moves today's class to tomorrow 13:00 in another room.
    const moved = regular.map((x) =>
      x.start === wib("2026-10-08T16:00:00") ? { ...x, start: wib("2026-10-09T13:00:00"), end: wib("2026-10-09T15:00:00"), room: "7602" } : x,
    );
    await six([course("KU5014", 5, 6)], moved);
    expect(card("KU5014")).toContain("13:00 · 7602");
    expect(s.text()).not.toContain("16:00 · 9134");
  });

  it("a course's own target, set on its row; the default is for every other course, and says so", async () => {
    const s = await openPresence();
    await six(
      [course("PL3002", 6, 7), course("DK4073", 4, 6)],
      [...withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)), ...withUts(weekly("DK4073", "2026-08-24T11:00:00", 10))],
    );
    expect(card("PL3002")).toContain("Boleh absen 1× lagi");
    expect(card("DK4073")).toContain("Jangan absen lagi");
    // DK4073's course contract asks for 75%.
    await s.click("Target 80% untuk DK4073");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Target kehadiran DK4073");
    await s.click("Turunkan target DK4073");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTargets: { DK4073: 75 } } });
    expect(card("DK4073")).toContain("Boleh absen 1× lagi");
    expect(card("DK4073")).toContain("Target 75%");
    expect(card("PL3002")).toContain("Target 80%");
    await s.key("Escape");
    // The default moves every course without its own.
    await s.click("Target kehadiran 80%");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Untuk mata kuliah yang tak punya target sendiri");
    await s.click("Naikkan target umum");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTarget: 85 } });
    await s.click("Naikkan target umum");
    expect(s.has("Target kehadiran 90%")).toBe(true);
    expect(card("PL3002")).toContain("Jangan absen lagi");
    expect(card("DK4073")).toContain("Boleh absen 1× lagi");
    await s.click("Kembali ke 80%");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTarget: 80 } });
    // The button is gone once pressed: the panel closes with it.
    expect(document.querySelector("[role=dialog]")).toBeNull();
    // Back to the default for DK4073.
    await s.click("Target 75% untuk DK4073");
    await s.click("Pakai target umum (80%)");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTargets: {} } });
    expect(card("DK4073")).toContain("Jangan absen lagi");
  });

  it("in English", async () => {
    const s = await openPresence();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await six([course("PL3002", 6, 7)], withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)));
    const pl = [...document.querySelectorAll('main ul[aria-label="Courses"] > li')].find((li) => li.textContent?.startsWith("PL3002"))?.textContent ?? "";
    expect(pl).toContain("Counted in SIX");
    expect(pl).toContain("You can miss 1 more");
    expect(pl).toContain("Until 4 Dec · 6/7 attended · 85%");
    expect(strip("PL3002")).toBe("Meetings: 6 attended, 1 missed, about 7 to go");
    // The open window says what to do, without claiming Edunex is what counts (the Indonesian says "agar tercatat").
    expect(s.text()).toContain("SIX counts your attendance: just be in class. Recording in Edunex is optional.");
    expect(s.text()).not.toContain("so it counts");
  });

  it("before SIX is connected, says so instead of guessing, and what SIX unlocks", async () => {
    const s = await openPresence();
    expect(answer()).toBe("Hitungan resmi kehadiran ada di SIX");
    // Without SIX nobody knows which system counts: said once at the top; no row claims SIX has no count, or repeats it.
    expect(s.text().match(/Hitungan resmi/g)).toHaveLength(1);
    expect(s.text()).not.toContain("Belum ada hitungan SIX");
    expect(card("PL3002")).toContain("Edunex: hadir 1 dari 6 Presensi");
    expect(s.text()).not.toContain("Dicatat lewat Presensi Edunex");
    // The open window: worth recording just in case, not a must-do (the same on Beranda and the course page).
    expect(s.text()).toContain("Tanpa SIX, belum pasti ini dihitung: catat saja untuk berjaga-jaga.");
    expect([...document.querySelectorAll("main button")].find((b) => b.textContent === "Catat di Edunex")!.className).not.toContain("bg-accent ");
    expect(card("KU5014")).toContain("Belum ada catatan kehadiran");
    // Edunex's own record, with each window's date.
    expect(squares("II4091")[0]).toBe("Rab 26 Agu · tercatat hadir di Edunex");
    expect(s.text()).not.toMatch(/\bAbsent\b|Tidak hadir/);
    // No counts to add up: where they come from and a way in, not four zeros.
    expect(s.text()).toContain("Sisa jatah absen dihitung dari SIX");
    expect(s.text()).not.toContain("Masih aman");
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
    expect(s.text()).not.toContain("Sisa jatah absen dihitung dari SIX");
    expect(s.text()).toContain("Masih aman");
  });
});

describe("attendance in Settings", () => {
  it("the Presence and attendance alerts switch off, and the target is set there too", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Presensi dibuka");
    await screen.click("Kehadiran");
    expect(screen.engine.snapshot().settings.mutedAlerts).toEqual(["presence", "attendanceRisk"]);
    expect(screen.text()).toContain("Target kehadiran");
    await screen.click("Turunkan target umum");
    expect(screen.engine.snapshot().settings.attendanceTarget).toBe(75);
  });
});
