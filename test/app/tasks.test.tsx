// @vitest-environment jsdom
// v2-04 (#72), seam 2: Tugas & Ujian and the Task page as the Student sees
// them, with the real engine and the pretend Edunex behind the bridge.
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const open = async (now?: string) => {
  screen = await openApp({ signedIn: true, world: new PretendWorld({ now }) });
  return screen;
};
// The groups of the one list (or of Done), each with its count.
const sections = () => [...document.querySelectorAll("main section h2")].map((h) => h.textContent!);
const rows = () => [...document.querySelectorAll<HTMLButtonElement>("main li > button")];
const row = (title: string) => rows().find((b) => b.textContent?.startsWith(title));
// A take-home is its exam's row: the exam's tag and course, then "Take-home · its title".
const takeHomeRow = (title: string) => rows().find((b) => /Take-home · /.test(b.textContent ?? "") && b.textContent?.includes(title));
const dateOf = (button: HTMLElement | undefined) => button?.querySelector(".w-\\[136px\\]");
const card = () => document.querySelector("main aside")?.textContent ?? "";
const goToTask = async (s: NonNullable<typeof screen>, title: string) => {
  await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
  const find = () => row(title) ?? takeHomeRow(title);
  if (!find()) await s.click(/^Selesai/);
  if (!find()) await s.click(/^Belum selesai/);
  const target = find();
  if (!target) throw new Error(`No Task row ${title}`);
  await s.click(target);
};

describe("Tugas & Ujian", () => {
  it("lists every Task to hand in by when it's due, with its course, module and true status", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    // The counts sit in the segments; no subtitle repeats them.
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 5");
    expect(s.button(/^Selesai/).textContent).toBe("Selesai 5");
    // Without SIX or ITB's calendar yet, PL3032's UTS and UAS (named only in its outline) have no date: listed last, not counted.
    expect(sections()).toEqual(["Minggu depan 1", "Nanti 4", "Belum ada tanggal"]);
    const bab2 = row("Tugas 02 Bab II")!.textContent;
    expect(bab2).toContain("II4091 · Modul 5 · Tugas");
    expect(bab2).toContain("Belum dikerjakan");
    expect(bab2).toContain("Jum, 16 Okt, 23:59");
    // The late rule and edits before handing in belong on the Task page, not on every row.
    expect(bab2).not.toContain("Boleh terlambat");
    expect(bab2).not.toContain("Diubah dosen");
    // The take-home UTS is its exam's: one row, with the exam's tag, at its deadline; never also a plain Task.
    expect(row("UTS Markom")).toBeUndefined();
    expect(takeHomeRow("UTS Markom")!.textContent).toBe("UTSMarketing CommunicationDK4073 · Take-home · UTS MarkomKam, 22 Okt, 23:50dalam 14 hari");
    // No footnote explains take-homes any more: the row says it.
    expect(s.text()).not.toContain("Take-home: tugas Edunex");
  });

  it("a long Task title wraps rather than being cut, and shows whole on hover", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    // The Tasks' titles (an exam's is its tag and course).
    const titles = [...document.querySelectorAll<HTMLElement>("main section li button .line-clamp-2")].filter((title) => !title.querySelector(".rounded-tag"));
    expect(titles.length).toBe(4);
    for (const title of titles) {
      expect(title.className).not.toContain("truncate");
      expect(title.title).toBe(title.textContent);
    }
  });

  it("filters by course, and hides the groups a course has nothing in", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    await s.click("PL3002");
    expect(row("Tugas Mandiri Individu")).toBeDefined();
    expect(row("Tugas 02 Bab II")).toBeUndefined();
    expect(sections()).toEqual(["Nanti 1"]);
    expect(document.querySelector("[aria-labelledby=tasks-exams]")).toBeNull();
    // The choice stays while the app runs.
    await s.click(/^Beranda/);
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(row("Tugas 02 Bab II")).toBeUndefined();
    await s.click("Semua");
    expect(row("Tugas 02 Bab II")).toBeDefined();
  });

  it('a long title may wrap after a "/" instead of mid-word, and shows whole on hover', async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    const title = row("Tugas Mandiri Individu")!.querySelector("[title]")!;
    expect(title.getAttribute("title")).toBe("Tugas Mandiri Individu tentang Projek Penciptaan/Pengembangan Inovasi Kampus Ganesha");
    expect(title.innerHTML).toContain("Penciptaan/<wbr>Pengembangan");
  });

  it("the course filter is one radio group: a single Tab stop, arrows move the pick, a second click keeps it", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    const group = document.querySelector<HTMLElement>("[role=radiogroup][aria-label='Mata kuliah']")!;
    const chips = () => [...group.querySelectorAll<HTMLButtonElement>("[role=radio]")];
    const checked = () => chips().find((chip) => chip.getAttribute("aria-checked") === "true")?.textContent;
    expect(checked()).toBe("Semua");
    expect(
      chips()
        .filter((chip) => chip.tabIndex === 0)
        .map((chip) => chip.textContent),
    ).toEqual(["Semua"]);
    chips()[0].focus();
    await s.key("ArrowRight");
    const first = chips()[1].textContent!;
    expect(checked()).toBe(first);
    expect(document.activeElement).toBe(chips()[1]);
    expect(chips().filter((chip) => chip.tabIndex === 0)).toEqual([chips()[1]]);
    await s.key("ArrowLeft");
    expect(checked()).toBe("Semua");
    // Wraps around from the first to the last.
    await s.key("ArrowLeft");
    expect(checked()).toBe(chips().at(-1)!.textContent);
    // Clicking the picked course keeps it picked.
    await s.click("PL3002");
    await s.click("PL3002");
    expect(checked()).toBe("PL3002");
    expect(row("Tugas 02 Bab II")).toBeUndefined();
  });

  it("shows what was handed in, loudly when the lecturer changed it afterwards, and a short window", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    await s.click(/^Selesai/);
    expect(sections()).toEqual(["Terkumpul 5"]);
    expect(row("Tugas 01 Bab I")!.textContent).toContain("Diubah setelah kamu kumpulkan (22 Sep) · cek lagi");
    expect(row("Tugas 01 Bab I")!.textContent).toContain("Dikumpulkan");
    expect(row("Tugas 01 Bab I")!.textContent).toContain("Terkumpul");
    expect(row("Tugas Problem Soving")!.textContent).toContain("Waktu singkat · 16:01–19:01");
  });

  it("a Task whose hand-in is the class's attendance says so, with the Presence window, in the list and on its page", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    // II4091's Presence on Friday is set to Answer Assignment: handing in Tugas 02 inside 15:00–23:59 is the attendance.
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Juga presensi: Jum, 16 Okt 15:00–23:59");
    expect(row("Tugas Mandiri Individu")!.textContent).not.toContain("presensi");
    await s.click(row("Tugas 02 Bab II")!);
    // How the app knows: the lecturer linked the Task to that class's Edunex Presence.
    expect(s.text()).toContain(
      "Tugas ini sekaligus Presensi-mu. Kamu hanya terhitung hadir jika mengumpulkannya di dalam jendelanya, Jum, 16 Okt, 15:00–23:59.",
    );
  });

  it("where the course counts in SIX, the Task's attendance window is optional: said so in the list and on its page, never pushed", async () => {
    // PL3002 counts in SIX (6 of 7); its lecturer ties Thursday's Edunex window to Tugas Mandiri Individu anyway.
    const world = new PretendWorld({ now: "2026-10-12T20:00:00+07:00" });
    world.edunex.schedulePresence(95001, 86778, {
      start: "2026-10-15T08:00:00+07:00",
      end: "2026-10-15T23:59:00+07:00",
      patch: { presentable: [{ presentable: "assignment", presentable_id: "117873" }] },
    });
    screen = await openApp({ signedIn: true, six: true, world });
    const s = screen;
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(row("Tugas Mandiri Individu")!.textContent).toContain("Juga Presensi Edunex, tidak wajib: Kam, 15 Okt 08:00–23:59");
    await s.click(row("Tugas Mandiri Individu")!);
    expect(s.text()).toContain(
      "Mengumpulkan tugas ini pada Kam, 15 Okt, 08:00–23:59 juga mengisi Presensi Edunex. Tidak wajib, karena kehadiran PL3002 dihitung di SIX.",
    );
    expect(s.text()).not.toContain("hanya terhitung jika dikumpulkan");
    // Nothing nudges the Student to wait for the window: Kumpulkan stays the main button once there's a file.
    s.willPick([{ name: "Projek Inovasi.pdf" }]);
    await s.click(/^Lampirkan berkas · Lepas berkas di sini/);
    expect(s.button("Kumpulkan").className).toContain("bg-accent");
    expect(card()).not.toContain("jendela presensi");
  });

  it("counts the Tasks to hand in next to Tugas & Ujian in the sidebar", async () => {
    const s = await open();
    expect(s.button(/^Tugas & Ujian\d+$/).textContent).toBe("Tugas & Ujian5");
    s.world.edunex.submitOnWebsite(117003);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.button(/^Tugas & Ujian\d+$/).textContent).toBe("Tugas & Ujian4");
  });

  it("a new Task appears, and one submitted on the website moves to Selesai", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    s.world.edunex.postTask(95059, { name: "Tugas 1 Infrastruktur" });
    s.world.edunex.submitOnWebsite(117873);
    await s.wait(16 * 60_000);
    expect(row("Tugas 1 Infrastruktur")!.textContent).toContain("PL3032");
    expect(row("Tugas Mandiri Individu")).toBeUndefined();
    await s.click(/^Selesai/);
    expect(row("Tugas Mandiri Individu")!.textContent).toContain("Terkumpul");
  });

  it("past a deadline: overdue first when late answers are allowed; a closed Task under Selesai", async () => {
    const s = await open("2026-10-23T08:00:00+07:00");
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(sections().slice(0, 3)).toEqual(["Terlambat 1", "Minggu depan 1", "Nanti 2"]);
    // Under "Terlambat" the heading says it's late: no chip on the row, which says it's still taken instead.
    expect(row("Tugas 02 Bab II")!.textContent).not.toContain("Terlambat");
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Lewat tenggat, masih diterima");
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 4");
    expect(s.button(/^Selesai/).textContent).toBe("Selesai 6");
    await s.click(/^Selesai/);
    expect(sections()).toEqual(["Terkumpul 5", "Ditutup, tidak dikumpulkan 1"]);
    // The take-home keeps its exam's look in Done.
    expect(takeHomeRow("UTS Markom")!.textContent).toContain("UTSMarketing Communication");
    expect(takeHomeRow("UTS Markom")!.textContent).toContain("Tidak dikumpulkan");
  });

  it("speaks English", async () => {
    const s = await open();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await s.click(/^Tasks & Exams\d*$/);
    expect(s.button(/^To do/).textContent).toBe("To do 5");
    expect(sections()).toEqual(["Next week 1", "Later 4", "No date yet"]);
    expect(takeHomeRow("UTS Markom")!.textContent).toBe("UTSMarketing CommunicationDK4073 · Take-home · UTS MarkomThu, 22 Oct, 23:50in 14 days");
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Fri, 16 Oct, 23:59");
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Also your attendance: Fri, 16 Oct 15:00–23:59");
  });

  it("one list in order: an exam sits among the Tasks at its moment, and no Exams section sits on top", async () => {
    // With SIX: DK4073's UTS in class on 15 Oct, its take-home due 22 Oct; PL3032's UTS and UAS have only their weeks.
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(document.querySelector("#tasks-exams")).toBeNull();
    expect(sections()).toEqual(["Minggu depan 2", "Nanti 4"]);
    const order = rows().map((b) => b.textContent ?? "");
    // The UTS week is a quiet line where it falls (Monday 12 Oct), open within two weeks; then the sitting, Tugas 02, the take-home.
    expect(order[0]).toBe("Masa UTSHari ujian PL3032 belum diumumkan12–16 Oktdalam 4 hari");
    expect(order[1]).toBe("UTSEkonomi Infrastruktur dan TransportasiPL3032 · Hari dan jamnya belum diumumkan");
    // A sitting's date column is its day over its time range: be there.
    expect(order[2]).toBe("UTSKomunikasi PemasaranDK4073 · Di kelas · TVST CKam, 15 Okt11:00–12:59");
    expect(order[3]).toMatch(/^Tugas 02 Bab II/);
    expect(order[4]).toMatch(/^UTSKomunikasi PemasaranDK4073 · Take-home · UTS Markom/);
    // The UAS is far off: its line is closed, at its place at the end.
    expect(order.at(-1)).toBe("Masa UASHari ujian PL3032 belum diumumkan7–22 Desdalam 60 hari");
    expect(rows().at(-1)!.getAttribute("aria-expanded")).toBe("false");
    // One count everywhere: the segment and the sidebar count Tasks, take-homes and exams with a day, never a period.
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 6");
    expect(s.button(/^Tugas & Ujian\d+/).textContent).toBe("Tugas & Ujian6");
  });

  it("the course chip filters the list and its counts; a course with nothing to do says so, with Show all", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    await s.click("DK4073");
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 2");
    expect(sections()).toEqual(["Minggu depan 1", "Nanti 1"]);
    // The sidebar keeps counting everything.
    expect(s.button(/^Tugas & Ujian\d+/).textContent).toBe("Tugas & Ujian6");
    await s.click("PL3032");
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 0");
    expect(s.text()).toContain("Tidak ada yang perlu dikerjakan di PL3032");
    // What's still to know comes under it: PL3032's exam periods.
    expect(rows().map((b) => b.textContent?.slice(0, 8))).toEqual(["Masa UTS", "UTSEkono", "Masa UAS"]);
    await s.click("Tampilkan semua");
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 6");
  });

  it("the date column: amber within a day, red only once late, and no second line that only repeats the day", async () => {
    const s = await open("2026-10-22T14:10:00+07:00");
    s.world.edunex.postTask(95059, { name: "Tugas Besok Siang", end_at: "2026-10-23T12:00:00+07:00" });
    s.world.edunex.postTask(95059, { name: "Tugas Besok Malam", end_at: "2026-10-23T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    // Late: red, under Terlambat.
    expect(dateOf(row("Tugas 02 Bab II"))?.className).toContain("text-danger-fg");
    // Due tonight, the take-home: amber, never red.
    expect(dateOf(takeHomeRow("UTS Markom"))?.className).toContain("text-warning-fg");
    expect(dateOf(takeHomeRow("UTS Markom"))?.className).not.toContain("text-danger-fg");
    expect(dateOf(row("Tugas Besok Siang"))?.textContent).toBe("Besok, 12:00dalam 22 jam");
    expect(dateOf(row("Tugas Besok Siang"))?.className).toContain("text-warning-fg");
    // More than a day away, "besok" would only say the day again.
    expect(dateOf(row("Tugas Besok Malam"))?.textContent).toBe("Besok, 23:59");
    expect(dateOf(row("Tugas Besok Malam"))?.className).not.toContain("text-warning-fg");
  });

  it("an exam period with no day yet: one line, closed while far, open within two weeks, on top while it's on", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-22T14:10:00+07:00" }), signedIn: true, six: true });
    let s = screen;
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    const period = () => rows().find((b) => b.textContent?.startsWith("Masa UAS"))!;
    expect(period().getAttribute("aria-expanded")).toBe("false");
    await s.click(period());
    expect(period().getAttribute("aria-expanded")).toBe("true");
    const exam = rows().find((b) => b.textContent?.startsWith("UASEkonomi Infrastruktur"))!;
    await s.click(exam);
    expect(document.querySelector("main h1")?.textContent).toBe("Ekonomi Infrastruktur dan Transportasi");
    s.close();

    // In UAS weeks: the period's line comes first, open, saying until when.
    screen = await openApp({ world: new PretendWorld({ now: "2026-12-10T10:00:00+07:00" }), signedIn: true, six: true });
    s = screen;
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(rows()[0].textContent).toBe("Masa UASHari ujian PL3032 belum diumumkansampai 22 Desdalam 12 hari");
    expect(rows()[0].getAttribute("aria-expanded")).toBe("true");
    expect(sections()[0]).toBe("Terlambat 3");
  });

  it("Done: past exams newest first, and a take-home once, with the Tasks handed in", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-22T14:10:00+07:00" }), signedIn: true, six: true });
    const s = screen;
    s.world.edunex.submitOnWebsite(117764);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    // Sat in class and handed in: nothing of DK4073's UTS is left to do.
    expect(rows().some((b) => b.textContent?.includes("DK4073"))).toBe(false);
    await s.click(/^Selesai/);
    expect(sections()).toEqual(["Terkumpul 6", "Ujian yang sudah lewat 2"]);
    expect(takeHomeRow("UTS Markom")!.textContent).toMatch(/^UTSKomunikasi PemasaranDK4073 · Take-home · UTS Markom/);
    const past = [...document.querySelectorAll("main section")].find((section) =>
      section.querySelector("h2")?.textContent?.startsWith("Ujian yang sudah lewat"),
    )!;
    expect([...past.querySelectorAll("li > button")].map((b) => b.textContent)).toEqual([
      "UTSKomunikasi PemasaranDK4073 · Di kelas · TVST CKam, 15 Okt11:00–12:59",
      "UTSEkonomi Infrastruktur dan TransportasiPL3032 · Harinya tidak pernah diumumkan12–16 OktMasa UTS",
    ]);
    // The past exam's row doesn't repeat its take-home.
    expect(past.textContent).not.toContain("UTS Markom");
  });

  it("before the first Task list arrives, and when it can't: placeholders, then a way to try again", async () => {
    const world = new PretendWorld();
    world.edunex.fail(/^\/course\/tasks$/, 503);
    screen = await openApp({ signedIn: true, world });
    await screen.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    expect(screen.text()).toContain("Tugas belum bisa dimuat");
    world.edunex.clearFaults();
    await screen.click("Coba lagi");
    expect(row("Tugas 02 Bab II")).toBeDefined();
  });
});

describe("putting off a late Task", () => {
  /** 22 Oct, with a PL3032 Task that was due on Tuesday and is still taken late. */
  async function withLateTask() {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-22T14:10:00+07:00" }), signedIn: true, six: true });
    const s = screen;
    s.world.edunex.postTask(95059, { name: "Ringkasan K5", start_at: "2026-10-13T08:00:00+07:00", end_at: "2026-10-20T23:59:00+07:00", is_lateable: 1 });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await s.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    return s;
  }
  const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((item) => item.textContent ?? "");
  const toastText = () => document.querySelector("[aria-live=polite]")?.textContent ?? "";
  const lateSection = () => [...document.querySelectorAll("main section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Terlambat"));

  it("offers Beranda's moments on a late row, takes it out of To do and its counts, and says what's put off", async () => {
    const s = await withLateTask();
    expect(sections()[0]).toBe("Terlambat 2");
    const todo = Number(s.button(/^Belum selesai/).textContent?.match(/\d+/)?.[0]);
    const badge = Number(s.button(/^Tugas & Ujian\d+/).textContent?.match(/\d+/)?.[0]);
    // Only the late rows can be put off.
    expect(s.has("Ingatkan nanti: Tugas 02 Bab II")).toBe(true);
    expect(s.has(/^Ingatkan nanti: UTS Markom/)).toBe(false);
    await s.click("Ingatkan nanti: Ringkasan K5");
    // A late Task's moments, as on Beranda: in three hours or tomorrow morning.
    expect(menuItems()).toEqual([expect.stringMatching(/^3 jam lagiHari ini, 17:1\d$/), "Besok pagiBesok, 07:00"]);
    await s.click([...document.querySelectorAll<HTMLElement>("[role=menuitem]")][1]!);
    expect(row("Ringkasan K5")).toBeUndefined();
    expect(toastText()).toContain("Diingatkan lagi Besok, 07:00");
    expect(sections()[0]).toBe("Terlambat 1");
    expect(Number(s.button(/^Belum selesai/).textContent?.match(/\d+/)?.[0])).toBe(todo - 1);
    expect(Number(s.button(/^Tugas & Ujian\d+/).textContent?.match(/\d+/)?.[0])).toBe(badge - 1);
    // The same snooze Beranda keeps.
    expect(s.store.dataset("local.snoozes")?.value).toEqual([expect.objectContaining({ id: expect.stringMatching(/^task:\d+$/), reason: "morning" })]);
    expect(lateSection()?.textContent).toContain("1 ditunda · Tampilkan");

    // The way back: the list of what's put off, each with Ingatkan sekarang.
    await s.click("Tampilkan");
    expect(lateSection()?.textContent).toContain("Ringkasan K5PL3032 · Kembali Besok, 07:00");
    await s.click("Ingatkan sekarang: Ringkasan K5");
    expect(row("Ringkasan K5")).toBeDefined();
    expect(lateSection()?.textContent).not.toContain("ditunda");
    expect(sections()[0]).toBe("Terlambat 2");
  });

  it("is the same snooze as Beranda's: put off here, it's put off there too", async () => {
    const s = await withLateTask();
    await s.click("Ingatkan nanti: Ringkasan K5");
    await s.click([...document.querySelectorAll<HTMLElement>("[role=menuitem]")][1]!);
    await s.click(/^Beranda/);
    const needs = document.querySelector('main section[aria-labelledby="home-needs"]');
    expect([...(needs?.querySelectorAll("li") ?? [])].some((li) => li.textContent?.includes("Ringkasan K5"))).toBe(false);
    expect(needs?.textContent).toContain("1 ditunda");
  });

  it("with every late row put off, Terlambat says so instead of disappearing, and nothing claims all is done", async () => {
    const s = await withLateTask();
    await s.click("Ingatkan nanti: Ringkasan K5");
    await s.click([...document.querySelectorAll<HTMLElement>("[role=menuitem]")][1]!);
    await s.click("Ingatkan nanti: Tugas 02 Bab II");
    await s.click([...document.querySelectorAll<HTMLElement>("[role=menuitem]")][1]!);
    expect(sections()[0]).toBe("Terlambat");
    expect(lateSection()?.textContent).toContain("2 ditunda · Tampilkan");
    expect(s.text()).not.toContain("Tidak ada yang perlu dikerjakan");
  });
});

describe("the Task page", () => {
  it("shows the instructions, the lecturer's files to download, the rules and the history", async () => {
    const s = await open();
    await goToTask(s, "UTS Markom");
    expect(document.querySelector("h1")?.textContent).toBe("UTS Markom");
    expect(s.text()).toContain("DK4073Modul 1 · UTS Markom");
    expect(s.text()).toContain("Tenggat Kam, 22 Okt, 23:50");
    expect(s.text()).toContain("Soal lihat .pdf");
    expect(s.text()).toContain("Berkas dari dosen");
    // A PDF opens in the viewer. Here the file isn't on the pretend storage, so the way forward is the Task's page on Edunex.
    await s.click("Lihat UTS MARKOM SEM 1 2026 2027.pdf");
    expect(s.calls.at(-1)).toEqual({ name: "files.read", input: { url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-8", as: "pdf" } });
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Berkas ini sudah tidak ada di Edunex.");
    await s.click("Buka di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117764" } });
    await s.key("Escape");
    expect(document.querySelector("[role=dialog]")).toBeNull();
    // The rules sit where they matter: the file rule in the drop zone, the late rule by the deadline.
    expect(card()).toContain("Wajib unggah berkas");
    expect(document.querySelector("article")?.textContent).toContain("Tidak bisa terlambat");
    // The exam it's part of, and how the app knows.
    expect(s.text()).toContain("Bagian dari UTS DK4073 · Edunex menandainya UTS");
    const history = [...document.querySelectorAll("main aside ol li")].map((li) => li.textContent);
    // Edited before the app had a copy to compare: History says what changed isn't known.
    expect(history).toEqual(["Diunggah dosenKam, 17 Sep, 08:45", "Diubah dosenKam, 24 Sep, 11:11Perubahannya tidak diketahui", "TenggatKam, 22 Okt, 23:50"]);
    // An edit before the Student handed in that nobody can describe is history, not a warning.
    expect(s.text()).not.toContain("Dosen mengubah tugas ini");
    await s.click("Buka di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117764" } });
  });

  it("a take-home known by its name says so: Edunex files it as a plain Task", async () => {
    const s = await open();
    s.world.edunex.postTask(95059, { name: "Midex Esai Transportasi", domain: "task", end_at: "2026-10-16T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Midex Esai Transportasi");
    expect(s.text()).toContain("Bagian dari UTS PL3032 · Namanya diawali “Midex”");
  });

  it("formats the lecturer's instructions safely: no script or markup of Edunex's reaches the page", async () => {
    const s = await open();
    s.world.edunex.editTask(117003, {
      description:
        '<p>Kerjakan <strong>Bab II</strong>.</p><script>window.hacked = true</script><img src=x onerror="window.hacked = true"><a href="javascript:alert(1)">tautan</a>',
    });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 02 Bab II");
    const article = document.querySelector("article")!;
    expect(article.textContent).toContain("Kerjakan Bab II.");
    expect(article.querySelector("strong")?.textContent).toBe("Bab II");
    expect(article.querySelector("script, img, [onerror], a[href^=javascript]")).toBeNull();
    expect((window as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it("not started: due when, the attach area, and nothing to submit yet", async () => {
    const s = await open();
    await goToTask(s, "Tugas 02 Bab II");
    // The status is the card's plain first line; the deadline is said once, in the header, as one line of facts.
    expect(card()).toContain("Belum dikerjakanJawabanmu");
    expect(card()).not.toContain("dalam 8 hari");
    expect(document.querySelector("article")?.textContent).toContain("Tenggat Jum, 16 Okt, 23:59 · dalam 8 hari · Boleh terlambat");
    // When it opened is history (Riwayat), not a fact for the header.
    expect(document.querySelector("article")?.textContent).not.toContain("Dibuka");
    expect(s.has(/^Lampirkan berkas · Lepas berkas di sini/)).toBe(true);
    expect(card()).toContain("Wajib unggah berkas · Berkas PDF");
    expect(s.button("Simpan draf").disabled).toBe(true);
    expect(s.button("Kumpulkan").disabled).toBe(true);
    // A disabled Kumpulkan says why.
    expect(card()).toContain("Tulis jawabanmu dulu. Edunex butuh teks, meski kamu melampirkan berkas.");
    expect(card()).toContain("Dosen bisa melihat draf yang tersimpan, tapi hanya Kumpulkan yang menyerahkannya.");
    expect(document.querySelector("article")?.textContent).toContain("Boleh terlambat");
  });

  it("draft: not handed in yet, the draft's files listed, ready to submit", async () => {
    const s = await open();
    s.world.edunex.draftOnWebsite(117003, "bab2-draf.pdf");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 02 Bab II");
    expect(card()).toContain("DrafTersimpan Hari ini, 08:12 · belum diserahkan");
    expect(card()).toContain("bab2-draf.pdf");
    expect(s.button("Kumpulkan").disabled).toBe(false);
    expect(card()).toContain("Dosen bisa melihat draf yang tersimpan");
    const history = [...document.querySelectorAll("main aside ol li")].map((li) => li.textContent);
    expect(history).toContain("Kamu menyimpan drafHari ini, 08:12");
  });

  it("submitted: the receipt from Edunex, the file to download, final", async () => {
    const s = await open();
    await goToTask(s, "Tugas tentang Imfact on Innovation");
    expect(card()).toContain("TerkumpulEdunex mencatatnya Rab, 16 Sep, 15:29");
    expect(card()).toContain("Sudah diserahkan. Pengumpulan bersifat final.");
    expect(s.has(/^Lampirkan berkas/)).toBe(false);
    expect(s.has("Kumpulkan")).toBe(false);
    await s.click("Unduh TUGAS IMPACT ON INNOVATION THE ECONOMY - 18223901.pdf");
    expect(s.calls.at(-1)?.name).toBe("files.download");
    // Edunex never told the Student about this edit, and the app had no copy from before it.
    expect(s.text()).toContain("Dosen mengubah tugas ini pada 8 Okt, setelah kamu mengumpulkan pada 16 Sep.");
    expect(s.text()).toContain("Versi sebelumnya tidak diketahui, jadi aplikasi tidak bisa menunjukkan apa yang berubah.");
    await s.click("Buka di Edunex");
    expect(s.calls.at(-1)?.name).toBe("shell.openExternal");
  });

  it("overdue: late answers still taken, with Submit late", async () => {
    const s = await open("2026-10-17T08:00:00+07:00");
    await goToTask(s, "Tugas 02 Bab II");
    expect(card()).toContain("TerlambatMasih bisa dikumpulkan terlambat");
    expect(s.has("Kumpulkan terlambat")).toBe(true);
    expect(s.text()).toContain("Tenggat Kemarin, 23:59");
  });

  it("closed: nothing to hand in any more", async () => {
    const s = await open();
    s.world.edunex.closeTask(117010);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 03 Bab III");
    expect(card()).toContain("DitutupPengumpulan sudah ditutup");
    expect(card()).toContain("Tidak ada berkas yang dikumpulkan.");
    expect(s.has(/^Lampirkan berkas/)).toBe(false);
    expect(s.has("Simpan draf")).toBe(false);
  });

  it("in review, then the score once the lecturer shows it", async () => {
    const s = await open();
    s.world.edunex.reviewAnswer(117001);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 01 Bab I");
    expect(card()).toContain("Sedang dinilai");
    expect(card()).toContain("Nilai-");
    expect(card()).toContain("Dosen sedang menilai tugas ini.");
    s.world.edunex.publishScore(117001, 88);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(card()).toContain("Terkumpul");
    expect(card()).toContain("Nilai88");
  });

  it("an extended deadline shows at once, with the edit", async () => {
    const s = await open();
    await goToTask(s, "Tugas 02 Bab II");
    await s.wait(3 * 3_600_000);
    s.world.edunex.moveDeadline(117003, "2026-10-20T23:59:00+07:00");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).toContain("Tenggat Sel, 20 Okt, 23:59");
    expect([...document.querySelectorAll("main aside ol li")].map((li) => li.textContent)).toContain("Diubah dosenHari ini, 11:12");
  });

  it("a short answer window says how short", async () => {
    const s = await open();
    await goToTask(s, "Tugas Problem Soving");
    expect(s.text()).toContain("Hanya dibuka 3 jam (16:01–19:01).");
  });

  it("a Task that isn't open yet says from when", async () => {
    const s = await open();
    const id = s.world.edunex.postTask(95059, { name: "Tugas Pekan Depan", start_at: "2026-10-12T08:00:00+07:00", end_at: "2026-10-19T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas Pekan Depan");
    expect(id).toBeGreaterThan(0);
    // Said once in the header and once where the hand-in would be, not again as the card's subtitle.
    expect(document.querySelector("article")?.textContent).toContain(
      "Tenggat Sen, 19 Okt, 23:59 · dalam 11 hari · Tidak bisa terlambat · Dibuka Sen, 12 Okt, 08:00",
    );
    expect(card()).not.toContain("Dibuka");
    expect(card()).toContain("Bisa dikumpulkan mulai Sen, 12 Okt, 08:00.");
    expect(s.has(/^Lampirkan berkas/)).toBe(false);
  });

  it("a Task removed from Edunex says so, with the way back", async () => {
    const s = await open();
    await goToTask(s, "Tugas 03 Bab III");
    s.world.edunex.tasks.set(
      95326,
      s.world.edunex.tasks.get(95326)!.filter((t) => Number(t.id) !== 117010),
    );
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).toContain("Tugas ini tidak ditemukan");
    await s.click("Ke Tugas & Ujian");
    expect(s.text()).toContain("Belum selesai");
  });
});
