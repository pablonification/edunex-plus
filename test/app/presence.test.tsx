// @vitest-environment jsdom
// v2-16 (#85), feedback 6, seam 2: the Presensi screen as the Student reads
// it, with the real engine and the pretend Edunex, SIX and ITB calendar
// behind the bridge (some tests put SIX's count and timetable in directly).
// The screen answers "am I OK, and what do I need to do?" first.
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
const STUDENT = { nim: "18223901", name: "Dimas Pratama", studentId: "2021000001", term: "2026-1", program: null, programCode: null };

/** Signed in to Edunex (and, with `sixToo`, to the pretend SIX), on Presensi. */
async function openPresence(now?: string, sixToo = false) {
  screen = await openApp({ signedIn: true, six: sixToo, world: new PretendWorld({ now }) });
  await screen.wait();
  await screen.click(/^Presensi/);
  return screen;
}

const rows = () => [...document.querySelectorAll('main ul[aria-label="Mata kuliah"] > li, main ul[aria-label="Courses"] > li')];
const row = (code: string) => rows().find((li) => li.textContent?.startsWith(code));
const card = (code: string) => row(code)?.textContent ?? "";
/** The answer under the title, a line each. */
const answer = () => [...(document.querySelector("main h1")?.nextElementSibling?.querySelectorAll(":scope > span > span") ?? [])].map((s) => s.textContent);
const answerText = () => document.querySelector("main h1")?.nextElementSibling?.textContent ?? "";
/** The Edunex windows open now that count, on top. */
const onTop = () => document.querySelector('main section[aria-label="Presensi yang dibuka sekarang"]')?.textContent ?? "";

describe("the Presensi screen", () => {
  it("answers first, by name: what to do in which course, worst first, in the rows' order; the sidebar counts them", async () => {
    const s = await openPresence(undefined, true);
    expect(answer()).toEqual(["KU5014 sudah tak bisa capai 80%.", "Jangan absen lagi di DK4073 dan PL3032.", "Masih bisa absen 1× lagi di PL3002."]);
    expect(rows().map((li) => li.textContent?.slice(0, 6))).toEqual(["KU5014", "DK4073", "PL3032", "PL3002", "II4091"]);
    // The courses with nothing to spare or out of reach: PL3002, one absence still allowed, isn't counted.
    expect(s.button(/^Presensi/).textContent).toBe("Presensi3");
    // What was cut: the tally tiles and their filter, and the meeting squares that read like a timeline.
    expect(s.text()).not.toMatch(/Masih aman|Hati-hati|Tampilkan semua/);
    expect(document.querySelectorAll("main [role=listitem]")).toHaveLength(0);
  });

  it("a row: the verdict, the count with what's left and one meter against the target, then the next class and what records it", async () => {
    await openPresence(undefined, true);
    const dk = card("DK4073");
    expect(dk).toContain("Jangan absen lagi");
    // The share in words beside the count, as the course page says it: not only in the meter's name.
    expect(dk).toContain("Hadir 4 dari 6 · 66% · sekitar 8 pertemuan lagi sampai 4 Des");
    expect(dk).toContain("Berikutnya: Hari ini, 11:00 · TVST C · cukup hadir di kelas");
    expect(row("DK4073")?.querySelector("[role=img]")?.getAttribute("aria-label")).toBe("Hadir 4 dari 6, 66%, target 80%");
    // No way back next to "Jangan absen lagi": every class from here on is the one instruction.
    expect(dk).not.toContain("untuk kembali ke");
    // One absence left: still allowed, so green, not a warning; amber only once none is left, red out of reach.
    expect(card("PL3002")).toContain("Masih bisa absen 1× lagi");
    const tone = (code: string) => [...(row(code)?.querySelectorAll("p") ?? [])].find((p) => p.className.includes("text-title"))?.className ?? "";
    expect(tone("PL3002")).toContain("text-success-fg");
    expect(tone("DK4073")).toContain("text-warning-fg");
    expect(tone("KU5014")).toContain("text-danger-fg");
    expect(row("PL3002")?.querySelector("[role=img]")?.getAttribute("data-tone")).toBe("success");
    expect(row("DK4073")?.querySelector("[role=img]")?.getAttribute("data-tone")).toBe("warning");
    // Recorded through Edunex too: be in class, then what that day's Presence asks for, said once with the class.
    expect(card("II4091")).toContain("Berikutnya: Jum, 16 Okt, 15:00 · hadir, lalu kumpulkan Tugas 02 Bab II sebelum 23:59");
    expect(card("II4091")).not.toContain("Presensi Edunex Jum");
    // Never an absence on Edunex's word.
    expect(document.body.textContent).not.toMatch(/\bAbsent\b|Tidak hadir/);
  });

  it("a window where only SIX counts is a quiet line in its row, never on top; the app never records presence itself", async () => {
    const s = await openPresence(undefined, true);
    expect(onTop()).toBe("");
    const pl = card("PL3002");
    expect(pl).toContain("Sedang berlangsung sampai 10:00 · R.SG PWK LT.6 · cukup hadir di kelas");
    expect(pl).toContain("Presensi Edunex juga dibuka sampai 09:30, tidak wajib.");
    await s.click("Catat di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
    expect(s.world.log.every((request) => request.method === "GET")).toBe(true);
  });

  it("a window that counts is on top: its one action, until when, and the time left", async () => {
    const s = await openPresence("2026-10-16T15:30:00+07:00");
    const task: Task = aTask({ id: 117003, courseCode: "II4091", courseId: 95326, moduleId: 450222, title: "Tugas 02 Bab II", status: "not_started" });
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [task], fetchedAt: 0, hash: "t1" } });
    await six([course("II4091", 3, 3)], [...weekly("II4091", "2026-09-04T15:00:00", 8)]);
    expect(onTop()).toContain("Kumpulkan Tugas 02 Bab II sebelum 23:59");
    expect(onTop()).toContain("II4091 · dicatat lewat Presensi Edunex");
    // Two facts on Meta's line, so the dot between them can't end a line when it wraps.
    expect([...document.querySelectorAll("main section [data-fact] > :last-child")].map((fact) => fact.textContent)).toEqual([
      "II4091",
      "dicatat lewat Presensi Edunex",
    ]);
    expect(onTop()).toMatch(/8 jam \d+ mnt lagi/);
    await s.click("Buka tugasnya");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });

  it("a next class inside UTS week is said to be uncertain, and buys no absence", async () => {
    const s = await openPresence("2026-10-09T09:00:00+07:00");
    // SIX still lists the Thursday lecture in UTS week.
    await six([course("PL3002", 6, 7)], weekly("PL3002", "2026-08-27T08:00:00", 10));
    const pl = card("PL3002");
    expect(pl).toContain("Berikutnya: Kam, 15 Okt, 08:00 · 9134 · cukup hadir di kelas");
    // It may not run; if it does, attending it still counts.
    expect(pl).toContain("Kam 15 Okt masuk masa UTS, jadi kuliahnya mungkin tak ada. Kalau tetap ada, hadiri: tetap dihitung.");
    // Counted, it would say "2× lagi": one absence too many if the lecture doesn't run.
    expect(pl).toContain("Masih bisa absen 1× lagi");
    expect(pl).toContain("Hadir 6 dari 7 · 85% · sekitar 7 pertemuan lagi sampai 4 Des");
    expect(s.text()).toContain(
      "Kuliah yang masih dijadwalkan SIX di minggu UTS, UAS atau hari libur belum pasti ada, jadi tidak dihitung sebagai jatah absen, tapi juga tak membuat target dianggap tak terkejar.",
    );
  });

  it("one warning at most: a clash with another class comes before the way back to the target", async () => {
    await openPresence("2026-10-08T09:00:00+07:00");
    // PL3032 15:00–17:00 and KU5014 16:00–18:00 every Thursday; DK4073 on Mondays, below 80% for now with one absence left.
    await six(
      [course("PL3032", 5, 6), course("KU5014", 5, 6), course("DK4073", 3, 4)],
      [...weekly("PL3032", "2026-08-27T15:00:00", 10), ...weekly("KU5014", "2026-08-27T16:00:00", 10), ...withUts(weekly("DK4073", "2026-08-24T11:00:00", 10))],
    );
    expect(card("PL3032")).toContain("Bentrok dengan KU5014 16:00–17:00");
    expect(card("KU5014")).toContain("Bentrok dengan PL3032 16:00–17:00");
    expect(card("PL3032")).not.toContain("untuk kembali ke");
    expect(card("DK4073")).toContain("Hadiri 1 pertemuan berikutnya untuk kembali ke 80%");
    // The warning is the row's last part, a single line.
    expect(row("PL3032")?.querySelectorAll(":scope > div:last-child > p")).toHaveLength(1);
  });

  it("a target that hangs on a UTS-week lecture: no absences left, not out of reach, and the row says that lecture is needed", async () => {
    await openPresence("2026-10-09T09:00:00+07:00");
    // 4 of 7: the sure meetings alone reach 78%; with 15 Oct, 12 of 15 is 80%.
    await six([course("PL3002", 4, 7)], weekly("PL3002", "2026-08-27T08:00:00", 10));
    const pl = card("PL3002");
    expect(pl).toContain("Jangan absen lagi");
    expect(pl).not.toContain("Tak bisa lagi capai");
    expect(pl).toContain("Kam 15 Okt masuk masa UTS: 80% hanya masih bisa kalau kuliahnya tetap ada dan kamu hadir.");
  });

  it("an Edunex window on another day than the next class keeps a quiet line of its own", async () => {
    await openPresence(undefined, true);
    // II4091 meets on Mondays here: its next class isn't on the day of its window (Fri 16 Oct).
    await six([course("II4091", 3, 3)], weekly("II4091", "2026-08-24T08:00:00", 10));
    const ii = card("II4091");
    expect(ii).toContain("Presensi Edunex Jum, 16 Okt, 15:00–23:59: Kumpulkan Tugas 02 Bab II");
    expect(ii).not.toContain("lalu kumpulkan");
  });

  it("out of reach: the best still possible, and the one thing left to do, a click from SIX", async () => {
    const s = await openPresence();
    await s.apply({ type: "dataset", dataset: { name: "six.student", value: STUDENT, fetchedAt: 0, hash: "st1" } });
    await six([course("KU5014", 2, 6)], withUts(weekly("KU5014", "2026-08-27T16:00:00", 10)));
    const ku = card("KU5014");
    expect(ku).toContain("Tak bisa lagi capai 80%");
    expect(ku).toContain("Hadir 2 dari 6 · 33% · paling tinggi 71% di akhir kuliah");
    expect(ku).toContain("Ada pertemuan yang kamu hadiri tapi tak tercatat? Minta dosen membetulkannya di SIX.");
    await s.click("Cek di SIX");
    expect(s.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001" },
    });
  });

  it("once a course's lectures are over, its verdict is final and calm: no 'don't miss', no banner, nothing on Beranda", async () => {
    // Thursday 3 December, 14:00: both courses' last Thursday class of the term is behind (lectures end Friday 4 December).
    const s = await openPresence("2026-12-03T14:00:00+07:00");
    await six(
      [course("DK4073", 4, 4), course("PL3032", 9, 12)],
      [...weekly("DK4073", "2026-08-27T11:00:00", 15), ...weekly("PL3032", "2026-08-27T08:00:00", 15)],
    );
    const dk = card("DK4073");
    expect(dk).toContain("Selesai, 80% tercapai");
    expect(dk).toContain("tak ada pertemuan lagi");
    expect(dk).not.toMatch(/Jangan absen|Masih bisa absen/);
    expect(card("PL3032")).toContain("Selesai di bawah 80%");
    expect(card("PL3032")).not.toContain("Tak bisa lagi capai");
    // Final and calm: the red verdict, no warning line under it.
    expect(card("PL3032")).not.toContain("Ada pertemuan yang kamu hadiri");
    expect(answer()).toEqual(["PL3032 selesai di bawah 80%."]);
    // Nothing needs the Student: no count on the sidebar.
    expect(s.button(/^Presensi/).textContent).toBe("Presensi");

    // The course page: no banner, the header says it once.
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("DK4073"))!);
    expect(document.querySelector("main .bg-warning-bg, main .bg-danger-bg")).toBeNull();
    expect(document.querySelector("main header")?.textContent).toContain("Selesai, 80% tercapai");

    // Beranda: no attendance item.
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside nav button")].find((b) => b.textContent?.startsWith("Beranda"))!);
    const needs = document.querySelector('main section[aria-labelledby="home-needs"]')?.textContent ?? "";
    expect(needs).not.toMatch(/DK4073|PL3032/);
  });

  it("a row opens the course's meetings, where each one has its date", async () => {
    const s = await openPresence(undefined, true);
    await s.click(/^PL3002 · /);
    expect(document.querySelector("main h1")?.textContent).toBe("Ekonomi dan Inovasi dalam Perencanaan");
    expect(s.text()).toContain("Kam, 27 Agu08:00–09:30");
  });

  it("follows a mid-semester schedule change", async () => {
    const s = await openPresence();
    const regular = weekly("KU5014", "2026-08-27T16:00:00", 10);
    await six([course("KU5014", 5, 6)], regular);
    expect(card("KU5014")).toContain("Hari ini, 16:00 · 9134");
    // SIX moves today's class to tomorrow 13:00 in another room.
    const moved = regular.map((x) =>
      x.start === wib("2026-10-08T16:00:00") ? { ...x, start: wib("2026-10-09T13:00:00"), end: wib("2026-10-09T15:00:00"), room: "7602" } : x,
    );
    await six([course("KU5014", 5, 6)], moved);
    expect(card("KU5014")).toContain("Besok, 13:00 · 7602");
    expect(s.text()).not.toContain("16:00 · 9134");
  });

  it("each course's own target, set on its row; the default is for every other course", async () => {
    const s = await openPresence();
    await six(
      [course("PL3002", 6, 7), course("DK4073", 4, 6)],
      [...withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)), ...withUts(weekly("DK4073", "2026-08-24T11:00:00", 10))],
    );
    expect(card("DK4073")).toContain("Jangan absen lagi");
    // DK4073's course contract asks for 75%.
    await s.click("Target 80% untuk DK4073");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Target kehadiran DK4073");
    await s.click("Turunkan target DK4073");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTargets: { DK4073: 75 } } });
    expect(card("DK4073")).toContain("Masih bisa absen 1× lagi");
    expect(card("DK4073")).toContain("Target 75%");
    expect(card("PL3002")).toContain("Target 80%");
    await s.key("Escape");
    // The page's own target says plainly it's for every course: not to be mixed up with a row's "Target 80%".
    await s.click("Target semua mata kuliah: 80%");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Untuk mata kuliah yang tak punya target sendiri");
    await s.click("Naikkan target umum");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTarget: 85 } });
    await s.click("Naikkan target umum");
    expect(s.has("Target semua mata kuliah: 90%")).toBe(true);
    expect(card("PL3002")).toContain("Jangan absen lagi");
    expect(card("DK4073")).toContain("Masih bisa absen 1× lagi");
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

  it("how it's counted is closed until the Student opens it", async () => {
    const s = await openPresence(undefined, true);
    const how = document.querySelector<HTMLDetailsElement>("main details")!;
    expect(how.open).toBe(false);
    expect(how.querySelector("summary")?.textContent).toBe("Cara menghitungnya");
    expect(how.textContent).toContain("SIX hanya memberi jumlahnya, bukan pertemuan mana yang absen.");
    await s.click("Buka jadwal di SIX");
    expect(s.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: expect.stringContaining("six.itb.ac.id") } });
  });

  it("in English", async () => {
    const s = await openPresence(undefined, true);
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(answer()).toEqual(["KU5014 can't reach 80% anymore.", "Don't miss another class in DK4073 and PL3032.", "You can miss 1 more class in PL3002."]);
    expect(card("DK4073")).toContain("Attended 4 of 6 · 66% · about 8 meetings left until 4 Dec");
    expect(document.querySelector("main header")?.textContent).toContain("Target for all courses: 80%");
    expect(card("DK4073")).toContain("Next: Today, 11:00 · TVST C · just be in class");
    expect(card("PL3002")).toContain("You can miss 1 more class");
    expect(card("PL3002")).toContain("Edunex Presence is also open until 09:30; it's optional.");
    expect(card("II4091")).toContain("You can miss 2 more classes");
  });

  it("before SIX is connected: where the count comes from and the way in, nothing guessed", async () => {
    const s = await openPresence();
    expect(answerText()).toContain("Jatah absen dihitung dari SIX");
    expect(s.text()).not.toContain("Belum ada hitungan SIX");
    // Edunex's own record is a fact, never an absence.
    expect(card("PL3002")).toContain("Edunex: hadir 1 dari 6 Presensi");
    expect(s.text()).not.toMatch(/\bAbsent\b|Tidak hadir/);
    // Nobody can say the open window counts: worth recording just in case, said calmly, its button quiet.
    expect(onTop()).toContain("tanpa SIX, belum pasti ini dihitung: catat saja untuk berjaga-jaga");
    expect([...document.querySelectorAll("main section button")].find((b) => b.textContent === "Catat di Edunex")!.className).not.toContain("bg-accent ");
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
    expect(answerText()).not.toContain("Jatah absen dihitung dari SIX");
    expect(answer()[0]).toBe("KU5014 sudah tak bisa capai 80%.");
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
