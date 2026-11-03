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
/** The info buttons' names in a section: each status's why, said on demand. */
const whys = (id: string) =>
  [...(section(id)?.querySelectorAll("button[aria-label]") ?? [])]
    .map((b) => b.getAttribute("aria-label") ?? "")
    .filter((label) => /^(Penjelasan|About this): /.test(label))
    .map((label) => label.replace(/^(Penjelasan|About this): /, ""));

describe("Beranda on the recorded Thursday morning", () => {
  it("answers first: the class going on, where attendance counts and what to do, without contradicting itself", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const now = text("home-now");
    // The end is in the time column: the eyebrow says only that it's on.
    expect(now).toContain("Sedang berlangsung");
    expect(now).not.toContain("sampai 10:00");
    expect(now).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    // The time stands in its own block, where a colored stripe used to be; the course's color is its dot.
    expect(now).toContain("08:0010:00");
    expect(now).toContain("PL3002 · R.SG PWK LT.6");
    const colored = [...(section("home-now")?.querySelectorAll<HTMLElement>("[style*='background']") ?? [])];
    expect(colored.length).toBeGreaterThan(0);
    expect(colored.every((el) => el.classList.contains("size-2"))).toBe(true);
    // On the line of facts, in two words; the usual time is in its tooltip, and in its name.
    expect(now).toContain("PL3002 · R.SG PWK LT.6 · Jam berubah");
    expect(now).not.toContain("biasanya");
    // A fact, not something to do now: in the quiet color, not amber.
    const moved = screen.button("Jam berubah. Biasanya 08:00–09:30.");
    expect(moved.className).toContain("text-muted");
    expect(section("home-now")?.querySelector(".text-warning-fg")).toBeNull();
    // SIX counts PL3002: SIX's "Tandai Hadir" comes first, and the app is watching for it. Edunex's open window is to do too,
    // one line each, with its button; how each is done is a button away. The absences are the course list's, not the card's.
    expect(now).toContain("Tandai Hadir · belum muncul");
    expect(now).toContain("Isi Presensi · tutup 09:30");
    expect(now.indexOf("Isi Presensi")).toBeGreaterThan(now.indexOf("Tandai Hadir"));
    expect(whys("home-now")).toEqual([
      "Tekan Tandai Hadir di SIX saat tombolnya muncul. Aplikasi memeriksa tiap 2 menit.",
      "Buka mata kuliahnya di Edunex sebelum 09:30.",
    ]);
    expect(now).not.toContain("Kehadiran 85%");
    expect(now).not.toContain("Sisa jatah absen");
    // Not a tick: nothing says the Student is marked present yet.
    expect(section("home-now")?.textContent).not.toMatch(/tercatat hadir|sudah hadir/);
    expect(screen.button("Buka di SIX untuk Tandai Hadir di PL3002").textContent).toBe("Buka di SIX");
    expect(screen.button("Buka di SIX untuk Tandai Hadir di PL3002").className).not.toContain("bg-accent");
    // No system says the lecturer doesn't use Edunex's: never "optional".
    expect(now).not.toContain("tidak wajib");
    expect(now).not.toContain("Catat kehadiran");
    // 6 of 7: the UTS-week lecture on 15 Oct may not run, so it buys no absence (#85: never one too many).
    expect(now).not.toContain("sisa 2×");
    // What comes after is Hari ini's first row, right under the card: not said on the card too.
    expect(now).not.toContain("Setelah ini");
    // SIX's button hasn't shown yet and Edunex's window closes first: Edunex's is the one blue button.
    // Named as the course page and Presensi name it, the visible words first in its name.
    expect(screen.button("Catat di Edunex: Presensi PL3002").textContent).toBe("Catat di Edunex");
    expect(screen.button("Catat di Edunex: Presensi PL3002").className).toContain("bg-accent");
    await screen.click("Catat di Edunex: Presensi PL3002");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
    // The exam week from ITB's calendar is a calm line beside the greeting, not a tag: how soon, the day in its tooltip and name.
    // No date or term: the system shows the date, the term is the sidebar's. The greeting is a quiet line, not a big title.
    expect(document.querySelector("main header")?.textContent).toBe("Selamat pagi, DimasUTS 4 hari lagi");
    await screen.click("UTS 4 hari lagi. Masa UTS mulai Senin, 12 Okt");
    expect(document.querySelector("main h1")?.textContent).toBe("Jadwal");
    await screen.click("Beranda");
    expect(document.querySelector("main h1")?.textContent).toBe("Selamat pagi, Dimas");
    expect(document.querySelector("main h1")?.className).not.toContain("text-display");
    // This term's courses: plain rows (code, name, the absence bar and its one word), not a grid of cards.
    // Class and SKS are the course page's; "Jatah absen" is said once, over the bars.
    const courses = section("home-courses");
    expect(courses?.querySelectorAll("ul > li")).toHaveLength(5);
    expect(row("home-courses", "DK4073")).toBe("DK4073Komunikasi Pemasaranhabis");
    expect(row("home-courses", "KU5014")).toBe("KU5014Teknik Penyelesaian Masalah Terstrukturlewat batas 1×");
    expect(text("home-courses").match(/Jatah absen/g)).toHaveLength(1);
    expect(courses?.querySelector("[role=img]")?.getAttribute("aria-label")).toBe("Jatah absen semester ini 2×. Semua sudah terpakai.");
    expect(courses?.querySelector("ul")?.className).toContain("border-0");
    expect(tags()).toEqual([]);
  });

  it("Perlu perhatianmu doesn't repeat today: today's classes and their risk are in Hari ini, a target out of reach too; the other days, here, one click from Presensi", async () => {
    screen = await openApp({ signedIn: true, six: true });
    // KU5014 meets at 16:00: its row in Hari ini says it can't reach 80%, so it isn't said here again.
    expect(document.querySelector('main h2[id="home-needs"]')?.textContent).toBe("Perlu perhatianmu 1");
    expect(rows("home-needs").some((r) => r.includes("KU5014"))).toBe(false);
    // DK4073's UTS is next Thursday at 11:00, seven days ahead: the week counts whole days, so it's in.
    expect(rows("home-needs")[0]).toMatch(/^UTS Komunikasi Pemasaran/);
    screen.close();

    // The next day KU5014 doesn't meet: the warning is here, short, what to do a button away.
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-09T09:00:00+07:00" }), signedIn: true, six: true });
    expect(row("home-needs", "KU5014")).toBe("KU5014: tak bisa lagi capai 80%Paling tinggi 71%");
    expect(whys("home-needs")).toContain("Cek ke dosen kalau ada yang terlewat.");
    await screen.click(/^KU5014: tak bisa lagi capai 80%/);
    expect(document.querySelector("h1")?.textContent).toBe("Presensi");
  });

  it("today: SIX's classes with time and room, absences left, the moved class, the overlap, and tomorrow's online meeting; rows open their course", async () => {
    screen = await openApp({ signedIn: true, six: true });
    // The class on now is the card above: the day goes on from the next one, never listing it twice.
    expect(row("home-today", "08:00")).toBe("");
    expect(text("home-today")).not.toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(text("home-now")).toContain("Jam berubah");
    // Three hours off: the time column says when, no "dalam 3 jam" beside it. No absences left, framed as what to do;
    // the why is the row's info button.
    expect(row("home-today", "11:00")).toBe("11:0012:59Komunikasi PemasaranDK4073 · TVST CWajib hadir");
    // A fact to keep in mind, not something to do now: quiet, never amber.
    const last = [...(section("home-today")?.querySelectorAll("li span") ?? [])].findLast((el) => el.textContent === "Wajib hadir");
    expect(last?.className).toContain("text-muted");
    // PL3032 (15:00–16:30) and KU5014 (16:00–17:50) share half an hour: each row says so in a word, beside its state on one
    // line; which one, when, and which to go to (Presensi's answer, on the one still in reach of its target) are in its why.
    expect(row("home-today", "15:00")).toBe("15:0016:30Ekonomi Infrastruktur dan TransportasiPL3032 · R.SG PWK LT.6Bentrok · Wajib hadir");
    // Out of reach is said on the day too, so the course doesn't drop off Beranda: first, as it's the most pressing.
    expect(row("home-today", "16:00")).toBe("16:0017:50Teknik Penyelesaian Masalah TerstrukturKU5014 · 9134Tak bisa capai 80% · Bentrok");
    expect(whys("home-today")).toEqual([
      "Jatah absen habis.",
      "Bentrok dengan KU5014 16:00–16:30. Pilih ini kalau hanya bisa hadir di salah satunya. Jatah absen habis.",
      "Paling tinggi 73%. Cek ke dosen kalau ada yang terlewat. Bentrok dengan PL3032 16:00–16:30.",
      "Diumumkan di Edunex, tidak ada di jadwal SIX.",
    ]);
    expect(row("home-today", "11:00")).not.toContain("Bentrok");
    expect(text("home-today")).toContain("Besok");
    // The camera says it's online and joinable; its number is the course page's.
    expect(row("home-today", "15:0017:00")).toBe("15:0017:00Proposal Tugas AkhirII4091Hanya di Edunex");
    // Where the meeting came from is a fact: quiet. Amber is left for what to do now (here, the clash to choose between).
    const notInSix = [...(section("home-today")?.querySelectorAll("li span") ?? [])].findLast((el) => el.textContent === "Hanya di Edunex");
    expect(notInSix?.className).toContain("text-muted");
    expect([...(section("home-today")?.querySelectorAll(".text-warning-fg") ?? [])].map((el) => el.textContent)).toEqual(["Bentrok", "Bentrok"]);
    // The row is one button: its name says what the row shows, as a screen reader reads only the name.
    await screen.click("Gabung kelas daring: II4091 · 15:00–17:00 · Hanya di Edunex");
    expect(screen.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: expect.stringContaining("teams.microsoft.com") } });
    await screen.click(/^11:0012:59Komunikasi Pemasaran/);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
  });

  it("what changed: one line each, not what the card or Hari ini already shows; 'Lihat semua' opens the bell with all of it", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const changes = text("home-changes");
    // The moved class is the card's ("Jam berubah"), the meeting outside SIX is Besok's ("Hanya di Edunex"): not said again.
    expect(changes).not.toContain("Jadwal PL3002 berubah");
    expect(changes).not.toContain("Pertemuan 3 II4091");
    // An old meeting re-read in the same text isn't news.
    expect(changes).not.toContain("Pertemuan 2 II4091");
    // What changed and when, one line; the details where it opens, and in its name.
    expect(rows("home-changes")).toEqual(["Materi baru · II4091Sen, 5 Okt"]);
    expect(screen.button(/^Materi baru · II4091 · Link Teams Pertemuan 03/)).toBeTruthy();
    await screen.click("Lihat semua");
    const bell = document.querySelector("[role=dialog][aria-label=Notifikasi]")?.textContent ?? "";
    expect(bell).toContain("Jadwal PL3002 berubah");
    expect(bell).toContain("Pertemuan 3 II4091 diumumkan di Edunex");
    await screen.key("Escape");
    await screen.click(/^Materi baru · II4091/);
    expect(document.querySelector("h1")?.textContent).toContain("Proposal Tugas Akhir");
  });

  it("speaks English", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(text("home-now")).toContain("On now");
    expect(text("home-now")).toContain("Tandai Hadir · not showing yet");
    expect(text("home-now")).toContain("Fill in Presence · closes 09:30");
    expect(whys("home-now")).toEqual(["Press Tandai Hadir in SIX when it shows. The app checks every 2 minutes.", "Open the course in Edunex by 09:30."]);
    expect(row("home-today", "15:00")).toContain("Clash · Don't miss it");
    expect(whys("home-today")).toContain("Clashes with KU5014 16:00–16:30. Go to this one if you can make only one. No absences left.");
    expect(screen.button("New time. Usually 08:00–09:30.")).toBeTruthy();
    expect(row("home-today", "16:00")).toContain("Can't reach 80% · Clash");
    expect(document.querySelector("main header")?.textContent).toContain("UTS in 4 days");
    expect(screen.button("UTS in 4 days. UTS period starts Monday, 12 Oct")).toBeTruthy();
  });
});

describe("later the same Thursday", () => {
  it("only a class within two hours says how soon; a past one reads in quiet greys, not faded, and says Selesai", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-08T10:15:00+07:00" }), signedIn: true, six: true });
    // On the card as next ("Berikutnya · dalam 45 menit"), so not in Hari ini; a later class says no "dalam".
    expect(text("home-now")).toMatch(/Berikutnya · dalam 4\d menit/);
    expect(row("home-today", "11:00")).toBe("");
    expect(row("home-today", "15:00")).not.toContain("dalam");
    expect(row("home-today", "08:00")).toMatch(/Selesai$/);
    const past = [...(section("home-today")?.querySelectorAll("li") ?? [])].find((li) => li.textContent?.startsWith("08:00"));
    expect(past?.querySelector("button")?.className).toContain("text-muted");
    expect(past?.querySelector("[class*='opacity-5'], [class*='opacity-6']")).toBeNull();
    // Where each part comes from changes nothing the Student does: no footnote under the day.
    expect(text("home-today")).not.toContain("Jadwal dari SIX");
  });
});

describe("an open window that counts", () => {
  it("in class, SIX's Tandai Hadir comes first and the Presence that counts too is under it, one click from its Task", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-16T15:01:00+07:00" }), signedIn: true, six: true });
    const now = text("home-now");
    expect(now.indexOf("Tandai Hadir · belum muncul")).toBeGreaterThan(-1);
    expect(now.indexOf("Isi Presensi · tutup 23:59")).toBeGreaterThan(now.indexOf("Tandai Hadir"));
    expect(whys("home-now")[1]).toBe("Kumpulkan Tugas 02 Bab II sebelum 23:59.");
    await screen.click("Buka tugasnya");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });

  it("with no class on, the Presence is the one thing to do: the primary action opens it, with the time left", async () => {
    // Friday evening, II4091's class over: its window, open until 23:59, is all there is.
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-16T23:20:00+07:00" }), signedIn: true, six: true });
    const now = text("home-now");
    expect(now).toContain("Isi Presensi · tutup 23:59");
    expect(whys("home-now")[0]).toMatch(/^Kumpulkan Tugas 02 Bab II sebelum 23:59\./);
    // SIX counts II4091 too: where attendance counts isn't claimed, and the Presence is never "optional".
    expect(now).not.toContain("Kehadiran dihitung");
    expect(now).not.toContain("tidak wajib");
    expect(screen.button("Buka tugasnya").className).toContain("bg-accent");
    // The bar runs down to the close, how long is left its name.
    expect(document.querySelector('main [role="progressbar"]')?.getAttribute("aria-label")).toMatch(/tutup dalam 3\d mnt/);
  });
});

describe("SIX's Tandai Hadir in class", () => {
  it("shows the moment SIX does: the primary action opens SIX on the class, and once pressed it says so without claiming a tick", async () => {
    const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
    screen = await openApp({ world, signedIn: true, six: true });
    expect(text("home-now")).toContain("Tandai Hadir · belum muncul");

    // The lecturer opens it in PL3002's class (meeting 2194342): within one look, Beranda says so.
    world.six.openCheckIn("2194342");
    await screen.engineDoes(() => world.clock.advance(2.5 * 60_000));
    expect(text("home-now")).toContain("Tandai Hadir · sudah dibuka");
    expect(whys("home-now")[0]).toBe("Belum kamu tekan. Kuliah sampai 10:00.");
    // While SIX's button shows, it's the one blue button: the lecturer can close it any minute. Edunex's is plain beside it.
    const open = screen.button("Buka di SIX untuk Tandai Hadir di PL3002");
    expect(open.className).toContain("bg-accent");
    expect(screen.button("Catat di Edunex: Presensi PL3002").className).not.toContain("bg-accent");
    await screen.click("Buka di SIX untuk Tandai Hadir di PL3002");
    expect(screen.calls.at(-1)).toEqual({ name: "six.openCheckIn", input: { meetingId: "2194342" } });

    // Pressed in SIX: the button goes, and Beranda says only what it saw.
    world.six.closeCheckIn("2194342");
    await screen.engineDoes(() => world.clock.advance(2.5 * 60_000));
    expect(text("home-now")).toContain("Tandai Hadir · tak tampil lagi");
    expect(whys("home-now")[0]).toBe("Sudah kamu tekan, atau sudah ditutup.");
    expect(screen.button("Buka di SIX untuk Tandai Hadir di PL3002").className).not.toContain("bg-accent");
    // Then Edunex's window, still open, is the one thing left to do: the blue button moves to it.
    expect(screen.button("Catat di Edunex: Presensi PL3002").className).toContain("bg-accent");
  });

  it("pressed in the app's SIX window before the app saw the button: said as pressed, with when, as soon as SIX is read again", async () => {
    const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
    screen = await openApp({ world, signedIn: true, six: true });
    expect(text("home-now")).toContain("Tandai Hadir · belum muncul");
    await screen.engineDoes(() => screen!.engine.act("six", "checkInPressed", { meetingId: "2194342" }));
    expect(text("home-now")).toContain("Tandai Hadir · ditekan 08:12");
    // Done: nothing left to explain, and no word of the app watching.
    expect(whys("home-now").some((why) => why.includes("Aplikasi memeriksa tiap 2 menit"))).toBe(false);
  });

  it("early in the term, with no count in SIX yet: it doesn't claim where attendance counts, nor call the Edunex Presence optional", async () => {
    const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
    world.six.setAttendance("PL3002", 0, 0);
    screen = await openApp({ world, signedIn: true, six: true });
    const now = text("home-now");
    expect(now).toContain("Tandai Hadir · belum muncul");
    expect(now).toContain("Isi Presensi · tutup 09:30");
    expect(whys("home-now").join(" ")).not.toContain("Kehadiran dihitung di SIX");
    expect(whys("home-now")[1]).toBe("Buka mata kuliahnya di Edunex sebelum 09:30.");
    expect(now).not.toContain("tidak wajib");
  });
});

describe("an open window of a course SIX counts too, recorded by handing in a Task", () => {
  it("is still to do, under Tandai Hadir: its button opens the Task here, and says so instead of Edunex", async () => {
    const world = new PretendWorld({ now: "2026-10-16T15:01:00+07:00" });
    // SIX counts II4091 too: its Presence (hand in Tugas 02 Bab II) is never called optional.
    world.six.setAttendance("II4091", 7, 8);
    screen = await openApp({ world, signedIn: true, six: true });
    expect(text("home-now")).toContain("Isi Presensi · tutup 23:59");
    expect(whys("home-now")[1]).toBe("Kumpulkan Tugas 02 Bab II sebelum 23:59.");
    expect(text("home-now")).not.toContain("tidak wajib");
    // SIX's button hasn't shown: handing in the Task is the one thing to do now, so it's the blue button.
    expect(screen.button("Buka tugasnya").className).toContain("bg-accent");
    expect(screen.button("Buka di SIX untuk Tandai Hadir di II4091").className).not.toContain("bg-accent");
    expect([...(section("home-now")?.querySelectorAll("button") ?? [])].map((b) => b.textContent)).not.toContain("Catat di Edunex");
    await screen.click("Buka tugasnya");
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });
});

describe("a Presence window still open after its class", () => {
  /** PL3002's window of Thursday 8 October, kept open until `end`. */
  const keepThursdayOpen = (world: PretendWorld, end: string) => world.edunex.keepPresenceOpen(2194342, end);
  const countdowns = () =>
    [...document.querySelectorAll("main section[aria-labelledby=home-now] [role=progressbar]")].map((el) => el.getAttribute("aria-label"));

  it("the class going on shows its own window, not last week's; last week's is in Perlu perhatianmu with its own class and day", async () => {
    // Thursday 15 October, in class. Last Thursday's window stays open until tomorrow 23:00; today's, until 23:59: last week's closes first.
    const world = new PretendWorld({ now: "2026-10-15T08:30:00+07:00" });
    keepThursdayOpen(world, "2026-10-16T23:00:00+07:00");
    world.edunex.keepPresenceOpen(2194343, "2026-10-16T23:59:00+07:00");
    screen = await openApp({ world, signedIn: true, six: true });
    const now = text("home-now");
    expect(now).toContain("Sedang berlangsung");
    // Today's window, not last week's.
    expect(now).toContain("Isi Presensi · tutup besok, 23:59");
    expect(whys("home-now")[1]).toBe("Buka mata kuliahnya di Edunex sebelum besok, 23:59.");
    expect(now).not.toContain("23:00");
    expect(row("home-needs", "Isi Presensi PL3002")).toMatch(/^Isi Presensi PL3002PL3002 · Kam, 8 Okt, 08:00–10:00 · tutup besok, 23:00/);
  });

  it("closing today, the time alone; between classes it leads the card, the thing to do now", async () => {
    const world = new PretendWorld({ now: "2026-10-09T11:00:00+07:00" });
    keepThursdayOpen(world, "2026-10-09T23:00:00+07:00");
    screen = await openApp({ world, signedIn: true, six: true });
    expect(text("home-now")).toContain("Isi Presensi · tutup 23:00");
    expect(whys("home-now")[0]).toMatch(/^Buka mata kuliahnya di Edunex sebelum 23:00\./);
    expect(row("home-needs", "Isi Presensi PL3002")).toBe("");
  });

  it("alone on the card: which class it's for, and the day it closes when that isn't today", async () => {
    const world = new PretendWorld({ now: "2026-10-09T11:00:00+07:00" });
    keepThursdayOpen(world, "2026-10-10T23:00:00+07:00");
    screen = await openApp({ world, signedIn: true });
    const now = text("home-now");
    // The course's code is the line under it: not said twice.
    expect(now).toContain("Presensi sedang dibuka");
    expect(now).not.toContain("Presensi PL3002 sedang dibuka");
    expect(now).toContain("PL3002 · Kemarin, 08:00–09:30");
    expect(now).toContain("Isi Presensi · tutup besok, 23:00");
    // A day and a half away: its day, not "36 jam", said once: the bar beside it is named so, its words not shown.
    expect(countdowns()).toEqual(["tutup besok"]);
    expect(now.match(/besok/g)).toHaveLength(1);
  });

  it("closing in three days: the day and date, in either language", async () => {
    const world = new PretendWorld({ now: "2026-10-09T11:00:00+07:00" });
    keepThursdayOpen(world, "2026-10-12T23:00:00+07:00");
    screen = await openApp({ world, signedIn: true });
    expect(text("home-now")).toContain("tutup Sen, 12 Okt, 23:00");
    // Further off, how long is left is the bar's name.
    expect(countdowns()).toEqual(["tutup dalam 3 hari"]);
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(text("home-now")).toContain("closes Mon, 12 Oct, 23:00");
    expect(text("home-now")).toContain("PL3002 · Yesterday, 08:00–09:30");
    expect(countdowns()).toEqual(["closes in 3 days"]);
  });
});

describe("with Edunex alone", () => {
  it("an open window leads, but where it counts isn't guessed before SIX is connected", async () => {
    screen = await openApp({ signedIn: true });
    const now = text("home-now");
    expect(now).toContain("Presensi sedang dibuka");
    // Without SIX nobody knows whether Edunex counts: said as a just-in-case, in its why, the button quiet.
    expect(now).toContain("Isi Presensi · tutup 09:30");
    expect(whys("home-now")[0]).toContain("Tanpa SIX, belum pasti ini dihitung. Catat saja untuk berjaga-jaga.");
    expect(whys("home-now")[0]).not.toContain("dihitung lewat Presensi Edunex");
    const button = [...document.querySelectorAll<HTMLButtonElement>("section[aria-labelledby=home-now] button")].find(
      (b) => b.textContent === "Catat di Edunex",
    );
    expect(button?.className).not.toContain("bg-accent ");
    expect(text("home-today")).toContain("Jadwal dan ruang kuliah muncul setelah SIX terhubung.");
  });
});

describe("an exam on Beranda", () => {
  it("within the week: what, when and where in one line, and its page one click away", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-13T09:00:00+07:00" }), signedIn: true, six: true });
    const exam = row("home-needs", "UTS Komunikasi Pemasaran");
    // The title names the course; the end time is the exam page's, and its take-home part is a Task of its own.
    expect(exam).toBe("UTS Komunikasi PemasaranKam, 15 Okt · 11:00 · TVST Clusa");
    const item = [...document.querySelectorAll("section[aria-labelledby=home-needs] li")].find((li) => li.textContent?.startsWith("UTS Komunikasi"));
    expect(item?.querySelector(".text-warning-fg")).toBeNull();
    await screen.click(/^UTS Komunikasi Pemasaran/);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    expect(screen.text()).toContain("Kapan dan di mana");
  });

  it("the exam in today's classes opens its exam page, not the course's meetings", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-15T08:30:00+07:00" }), signedIn: true, six: true });
    const today = [...document.querySelectorAll<HTMLButtonElement>("section[aria-labelledby=home-today] li > button")];
    const exam = today.find((b) => b.textContent?.includes("UTS"))!;
    await screen.click(exam);
    expect(document.querySelector("main h1")?.textContent).toBe("Komunikasi Pemasaran");
    expect(screen.text()).toContain("Kapan dan di mana");
  });

  it("speaks English", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-14T09:00:00+07:00" }), signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    const exam = rows("home-needs").find((r) => r.includes("UTS")) ?? "";
    expect(exam).toContain("Tomorrow · 11:00 · TVST C");
    expect(exam).not.toContain("Take-home");
  });
});

describe("a Presence window ahead", () => {
  it("a Task that takes attendance: what to hand in and when, said once, and the Task one click away", async () => {
    screen = await openApp({ signedIn: true, world: new PretendWorld({ now: "2026-10-11T21:00:00+07:00" }) });
    await screen.wait();
    const ahead = row("home-needs", "Kumpulkan Tugas 02 Bab II");
    // One line of facts: the course, then when it also counts as attendance.
    expect(ahead).toContain("II4091 · Juga presensi: Jum, 16 Okt, 15:00–23:59");
    expect(ahead.match(/Tugas 02 Bab II/g)).toHaveLength(1);
    await screen.click(/^Kumpulkan Tugas 02 Bab II/);
    expect(document.querySelector("main h1")?.textContent).toBe("Tugas 02 Bab II");
  });

  it("open across days: each end with its own day, never a range read as one day's", async () => {
    const world = new PretendWorld({ now: "2026-10-15T10:30:00+07:00" });
    // II4091's window for handing in Tugas 02 Bab II opens tomorrow 15:00 and stays open until Monday night.
    world.edunex.keepPresenceOpen(2243740, "2026-10-19T23:00:00+07:00");
    screen = await openApp({ signedIn: true, world });
    await screen.wait();
    expect(row("home-needs", "Kumpulkan Tugas 02 Bab II")).toContain("II4091 · Juga presensi: Besok, 15:00 sampai Sen, 19 Okt, 23:00");
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(row("home-needs", "Hand in Tugas 02 Bab II")).toContain("II4091 · Also attendance: Tomorrow, 15:00 until Mon, 19 Oct, 23:00");
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
    expect(text("home-now")).toContain("Jam berubah");
    expect(screen.button("Jam berubah. Biasanya Kamis 08:00–09:30.")).toBeTruthy();
    // Said once: the now card shows this class, so its row in Hari ini doesn't repeat it.
    expect(row("home-today", "10:00")).not.toContain("Jam berubah");
  });
});

describe("an online meeting only Edunex announced", () => {
  it("going on: the card shows it with its Join button and where it came from; its row says Sekarang, not that again", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-09T15:10:00+07:00" }), signedIn: true, six: true });
    const now = text("home-now");
    expect(now).toContain("Sedang berlangsung");
    expect(now).toContain("Proposal Tugas Akhir");
    expect(now).toContain("15:0017:00");
    expect(now).toContain("II4091 · Pertemuan 3 · daring · Hanya di Edunex");
    expect(screen.button("Hanya di Edunex. Diumumkan di Edunex, tidak ada di jadwal SIX.")).toBeTruthy();
    // Not next week's class.
    expect(now).not.toContain("Kuliah berikutnya");
    const join = section("home-now")!.querySelector<HTMLButtonElement>('button[aria-label="Gabung kelas daring: II4091"]')!;
    expect(join.className).toContain("bg-accent");
    await screen.click(join);
    expect(screen.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: expect.stringContaining("teams.microsoft.com") } });
    // The card is the meeting going on: Hari ini doesn't list it again, so there's one Gabung, not two.
    expect(row("home-today", "15:0017:00")).toBe("");
    expect(section("home-today")!.querySelector("button[aria-label^='Gabung']")).toBeNull();
  });

  it("offline: the dot by Sedang berlangsung goes grey, and the words with it, never green beside a grey dot", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-09T15:10:00+07:00" }), signedIn: true, six: true });
    const eyebrow = () => [...(section("home-now")?.querySelectorAll("span") ?? [])].find((el) => el.textContent?.startsWith("Sedang berlangsung"))!;
    expect(eyebrow().className).toContain("text-success-fg");
    await screen.apply({ type: "status", status: { ...screen.store.status("edunex"), state: "offline" } });
    expect(eyebrow().className).not.toContain("text-success-fg");
    expect(eyebrow().className).toContain("text-muted");
  });

  it("the evening before: the card says it's tomorrow, without a Join button yet", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-08T20:00:00+07:00" }), signedIn: true, six: true });
    const now = text("home-now");
    expect(now).toContain("Kuliah berikutnya · Besok");
    expect(now).toContain("Proposal Tugas Akhir");
    expect(now).toContain("Hanya di Edunex");
    expect(section("home-now")!.querySelector("button[aria-label^='Gabung']")).toBeNull();
    // The card has it: Besok doesn't list it again.
    expect(row("home-today", "15:0017:00")).toBe("");
  });

  it("speaks English", async () => {
    screen = await openApp({ world: new PretendWorld({ now: "2026-10-09T15:10:00+07:00" }), signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(text("home-now")).toContain("On now");
    expect(text("home-now")).toContain("Edunex only");
    expect(screen.button("Edunex only. Announced in Edunex, not on SIX's timetable.")).toBeTruthy();
    expect(section("home-now")!.querySelector("button[aria-label='Join online class: II4091']")).not.toBeNull();
    expect(row("home-today", "15:00")).toBe("");
  });
});

describe("Tasks on Beranda", () => {
  it("a Task due tonight is in Hari ini (not twice); edited after handing in, it says how many things changed", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    screen.world.edunex.editTask(117432, { description: "<p>Tambahkan referensi.</p>" });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    expect(row("home-today", "23:59")).toMatch(/^23:59Ringkasan K5PL3032 · Tenggatdalam 1\d jam$/);
    expect(rows("home-needs").some((r) => r.includes("Ringkasan K5"))).toBe(false);
    // How many things changed; the Task page's History says which.
    expect(row("home-needs", "Tugas tentang Imfact")).toContain("Diubah dosen setelah kamu kumpulkan · 1 perubahan");
    // One line, what and when; which Task is in its name, and where it opens.
    expect(row("home-changes", "Tugas baru · PL3032")).toBe("Tugas baru · PL303208:12");
    expect(screen.button(/^Tugas baru · PL3032 · Ringkasan K5/)).toBeTruthy();
    await screen.click(/^23:59Ringkasan K5/);
    expect(document.querySelector("h1")?.textContent).toBe("Ringkasan K5");
  });

  it("a long name with no spaces wraps in Hari ini instead of pushing Beranda past the window", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const name = "Laporan_Akhir_Studio_Perencanaan_Wilayah_dan_Kota_Revisi_Ketiga_Setelah_Asistensi_Dosen_Pembimbing";
    screen.world.edunex.postTask(95059, { name, end_at: "2026-10-08T23:59:00+07:00" });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    const title = [...(section("home-today")?.querySelectorAll("li span[title]") ?? [])].find((el) => el.textContent === name);
    expect(title?.className).toContain("break-words");
    // Below 800 px the day and what needs you stack in one column, which must be able to be narrower than
    // the longest word: a column that fits its content (no template) would widen the whole page instead.
    const grid = section("home-today")?.parentElement;
    expect(grid?.className).toMatch(/(^| )grid-cols-1( |$)/);
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
    expect(text("home-needs")).toContain("Bebas tenggat 7 hari ke depan");
    expect(text("home-needs")).toContain("Tidak ada tugas atau ujian dengan tenggat sampai Sabtu, 17 Okt.");
    expect(text("home-today")).toContain("Jadwal dan ruang kuliah muncul setelah SIX terhubung.");
    expect(text("home-changes")).toContain("Tidak ada yang berubah minggu ini.");
    // SIX is a click away from where its classes would be.
    await screen.click("Masuk ke SIX");
    await screen.wait();
    expect(screen.store.status("six").state).toBe("live");
    expect(text("home-today")).not.toContain("muncul setelah SIX terhubung");
  });
});

describe("how far ahead Perlu perhatianmu looks", () => {
  /** Friday 23 October, 15:00, with only these Tasks on Edunex. */
  const friday = (...tasks: { name: string; end_at: string; start_at?: string }[]) => {
    const world = new PretendWorld({ now: "2026-10-23T15:00:00+07:00" });
    const ids = tasks.map((task) => world.edunex.postTask(95001, task));
    for (const [course, list] of world.edunex.tasks)
      world.edunex.tasks.set(
        course,
        list.filter((task) => ids.includes(task.id as number)),
      );
    world.edunex.presences.clear();
    world.edunex.contents.clear();
    world.edunex.announcements.clear();
    return world;
  };

  it("counts whole days: a deadline at 23:59 on the seventh day is listed, never said to be free", async () => {
    screen = await openApp({ world: friday({ name: "Tugas 03 Bab III", end_at: "2026-10-30T23:59:00+07:00" }), signedIn: true });
    expect(rows("home-needs").some((r) => r.startsWith("Tugas 03 Bab III"))).toBe(true);
    expect(text("home-needs")).not.toContain("Bebas tenggat");
  });

  it("follows Settings: 3 days, a week or 2 weeks, and the empty list says which days are free", async () => {
    screen = await openApp({ world: friday({ name: "Tugas 03 Bab III", end_at: "2026-10-30T23:59:00+07:00" }), signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    expect(["3 hari", "1 minggu", "2 minggu"].map((name) => screen!.button(name).getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    await screen.click("3 hari");
    expect(screen.engine.snapshot().settings.needsAhead).toBe(3);
    await screen.key("Escape");
    expect(text("home-needs")).toContain("Bebas tenggat 3 hari ke depan");
    expect(text("home-needs")).toContain("Tidak ada tugas atau ujian dengan tenggat sampai Senin, 26 Okt.");
    expect(text("home-needs")).not.toContain("Tugas 03 Bab III");
  });

  it("a deadline only Hari ini shows, or one not open yet: nothing else needs you, never 'nothing due'", async () => {
    screen = await openApp({ world: friday({ name: "Ringkasan", end_at: "2026-10-24T23:59:00+07:00" }), signedIn: true });
    expect(text("home-today")).toContain("Ringkasan");
    expect(text("home-needs")).toContain("Tidak ada lagi yang perlu perhatianmu sekarang");
    expect(text("home-needs")).toContain("Tenggat berikutnya besok, 23:59.");
    expect(text("home-needs")).not.toContain("Bebas tenggat");
    screen.close();

    screen = await openApp({
      world: friday({ name: "Kuis", start_at: "2026-10-27T10:00:00+07:00", end_at: "2026-10-27T11:00:00+07:00" }),
      signedIn: true,
    });
    expect(text("home-needs")).toContain("Tenggat berikutnya Sel, 27 Okt, 11:00.");
    expect(text("home-needs")).not.toContain("Bebas tenggat");
  });
});

describe("a class on SIX's timetable the app can't read", () => {
  it("Beranda lists it in today's classes, a click from SIX's timetable, and the card says the day has it", async () => {
    const world = new PretendWorld();
    // DK4073's 11:00 class, its time written with dots.
    world.six.moveMeeting("2153983", "11.00", "12.59");
    screen = await openApp({ world, signedIn: true, six: true });
    // Today's (the 08:00 class on now is the card above), then tomorrow's online meeting.
    expect(rows("home-today").map((one) => one.slice(0, 5))).toEqual(["-Ada ", "15:00", "16:00", "15:00"]);
    expect(row("home-today", "-")).toMatch(/^-Ada kuliah yang belum terbaca11\.00-12\.59 DK4073 Komunikasi .*Buka jadwal di SIX$/);
    expect(text("home-now")).toContain("Ada kuliah yang belum terbaca · Hari ini");
    // Quietly: the row and the card say it, not a note over Beranda.
    expect(document.querySelector("main")?.textContent).not.toContain("belum dikenali");
    await screen.click([...(section("home-today")?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => b.textContent === "Buka jadwal di SIX")!);
    expect(screen.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001?bulan=202610" },
    });
  });

  it("tomorrow's meeting announced only in Edunex isn't said to be missing from SIX on a day SIX shows a class of it the app can't read", async () => {
    const world = new PretendWorld();
    world.six.addMeetingOn(9, { id: "2299003", code: "II4091", name: "Proposal Tugas Akhir", start: "15.00", end: "17.00" });
    screen = await openApp({ world, signedIn: true, six: true });
    // Tomorrow: the class SIX shows that the app can't read, then the meeting Edunex announced, without "Tidak ada di jadwal SIX".
    expect(rows("home-today").slice(-2)).toEqual([
      expect.stringMatching(/^-Ada kuliah yang belum terbaca15\.00-17\.00 II4091 /),
      expect.stringMatching(/^15:0017:00Proposal Tugas AkhirII4091$/),
    ]);
  });

  it("a week with no other class says there's one the app can't read, not that the week is free", async () => {
    const world = new PretendWorld({ now: "2026-10-31T09:00:00+07:00" });
    world.six.addMeeting({ id: "2299001", code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan", day: "2026-11-03", start: "08.00", end: "09.30" });
    screen = await openApp({ world, signedIn: true, six: true });
    expect(text("home-now")).toContain("Ada kuliah yang belum terbaca · Sel, 3 Nov");
    expect(text("home-now")).toContain("Jam dan ruangnya ada di SIX.");
    expect(text("home-now")).not.toContain("Tidak ada kuliah dalam seminggu ke depan");
  });
});
