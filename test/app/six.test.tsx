// @vitest-environment jsdom
// v2-08 (#76), seam 2: SIX in the window. The real engine reads the pretend
// EduNex and SIX behind the bridge; the tests look at what the Student sees.
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const cards = () => [...document.querySelectorAll("main ul li")].map((li) => li.textContent ?? "");
const card = (code: string) => cards().find((text) => text.startsWith(code)) ?? "";
const sidebar = () => document.querySelector("aside")?.textContent ?? "";
const edunexLive = /^EduNex\s*Terhubung$/;
const sixLive = /^SIX\s*Terhubung$/;

describe("first run", () => {
  it("connects EduNex, then SIX, then shows this term's courses from SIX with SKS and attendance", async () => {
    screen = await openApp();
    expect(screen.text()).toContain("Jadwal dan ruang, hitungan kehadiran, nilai, KRS, UKT");
    expect(screen.button("Lanjut").disabled).toBe(true);

    await screen.click("Hubungkan EduNex");
    // Still welcoming: SIX is next, with the same Microsoft sign-in.
    expect(screen.text()).toContain("Dimas Pratama · 18223901");
    expect(screen.has("Hubungkan EduNex")).toBe(false);
    expect(screen.button("Lanjut").disabled).toBe(false);

    await screen.click("Hubungkan SIX");
    expect(screen.calls.filter((c) => c.name === "auth.signIn").map((c) => c.input)).toEqual([{ source: "edunex" }, { source: "six" }]);
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    expect(screen.has("Hubungkan SIX")).toBe(false);

    await screen.click("Lanjut");
    // Moving on wipes the sign-in windows' Microsoft session.
    expect(screen.calls.some((c) => c.name === "auth.signInDone")).toBe(true);
    expect(screen.text()).toContain("Mata kuliah semester ini");
    expect(cards()).toHaveLength(5);
    expect(card("DK4073")).toContain("Komunikasi Pemasaran");
    expect(card("DK4073")).toContain("Kelas 01 · 3 SKS");
    expect(card("DK4073")).toContain("4/6");
    expect(card("DK4073")).toContain("66%");
    expect(screen.has(edunexLive)).toBe(true);
    expect(screen.has(sixLive)).toBe(true);
  });

  it("SIX can come first; continuing needs at least one system", async () => {
    screen = await openApp();
    await screen.click("Hubungkan SIX");
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    expect(screen.has("Hubungkan EduNex")).toBe(true);
    await screen.click("Lanjut");
    expect(cards()).toHaveLength(5);
    expect(card("PL3002")).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(card("PL3002")).toContain("Tidak ada di EduNex");
  });

  it("closing the SIX sign-in window leaves SIX ready to try again", async () => {
    screen = await openApp({ signInWindow: "closes" });
    await screen.click("Hubungkan SIX");
    expect(screen.button("Hubungkan SIX").disabled).toBe(false);
    expect(screen.button("Lanjut").disabled).toBe(true);
  });
});

describe("Home with both systems", () => {
  it("each course shows its class, SKS and SIX's attendance count and share, with both chips", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(cards().map((text) => text.slice(0, 6))).toEqual(["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]);
    const expected = {
      DK4073: ["Kelas 01 · 3 SKS", "4/6", "66%"],
      II4091: ["Kelas 01 · 2 SKS", "3/3", "100%"],
      KU5014: ["Kelas 01 · 3 SKS", "2/6", "33%"],
      PL3002: ["Kelas 01 · 3 SKS", "6/7", "85%"],
      PL3032: ["Kelas 01 · 3 SKS", "4/7", "57%"],
    };
    for (const [code, facts] of Object.entries(expected)) for (const fact of facts) expect(card(code)).toContain(fact);
    // SIX's (Indonesian) names, and EduNex's course page for each.
    expect(card("PL3032")).toContain("Ekonomi Infrastruktur dan Transportasi");
    expect(screen.has("Buka di EduNex: PL3032")).toBe(true);
    expect(document.querySelector('[role="progressbar"][aria-label="Hadir 2 dari 6 pertemuan"]')).not.toBeNull();
    expect(screen.has(edunexLive)).toBe(true);
    expect(screen.has(sixLive)).toBe(true);
  });

  it("attendance follows SIX", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.setAttendance("KU5014", 3, 7);
    await screen.engineDoes(() => screen!.engine.refresh("six"));
    expect(card("KU5014")).toContain("3/7");
    expect(card("KU5014")).toContain("42%");
  });

  it("speaks English: EduNex's English names, the same counts", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(card("PL3032")).toContain("Infrastructure and Transportation Economics");
    expect(card("PL3032")).toContain("Class 01 · 3 SKS");
    expect(card("PL3032")).toContain("Attendance");
    expect(document.querySelector('[role="progressbar"][aria-label="Attended 4 of 7 meetings"]')).not.toBeNull();
    expect(screen.has(/^SIX\s*Live$/)).toBe(true);
  });

  it("a course in SIX but not on EduNex shows from SIX, and opens SIX", async () => {
    const world = (await openApp({ start: false })).world;
    screen?.close();
    world.edunex.pairs = world.edunex.pairs.filter((pair: { course_code: string }) => pair.course_code !== "PL3032");
    screen = await openApp({ world, signedIn: true, six: true });
    expect(cards()).toHaveLength(5);
    expect(card("PL3032")).toContain("Tidak ada di EduNex");
    expect(card("PL3032")).toContain("4/7");
    expect(screen.has("Buka di EduNex: PL3032")).toBe(false);
    await screen.click("Buka di SIX: PL3032");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs" } });
    expect(sidebar()).toContain("PL3032");
  });

  it("an EduNex course SIX doesn't list this term is left out once SIX is connected", async () => {
    screen = await openApp({ signedIn: true });
    expect(cards()).toHaveLength(5);
    expect(card("KU5014")).toContain("Teknik Penyelesaian Masalah Terstruktur");
    screen.world.six.editPage(/\/statusmhs$/, (html) => html.replace(/<tr>(?:(?!<\/tr>)[\s\S])*?<td>KU5014<\/td>[\s\S]*?<\/tr>/, ""));
    await screen.engineDoes(() => screen!.engine.signIn("six", { cookie: "khongguan=pretend-six-session" }));
    expect(cards().map((text) => text.slice(0, 6))).toEqual(["DK4073", "II4091", "PL3002", "PL3032"]);
    expect(sidebar()).not.toContain("KU5014");
  });

  it("an EduNex course of another term isn't joined to this term's SIX course", async () => {
    const world = (await openApp({ start: false })).world;
    screen?.close();
    world.edunex.pairs = world.edunex.pairs.map((pair: { course_code: string }) => (pair.course_code === "DK4073" ? { ...pair, year: "2025", semester: "2" } : pair));
    screen = await openApp({ world, signedIn: true, six: true });
    expect(card("DK4073")).toContain("Tidak ada di EduNex");
    expect(screen.has("Buka di EduNex: DK4073")).toBe(false);
  });
});

describe("each system on its own", () => {
  it("SIX ending its session: SIX asks to sign in again, EduNex stays live, the courses stay", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.expireSession();
    await screen.engineDoes(() => screen!.engine.refresh("six"));
    expect(screen.text()).toContain("SIX mengakhiri sesimu. Data terakhir tetap bisa dibaca.");
    expect(screen.has(edunexLive)).toBe(true);
    expect(screen.has(/^SIX\s*Sesi berakhir$/)).toBe(true);
    expect(card("DK4073")).toContain("4/6");
    screen.world.six.sessionValid = true;
    await screen.click("Masuk lagi");
    expect(screen.text()).not.toContain("SIX mengakhiri sesimu");
    expect(screen.has(sixLive)).toBe(true);
  });

  it("EduNex ending its session leaves SIX's courses and chip as they were", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.edunex.expireSession();
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    expect(screen.text()).toContain("EduNex mengakhiri sesimu.");
    expect(screen.has(sixLive)).toBe(true);
    expect(cards()).toHaveLength(5);
    expect(card("PL3002")).toContain("6/7");
  });

  it("SIX changing something says so and keeps the last courses", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.changeLayout(/\/statusmhs$/, 'title="Hadir', 'data-note="Hadir');
    await screen.click(sixLive);
    expect(screen.text()).toContain("SIX berubah");
    expect(screen.text()).toContain("SIX mengirim data yang tidak dikenali.");
    expect(card("DK4073")).toContain("4/6");
    expect(screen.has(edunexLive)).toBe(true);
  });

  it("SIX rate-limiting the app shows offline and keeps the data", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.rateLimit(1);
    await screen.click(sixLive);
    expect(screen.has(/^SIX\s*Offline$/)).toBe(true);
    expect(card("DK4073")).toContain("4/6");
  });
});

describe("Settings", () => {
  it("shows the SIX account, and signing out of SIX leaves EduNex", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click(/Dimas Pratama/);
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    await screen.click("Keluar: SIX");
    expect(screen.has("Masuk: SIX")).toBe(true);
    expect(screen.has("Keluar: EduNex")).toBe(true);
    expect(screen.vault.secrets.has("six.session")).toBe(false);
    expect(screen.vault.secrets.has("edunex.session")).toBe(true);
    // Back to EduNex's list: no SKS or attendance without SIX.
    expect(cards()).toHaveLength(5);
    expect(card("DK4073")).not.toContain("SKS");
    expect(screen.has(/^SIX\s*Belum masuk$/)).toBe(true);
  });

  it("connects SIX from Settings", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click(/Dimas Pratama/);
    await screen.click("Masuk: SIX");
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    expect(screen.has("Keluar: SIX")).toBe(true);
  });
});
