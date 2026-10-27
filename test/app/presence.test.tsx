// @vitest-environment jsdom
// v2-16 (#85), feedback 6, seam 2: the Presensi screen as the Student reads
// it, with the real engine and the pretend Edunex, SIX and ITB calendar
// behind the bridge (some tests put SIX's count and timetable in directly).
// "Absences left": the answer for the next class day first, then only what
// needs the Student now, then the courses grouped by what they ask, each with
// SIX's share and its absences as a bar and words, and one exception at most.
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
async function put(name: string, value: unknown) {
  await screen!.apply({ type: "dataset", dataset: { name, value, fetchedAt: 0, hash: `${name}${++hash}` } as never });
}
async function six(courses: SixCourse[], schedule: ClassSession[]) {
  await put("six.courses", courses);
  await put("six.schedule", schedule);
}
const STUDENT = { nim: "18223901", name: "Dimas Pratama", studentId: "2021000001", term: "2026-1", program: null, programCode: null };

/** Signed in to Edunex (and, with `sixToo`, to the pretend SIX), on Presensi. */
async function openPresence(now?: string, sixToo = false) {
  screen = await openApp({ signedIn: true, six: sixToo, world: new PretendWorld({ now }) });
  await screen.wait();
  await screen.click(/^Presensi/);
  return screen;
}

/** The groups, by heading, each with its rows' course codes. */
const groups = () =>
  [...document.querySelectorAll("main section[aria-labelledby^=presence-]")].map((section) => [
    section.querySelector("h2")?.textContent,
    [...section.querySelectorAll("ul > li")].map((li) => li.querySelector("p")?.textContent?.slice(0, 6)),
  ]);
const rows = () => [...document.querySelectorAll("main section[aria-labelledby^=presence-] ul > li")];
const row = (code: string) => rows().find((li) => li.querySelector("p")?.textContent?.startsWith(code));
const card = (code: string) => row(code)?.textContent ?? "";
/** The answer for the next class day, under the title. */
const dayLine = () => document.querySelector("main h1")?.nextElementSibling?.textContent ?? "";
/** What needs the Student now, above the groups. */
const now = () => document.querySelector('main section[aria-label="Perlu perhatianmu sekarang"], main section[aria-label="Needs you now"]')?.textContent ?? "";
/** A row's absence bar: its segments and its name. */
const bar = (code: string) => {
  const img = row(code)?.querySelector<HTMLElement>("[role=img]");
  return img
    ? {
        label: img.getAttribute("aria-label"),
        tone: img.dataset.tone,
        segments: [...img.querySelectorAll<HTMLElement>("[data-state]")].map((s) => s.dataset.state),
      }
    : null;
};
/** The words beside a row's bar. */
const words = (code: string) => row(code)?.querySelector("[role=img]")?.nextElementSibling?.textContent ?? "";
/** A row's attendance at its end, label by label: "Kehadiran" → "85% sejauh ini (6 dari 7)", "Jatah absen" → … */
const side = (code: string) =>
  Object.fromEntries([...(row(code)?.querySelectorAll("dl > dt") ?? [])].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent ?? ""]));
/** The Targets panel's rows, top to bottom: each course's code, or "default". */
const targetRows = () => [...document.querySelectorAll("[role=dialog] li [data-target]")].map((el) => el.getAttribute("data-target"));
const rowName = (code: string) => row(code)?.querySelector(":scope > button")?.getAttribute("aria-label") ?? "";

describe("the Presensi screen", () => {
  it("answers for the next class day, groups the courses by what they ask, and the badge counts only what needs action now", async () => {
    const s = await openPresence(undefined, true);
    expect(dayLine()).toBe("Hari ini ada 4 kuliah. Hanya PL3002 yang masih ada jatah absen.");
    expect(groups()).toEqual([
      ["Tak bisa lagi capai 80% 1", ["KU5014"]],
      ["Jatah absen habis 2", ["DK4073", "PL3032"]],
      ["Masih ada jatah absen 2", ["PL3002", "II4091"]],
    ]);
    // Courses standing with no absences left, or out of reach, are said here and on the day: the badge waits for a thing to do now.
    expect(s.button(/^Presensi/).textContent).toBe("Presensi");
    // The answer lines, the percent bar and its tick are gone; nothing repeats the headings.
    expect(s.text()).not.toMatch(/Jangan absen lagi|Masih bisa absen|Semua aman/);
  });

  it("a row: the course first, its next class, then SIX's share, labeled, over its absences as a bar with words", async () => {
    await openPresence(undefined, true);
    expect(card("DK4073")).toContain("Berikutnya hari ini, 11:00–12:59 · TVST C");
    expect(bar("DK4073")).toEqual({ label: "Jatah absen semester ini 2×. Semua sudah terpakai.", tone: "warning", segments: ["used", "used"] });
    expect(words("DK4073")).toBe("Terpakai 2× · habis");
    expect(bar("PL3002")).toMatchObject({ tone: "neutral", segments: ["used", "left"] });
    expect(words("PL3002")).toBe("Terpakai 1× · sisa 1×");
    expect(words("II4091")).toBe("Belum terpakai · sisa 2×");
    // Past the limit: amber up to a limit line, then what's over in red; the words say it plainly.
    expect(bar("KU5014")).toMatchObject({ tone: "danger", segments: ["used", "used", "used", "limit", "over"] });
    expect(words("KU5014")).toBe("Terpakai 4× · lewat batas 1×");
    // The bold part answers, in its tone.
    expect(row("DK4073")?.querySelector(".text-warning-fg")?.textContent).toBe("habis");
    expect(row("KU5014")?.querySelector(".text-danger-fg.font-semibold")?.textContent).toBe("lewat batas 1×");
    // SIX's share, once per row, labeled and "so far", over the bar: the labels line up, each with its value.
    expect(side("KU5014")).toEqual({ Kehadiran: "33% sejauh ini (2 dari 6)", "Jatah absen": "Terpakai 4× · lewat batas 1×" });
    expect(side("DK4073")).toEqual({ Kehadiran: "66% sejauh ini (4 dari 6)", "Jatah absen": "Terpakai 2× · habis" });
    expect(side("PL3002").Kehadiran).toBe("85% sejauh ini (6 dari 7)");
    expect(side("II4091").Kehadiran).toBe("100% sejauh ini (3 dari 3)");
    for (const li of rows()) expect((li.querySelector("dl")?.textContent ?? "").match(/\d+%/g)).toHaveLength(1);
    // The row's name reads as the Student sees it.
    expect(rowName("PL3002")).toBe(
      "PL3002 Ekonomi dan Inovasi dalam Perencanaan, Jatah absen, Terpakai 1×, sisa 1×, Kehadiran 85% sejauh ini (6 dari 7), Sedang berlangsung sampai 10:00, R.SG PWK LT.6",
    );
    expect(rowName("DK4073")).toMatch(
      /^DK4073 Komunikasi Pemasaran, Jatah absen, Terpakai 2×, habis, Kehadiran 66% sejauh ini \(4 dari 6\), Berikutnya hari ini/,
    );
    expect(rowName("KU5014")).toMatch(
      /^KU5014 .*, Jatah absen, Terpakai 4×, lewat batas 1×, Kehadiran 33% sejauh ini \(2 dari 6\), Berikutnya hari ini, 16:00/,
    );
  });

  it("one exception per row: Tandai Hadir watched in class; out of reach, the fix and the target a click away", async () => {
    const s = await openPresence(undefined, true);
    expect(card("PL3002")).toContain("Sedang berlangsung sampai 10:00 · R.SG PWK LT.6");
    expect(card("PL3002")).toContain("Tandai Hadir belum muncul. Aplikasi memeriksa SIX tiap 2 menit.");
    // The Edunex window open where only SIX counts isn't mentioned at all here.
    expect(card("PL3002")).not.toContain("Presensi Edunex");
    expect(now()).not.toContain("Catat di Edunex");
    const ku = card("KU5014");
    expect(ku).toContain("Ada pertemuan yang kamu hadiri tapi tak tercatat? Minta dosen membetulkannya di SIX.");
    // Red only for what's lost (the words past the limit); the way back is calm, its actions blue like every link.
    expect([...row("KU5014")!.querySelectorAll("[class*='text-danger-fg']")].map((el) => el.textContent)).toEqual(["lewat batas 1×"]);
    const actions = [...row("KU5014")!.querySelectorAll<HTMLButtonElement>("button:not(:scope > button)")];
    expect(actions.map((b) => b.textContent)).toEqual(["Buka jadwal di SIX", "Ubah target"]);
    for (const action of actions) expect(action.className).toContain("text-accent-fg");
    // One exception only: KU5014's clash is said by today's clash card.
    expect(ku).not.toContain("Bentrok");
    // Recorded through Edunex too: Tandai Hadir, then what that day's Presence asks for, by when.
    expect(card("II4091")).toContain("Tandai Hadir di SIX, lalu kumpulkan Tugas 02 Bab II sebelum 23:59.");
    const change = s.button("Ubah target: KU5014");
    change.focus();
    await s.click(change);
    const panel = document.querySelector("[role=dialog]")!;
    expect(panel.textContent).toContain("Target kehadiran");
    // KU5014 first, tinted, focus on its own stepper; the default last, out of the way of a change meant for one course.
    expect(targetRows()).toEqual(["KU5014", "DK4073", "II4091", "PL3002", "PL3032", "default"]);
    expect(panel.querySelector('[data-target="KU5014"]')?.closest("li")?.className).toContain("bg-fill");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Turunkan target KU5014");
    await s.key("Escape");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Ubah target: KU5014");
    // From the header's "Target", the overview: the default first, then each course in its order, none tinted.
    await s.click(/^Target80%$/);
    expect(targetRows()).toEqual(["default", "DK4073", "II4091", "KU5014", "PL3002", "PL3032"]);
    expect(document.querySelector("[role=dialog] li.bg-fill")).toBeNull();
  });

  it("a clash today: which to go to if the Student can make only one, and why, said once", async () => {
    await openPresence(undefined, true);
    expect(now()).toContain("PL3032 dan KU5014 bentrok hari ini, 16:00–16:30");
    expect(now()).toContain("Kalau hanya bisa hadir di salah satunya, pilih PL3032. Jatah absennya sudah habis, dan KU5014 sudah tak bisa capai 80%.");
    expect(card("PL3032")).not.toContain("Bentrok");
  });

  it("a clash on another day is said on the row, with the pick: every week when it's both courses' usual slot", async () => {
    await openPresence("2026-10-07T09:00:00+07:00");
    // PL3032 15:00–17:00 and KU5014 16:00–18:00 every Thursday; PL3032 has no absences left, KU5014 one.
    await six(
      [course("PL3032", 4, 6), course("KU5014", 5, 6)],
      [...weekly("PL3032", "2026-08-27T15:00:00", 10), ...weekly("KU5014", "2026-08-27T16:00:00", 10)],
    );
    expect(card("PL3032")).toContain("Bentrok dengan KU5014 tiap Kamis, 16:00–17:00. Pilih ini kalau hanya bisa hadir di salah satunya.");
    expect(card("KU5014")).toContain("Bentrok dengan PL3032 tiap Kamis, 16:00–17:00. Kalau hanya bisa hadir di salah satunya, pilih PL3032.");
    expect(now()).toBe("");
  });

  it("a window that counts is on top: its one action, until when, and the time left; the badge counts it", async () => {
    const s = await openPresence("2026-10-16T15:30:00+07:00");
    const task: Task = aTask({ id: 117003, courseCode: "II4091", courseId: 95326, moduleId: 450222, title: "Tugas 02 Bab II", status: "not_started" });
    await put("edunex.tasks", [task]);
    await six([course("II4091", 3, 3)], [...weekly("II4091", "2026-09-04T15:00:00", 8)]);
    expect(now()).toContain("Kumpulkan Tugas 02 Bab II sebelum 23:59");
    expect(now()).toContain("II4091 · dicatat lewat Presensi Edunex");
    expect(now()).toMatch(/8 jam \d+ mnt lagi/);
    expect(s.button(/^Presensi/).textContent).toBe("Presensi1, Perlu perhatianmu");
    await s.click("Buka tugasnya");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });

  it("recorded only in Edunex: its own group, Edunex's tally, and a hand-in window said as a deadline, not a class time", async () => {
    await openPresence("2026-10-14T09:00:00+07:00");
    await put("six.student", STUDENT);
    // SIX shows no count for II4091 yet; its Edunex windows recorded the Student.
    await six([{ ...course("II4091", 0, 0), attendance: null }], weekly("II4091", "2026-08-28T08:00:00", 12));
    expect(groups()[0]).toEqual(["Dicatat di Edunex 1", ["II4091"]]);
    expect(card("II4091")).toContain("Hadir 2 dari 2 di Edunex");
    expect(card("II4091")).toContain("Presensi Edunex Jum 16 Okt. Kumpulkan Tugas 02 Bab II sebelum 23:59.");
    expect(card("II4091")).not.toContain("15:00–23:59");
  });

  it("a next class inside UTS week is said to be uncertain, and buys no absence; two such rows share one note on top", async () => {
    await openPresence("2026-10-09T09:00:00+07:00");
    // SIX still lists the Thursday lecture in UTS week.
    await six([course("PL3002", 6, 7)], weekly("PL3002", "2026-08-27T08:00:00", 10));
    expect(card("PL3002")).toContain("Berikutnya Kam 15 Okt, 08:00–10:00 · 9134");
    expect(card("PL3002")).toContain("Kam 15 Okt masuk masa UTS, jadi kuliahnya mungkin tak ada. Kalau tetap ada, hadiri. Tetap dihitung.");
    // Counted, it would be two left: one absence too many if the lecture doesn't run.
    expect(words("PL3002")).toBe("Terpakai 1× · sisa 1×");
    await six(
      [course("PL3002", 6, 7), course("PL3032", 6, 7)],
      [...weekly("PL3002", "2026-08-27T08:00:00", 10), ...weekly("PL3032", "2026-08-27T13:00:00", 10)],
    );
    expect(now()).toBe("Kuliah di masa UTS (12–16 Okt) mungkin tak ada. Kalau tetap ada, hadiri. Tetap dihitung.");
    expect(card("PL3002")).not.toContain("masuk masa UTS");
    expect(card("PL3032")).not.toContain("masuk masa UTS");
  });

  it("a target that hangs on a UTS-week lecture: no absences left, not out of reach, and the row says that lecture is needed", async () => {
    await openPresence("2026-10-09T09:00:00+07:00");
    // 4 of 7: the sure meetings alone reach 78%; with 15 Oct, 12 of 15 is 80%.
    await six([course("PL3002", 4, 7)], weekly("PL3002", "2026-08-27T08:00:00", 10));
    expect(groups()[0]).toEqual(["Jatah absen habis 1", ["PL3002"]]);
    expect(card("PL3002")).toContain("Kam 15 Okt masuk masa UTS. 80% hanya masih bisa kalau kuliah itu tetap ada dan kamu hadir.");
  });

  it("out of reach: the one thing left to do, a click from SIX", async () => {
    const s = await openPresence();
    await put("six.student", STUDENT);
    await six([course("KU5014", 2, 6)], withUts(weekly("KU5014", "2026-08-27T16:00:00", 10)));
    expect(card("KU5014")).toContain("Ada pertemuan yang kamu hadiri tapi tak tercatat? Minta dosen membetulkannya di SIX.");
    await s.click("Buka jadwal di SIX");
    expect(s.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001" },
    });
  });

  it("once a course's lectures are over, its result is final and calm: no bar, no 'final' on the day, nothing on Beranda", async () => {
    // Monday 7 December: lectures ended Friday 4 December.
    const s = await openPresence("2026-12-07T09:00:00+07:00");
    await put("six.student", STUDENT);
    await six(
      [course("DK4073", 13, 15), course("PL3032", 9, 12)],
      [...weekly("DK4073", "2026-08-27T11:00:00", 15), ...weekly("PL3032", "2026-08-27T08:00:00", 15)],
    );
    expect(dayLine()).toBe("Kuliah berakhir Jum 4 Des.");
    expect(groups().filter(([heading]) => /80%/.test(String(heading)))).toEqual([
      ["Selesai di bawah 80% 1", ["PL3032"]],
      ["80% tercapai 1", ["DK4073"]],
    ]);
    expect(card("DK4073")).toContain("Selesai dengan kehadiran 86%");
    expect(row("DK4073")?.querySelector("[role=img]")).toBeNull();
    // Nothing says it's final: a lecturer can still fix SIX.
    expect(s.text()).not.toMatch(/\bfinal\b|hasil akhir/i);
    expect(s.button(/^Presensi/).textContent).toBe("Presensi");

    // The course page: no banner, the header says how it finished.
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("DK4073"))!);
    expect(document.querySelector("main .bg-warning-bg, main .bg-danger-bg")).toBeNull();
    expect(document.querySelector("main header")?.textContent).toContain("Selesai, 80% tercapai");
  });

  it("a row opens the course's meetings, where each one has its date", async () => {
    const s = await openPresence(undefined, true);
    await s.click(/^PL3002 Ekonomi/);
    expect(document.querySelector("main h1")?.textContent).toBe("Ekonomi dan Inovasi dalam Perencanaan");
    expect(s.text()).toContain("Kam, 27 Agu08:00–09:30");
  });

  it("follows a mid-semester schedule change", async () => {
    const s = await openPresence();
    const regular = weekly("KU5014", "2026-08-27T16:00:00", 10);
    await six([course("KU5014", 5, 6)], regular);
    expect(card("KU5014")).toContain("Berikutnya hari ini, 16:00–18:00 · 9134");
    // SIX moves today's class to tomorrow 13:00 in another room.
    const moved = regular.map((x) =>
      x.start === wib("2026-10-08T16:00:00") ? { ...x, start: wib("2026-10-09T13:00:00"), end: wib("2026-10-09T15:00:00"), room: "7602" } : x,
    );
    await six([course("KU5014", 5, 6)], moved);
    expect(card("KU5014")).toContain("Berikutnya besok, 13:00–15:00 · 7602");
    expect(s.text()).not.toContain("16:00–18:00 · 9134");
  });

  it("the Targets panel: the default and each course's own, the rows holding still while it's open", async () => {
    const s = await openPresence();
    await six(
      [course("PL3002", 6, 7), course("DK4073", 4, 6)],
      [...withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)), ...withUts(weekly("DK4073", "2026-08-24T11:00:00", 10))],
    );
    /** The two courses with a count: which group each is in. */
    const placed = () => groups().filter(([heading]) => /^(Jatah absen habis|Masih ada jatah absen)/.test(String(heading)));
    expect(placed()).toEqual([
      ["Jatah absen habis 1", ["DK4073"]],
      ["Masih ada jatah absen 1", ["PL3002"]],
    ]);
    const before = groups();
    await s.click(/^Target80%$/);
    const panel = () => document.querySelector("[role=dialog]")?.textContent ?? "";
    expect(panel()).toContain("Samakan tiap mata kuliah dengan batas minimal di kontrak kuliahnya.");
    expect(panel()).toContain("Target umum");
    // DK4073's course contract asks for 75%.
    await s.click("Turunkan target DK4073");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTargets: { DK4073: 75 } } });
    expect(panel()).toContain("Target sendiri");
    // The rows hold still while the panel is open; the bar and words already say 75%.
    expect(groups()).toEqual(before);
    expect(words("DK4073")).toBe("Terpakai 2× · sisa 1× · target 75%");
    await s.click("Naikkan target umum");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTarget: 85 } });
    await s.click("Naikkan target umum");
    await s.key("Escape");
    expect(placed()).toEqual([
      ["Jatah absen habis 1", ["PL3002"]],
      ["Masih ada jatah absen 1", ["DK4073"]],
    ]);
    expect(s.button(/^Target75–90%$/)).toBeTruthy();
    // Back to the default for DK4073: its row stays, its stepper now the default's, focus on it.
    await s.click(/^Target75–90%$/);
    await s.click("Pakai target umum untuk DK4073 (90%)");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTargets: {} } });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Turunkan target DK4073");
  });

  it("how it's counted is closed until the Student opens it; the footer says once how attendance is recorded and what's estimated", async () => {
    const s = await openPresence(undefined, true);
    const how = document.querySelector<HTMLDetailsElement>("main details")!;
    expect(how.open).toBe(false);
    expect(how.querySelector("summary")?.textContent).toBe("Cara menghitungnya");
    expect(how.textContent).toContain("SIX hanya memberi totalnya, bukan pertemuan mana yang kamu lewatkan.");
    expect(s.text()).toContain("Kehadiran dihitung di SIX. Tekan Tandai Hadir di SIX saat tombolnya muncul. Aplikasi akan memberi tahu.");
    expect(s.text()).toContain("Kuliah berakhir Jum 4 Des. Pertemuan setelah 31 Okt diperkirakan dari jadwal mingguan tiap mata kuliah.");
    // Said once, and no row repeats it.
    expect(s.text().match(/Tekan Tandai Hadir di SIX saat tombolnya muncul/g)).toHaveLength(1);
    await s.click("Buka jadwal di SIX");
    expect(s.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: expect.stringContaining("six.itb.ac.id") } });
  });

  it("after class: SIX's count that didn't go up is on top until it moves, and today's receipt says what SIX counted", async () => {
    const s = await openPresence("2026-10-08T16:10:00+07:00");
    await put("six.student", STUDENT);
    await six(
      [course("DK4073", 4, 7), course("PL3002", 7, 8), course("PL3032", 4, 6)],
      [...weekly("DK4073", "2026-09-03T11:00:00", 10), ...weekly("PL3002", "2026-09-03T08:00:00", 10), ...weekly("PL3032", "2026-09-03T13:00:00", 10)],
    );
    const at = wib("2026-10-08T07:00:00");
    await put("six.countLog", {
      DK4073: [
        { at, attended: 4, held: 6 },
        { at: wib("2026-10-08T14:00:00"), attended: 4, held: 7 },
      ],
      PL3002: [
        { at, attended: 6, held: 7 },
        { at: wib("2026-10-08T10:30:00"), attended: 7, held: 8 },
      ],
      PL3032: [{ at, attended: 4, held: 6 }],
    });
    const two = (hour: number) => String(hour).padStart(2, "0");
    const day = (code: string, hour: number) => ({
      courseCode: code,
      start: wib(`2026-10-08T${two(hour)}:00:00`),
      end: wib(`2026-10-08T${two(hour + 2)}:00:00`),
    });
    await put("six.classResults", {
      "DK4073-5": { ...day("DK4073", 11), result: "absent", at: wib("2026-10-08T16:00:00") },
      "PL3002-5": { ...day("PL3002", 8), result: "counted", at: wib("2026-10-08T10:30:00") },
      "PL3032-5": { ...day("PL3032", 13), result: "missing", at: wib("2026-10-08T16:00:00") },
    });
    expect(now()).toContain("SIX mencatatmu tidak hadir di DK4073 hari ini");
    expect(now()).toContain("SIX belum menghitung kuliah PL3032 hari ini");
    expect(now()).toContain("Hadir 4 dari 6 di SIX. Jika kamu hadir, minta dosen membetulkannya hari ini.");
    expect(now()).toContain("PL3002 sudah dihitung di SIX hari ini.");
    // Red for absent, amber for not counted yet.
    expect(document.querySelectorAll("main section .bg-danger-bg")).toHaveLength(1);
    expect(document.querySelectorAll("main section .bg-warning-bg")).toHaveLength(1);
    expect(s.button(/^Presensi/).textContent).toBe("Presensi2, Perlu perhatianmu");
    // The lecturer fixes PL3032: the count moves, and the notice goes.
    await put("six.countLog", {
      DK4073: [
        { at, attended: 4, held: 6 },
        { at: wib("2026-10-08T14:00:00"), attended: 4, held: 7 },
      ],
      PL3002: [
        { at, attended: 6, held: 7 },
        { at: wib("2026-10-08T10:30:00"), attended: 7, held: 8 },
      ],
      PL3032: [
        { at, attended: 4, held: 6 },
        { at: wib("2026-10-08T16:05:00"), attended: 5, held: 7 },
      ],
    });
    expect(now()).not.toContain("PL3032");
    expect(s.button(/^Presensi/).textContent).toBe("Presensi1, Perlu perhatianmu");
  });

  it("the first week, before SIX counts: an estimate from the timetable, hatched", async () => {
    await openPresence("2026-08-26T07:30:00+07:00");
    await put("six.student", STUDENT);
    await six([{ ...course("PL3002", 0, 0), attendance: null }], weekly("PL3002", "2026-08-27T08:00:00", 15));
    expect(groups()).toEqual([["Belum ada hitungan SIX 1", ["PL3002"]]]);
    expect(words("PL3002")).toMatch(/^Sekitar \d× semester ini$/);
    expect(new Set(bar("PL3002")?.segments)).toEqual(new Set(["estimate"]));
  });

  it("in English", async () => {
    const s = await openPresence(undefined, true);
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(dayLine()).toBe("4 classes today. Only PL3002 has an absence to spare.");
    expect(groups().map(([heading]) => heading)).toEqual(["Can't reach 80% anymore 1", "No absences left 2", "Absences to spare 2"]);
    expect(words("DK4073")).toBe("2 used · none left");
    expect(words("PL3002")).toBe("1 used · 1 left");
    expect(words("II4091")).toBe("None used · 2 left");
    expect(words("KU5014")).toBe("4 used · 1 over the limit");
    expect(side("KU5014").Attendance).toBe("33% so far (2 of 6)");
    expect(card("DK4073")).toContain("Next class today, 11:00–12:59 · TVST C");
    expect(card("PL3002")).toContain("Tandai Hadir hasn't shown yet. The app checks SIX every 2 minutes.");
    expect(now()).toContain("If you can make only one, go to PL3032. It has no absences left, and KU5014 can't reach 80% anymore.");
    expect(bar("PL3002")?.label).toBe("Absences this term. 1 of 2 used, 1 left.");
    expect(document.querySelector("main header")?.textContent).toContain("Targets80%");
  });

  it("before SIX is connected: the way in on top, the courses without a count, nothing guessed", async () => {
    const s = await openPresence();
    expect(now()).toContain("Jatah absen dihitung dari SIX");
    expect(now()).toContain("Sebelum itu, aplikasi tak bisa memberi tahu saat Tandai Hadir muncul.");
    expect(dayLine()).toBe("");
    expect(groups()[0][0]).toBe("Mata kuliah 5");
    expect(document.querySelector("main [role=img]")).toBeNull();
    expect(s.text()).not.toMatch(/\bAbsent\b|Tidak hadir|Belum ada hitungan SIX/);
    // Nobody can say the open window counts: worth recording just in case, said calmly, its button quiet.
    expect(now()).toContain("tanpa SIX, belum pasti ini dihitung. Catat saja untuk berjaga-jaga.");
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
    expect(now()).not.toContain("Jatah absen dihitung dari SIX");
    expect(dayLine()).toBe("Hari ini ada 4 kuliah. Hanya PL3002 yang masih ada jatah absen.");
  });
});

describe("attendance in Settings", () => {
  it("the Presence and attendance alerts switch off, and the target is set there too", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    // The sidebar has a "Presensi" too: the switch in Settings.
    await screen.click(document.querySelector<HTMLElement>("[role=dialog] [role=switch][aria-label=Presensi]")!);
    await screen.click("Kehadiran");
    expect(screen.engine.snapshot().settings.mutedAlerts).toEqual(["presence", "attendanceRisk"]);
    expect(screen.text()).toContain("Target kehadiran");
    await screen.click("Turunkan target umum");
    expect(screen.engine.snapshot().settings.attendanceTarget).toBe(75);
  });
});

describe("a class on SIX's timetable the app can't read", () => {
  it("counts in the day's line, which says to check it on SIX", async () => {
    const world = new PretendWorld();
    world.six.moveMeeting("2153983", "11.00", "12.59");
    screen = await openApp({ world, signedIn: true, six: true });
    await screen.click(/^Presensi/);
    expect(document.querySelector("main header")?.textContent).toContain("Hari ini ada 4 kuliah. 1 kuliah belum terbaca. Cek di SIX.");
    // DK4073's own next class is that one, not next week's.
    const dk = [...document.querySelectorAll("main li")].find((li) => li.textContent?.includes("DK4073Komunikasi Pemasaran"));
    expect(dk?.textContent).toContain("Ada kuliah yang belum terbaca · Hari ini");
    expect(dk?.textContent).not.toContain("Berikutnya");
  });

  it("the course's page says it where its next meeting is, with SIX's timetable a click away", async () => {
    const world = new PretendWorld();
    world.six.moveMeeting("2153983", "11.00", "12.59");
    screen = await openApp({ world, signedIn: true, six: true });
    await screen.click(/^DK4073/);
    expect(document.querySelector("main")?.textContent).toContain("Ada kuliah yang belum terbaca · Hari ini");
    expect(screen.has("Buka jadwal di SIX")).toBe(true);
  });
});
