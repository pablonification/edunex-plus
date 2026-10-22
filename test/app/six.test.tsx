// @vitest-environment jsdom
// v2-08 (#76), seam 2: SIX in the window. The real engine reads the pretend
// Edunex and SIX behind the bridge; the tests look at what the Student sees.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** Beranda's course cards (the other lists on Beranda are rows). */
const cards = () => [...document.querySelectorAll('main section[aria-labelledby="home-courses"] ul > li')].map((li) => li.textContent ?? "");
const card = (code: string) => cards().find((text) => text.startsWith(code)) ?? "";
/** A course card's absence bar: what a screen reader hears, and its status color. */
const meter = (code: string) => {
  const li = [...document.querySelectorAll('main section[aria-labelledby="home-courses"] ul > li')].find((el) => el.textContent?.startsWith(code));
  const el = li?.querySelector("[role=img]");
  return { label: el?.getAttribute("aria-label"), tone: el?.getAttribute("data-tone") };
};
const sidebar = () => document.querySelector("aside")?.textContent ?? "";
/** What the top bar's status panel says about each system. */
const edunexLive = async () => expect(await screen!.sourceState("Edunex")).toBe("Terhubung");
const sixLive = async () => expect(await screen!.sourceState("SIX")).toBe("Terhubung");
/** SIX is read again (the status panel's "Perbarui sekarang" reads every source; here only SIX matters). */
const refreshSix = () => screen!.engineDoes(() => screen!.engine.refresh("six"));

describe("first run", () => {
  it("connects Edunex, then SIX, then shows this term's courses from SIX with SKS and attendance", async () => {
    screen = await openApp();
    expect(screen.text()).toContain("Jadwal dan ruang, hitungan kehadiran, nilai, KRS, UKT");
    // "Lanjut" is always the primary button; disabled, it says why.
    expect(screen.button("Lanjut").disabled).toBe(true);
    expect(screen.button("Lanjut").className).toContain("bg-accent");
    expect(screen.text()).toContain("Hubungkan Edunex atau SIX dulu");

    await screen.click("Hubungkan Edunex");
    // Still welcoming: SIX is next, with the same Microsoft sign-in.
    expect(screen.text()).toContain("Dimas Pratama · 18223901");
    expect(screen.has("Hubungkan Edunex")).toBe(false);
    expect(screen.button("Lanjut").disabled).toBe(false);
    expect(screen.text()).toContain("SIX bisa dihubungkan nanti dari Pengaturan");

    await screen.click("Hubungkan SIX");
    expect(screen.calls.filter((c) => c.name === "auth.signIn").map((c) => c.input)).toEqual([{ source: "edunex" }, { source: "six" }]);
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    expect(screen.has("Hubungkan SIX")).toBe(false);
    // Connected says who, never still "waiting" (the audit's stale SIX line).
    expect(screen.text()).not.toContain("Masuk di jendela Microsoft");
    expect(screen.text()).not.toContain("Memeriksa…");

    await screen.click("Lanjut");
    // Moving on wipes the sign-in windows' Microsoft session.
    expect(screen.calls.some((c) => c.name === "auth.signInDone")).toBe(true);
    expect(screen.text()).toContain("Mata kuliah semester ini");
    expect(cards()).toHaveLength(5);
    expect(card("DK4073")).toContain("Komunikasi Pemasaran");
    expect(card("DK4073")).toContain("Kelas 01 · 3 SKS");
    expect(card("DK4073")).toContain("4/6");
    expect(card("DK4073")).toContain("66%");
    await edunexLive();
    await sixLive();
  });

  it("SIX can come first; continuing needs at least one system", async () => {
    screen = await openApp();
    await screen.click("Hubungkan SIX");
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    expect(screen.has("Hubungkan Edunex")).toBe(true);
    await screen.click("Lanjut");
    expect(cards()).toHaveLength(5);
    expect(card("PL3002")).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(card("PL3002")).toContain("Tidak ada di Edunex");
  });

  it("closing the SIX sign-in window leaves SIX ready to try again", async () => {
    screen = await openApp({ signInWindow: "closes" });
    await screen.click("Hubungkan SIX");
    expect(screen.button("Hubungkan SIX").disabled).toBe(false);
    expect(screen.button("Lanjut").disabled).toBe(true);
  });
});

describe("Home with both systems", () => {
  it("each course shows its class, SKS and its absences from SIX's count, as Presensi draws them", async () => {
    screen = await openApp({ signedIn: true, six: true });
    expect(cards().map((text) => text.slice(0, 6))).toEqual(["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]);
    // The bar says what it is ("Jatah absen"), then what's used and what's left.
    const expected = {
      DK4073: ["Kelas 01 · 3 SKS", "Jatah absenTerpakai 2× · habis"],
      II4091: ["Kelas 01 · 2 SKS", "Jatah absenBelum terpakai · sisa 2×"],
      KU5014: ["Kelas 01 · 3 SKS", "Jatah absenTerpakai 4× · lebih 1× untuk 80%"],
      PL3002: ["Kelas 01 · 3 SKS", "Jatah absenTerpakai 1× · sisa 1×"],
      PL3032: ["Kelas 01 · 3 SKS", "Jatah absenTerpakai 3× · habis"],
    };
    for (const [code, facts] of Object.entries(expected)) for (const fact of facts) expect(card(code)).toContain(fact);
    // No share on a card: nothing that could seem to disagree with the bar.
    expect(cards().join(" ")).not.toMatch(/\d+\/\d+|\d+%(?! *$)(?!.*untuk)/);
    // SIX's (Indonesian) names, and Edunex's course page for each.
    expect(card("PL3032")).toContain("Ekonomi Infrastruktur dan Transportasi");
    expect(screen.has("Buka di Edunex: PL3032")).toBe(true);
    // The bar's own name says the allowance; screen readers hear it.
    expect(meter("KU5014").label).toBe("Jatah absen semester ini 3×. Terpakai 4×, lebih 1×.");
    // Bars speak in status colors, never the course's: KU5014 past its limit (red), DK4073 full (amber), II4091 calm.
    expect(meter("KU5014").tone).toBe("danger");
    expect(meter("DK4073").tone).toBe("warning");
    expect(meter("II4091").tone).toBe("neutral");
    await edunexLive();
    await sixLive();
  });

  it("attendance follows SIX", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.setAttendance("KU5014", 3, 6);
    await screen.engineDoes(() => screen!.engine.refresh("six"));
    expect(card("KU5014")).toContain("Terpakai 3× · habis");
  });

  it("speaks English with the official course names (the transcript's), the same counts", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    // One name per course on every screen and in both languages: SIX's, not Edunex's English page title.
    expect(card("PL3032")).toContain("Ekonomi Infrastruktur dan Transportasi");
    expect(card("PL3032")).not.toContain("Infrastructure and Transportation Economics");
    expect(card("PL3032")).toContain("Class 01 · 3 SKS");
    expect(card("PL3032")).toContain("Absences3 used · none left");
    expect(meter("PL3032").label).toBe("Absences this term. All 3 used, none left.");
    expect(await screen.sourceState("SIX")).toBe("Connected");
  });

  it("a course in SIX but not on Edunex shows from SIX, and opens SIX", async () => {
    const world = (await openApp({ start: false })).world;
    screen?.close();
    world.edunex.pairs = world.edunex.pairs.filter((pair: { course_code: string }) => pair.course_code !== "PL3032");
    screen = await openApp({ world, signedIn: true, six: true });
    expect(cards()).toHaveLength(5);
    expect(card("PL3032")).toContain("Tidak ada di Edunex");
    expect(card("PL3032")).toContain("4/7");
    expect(screen.has("Buka di Edunex: PL3032")).toBe(false);
    await screen.click("Buka di SIX: PL3032");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs" } });
    expect(sidebar()).toContain("PL3032");
  });

  it("an Edunex course SIX doesn't list this term is left out once SIX is connected", async () => {
    screen = await openApp({ signedIn: true });
    expect(cards()).toHaveLength(5);
    expect(card("KU5014")).toContain("Teknik Penyelesaian Masalah Terstruktur");
    screen.world.six.editPage(/\/statusmhs$/, (html) => html.replace(/<tr>(?:(?!<\/tr>)[\s\S])*?<td>KU5014<\/td>[\s\S]*?<\/tr>/, ""));
    await screen.engineDoes(() => screen!.engine.signIn("six", { cookie: "khongguan=pretend-six-session" }));
    expect(cards().map((text) => text.slice(0, 6))).toEqual(["DK4073", "II4091", "PL3002", "PL3032"]);
    expect(sidebar()).not.toContain("KU5014");
  });

  it("an Edunex course of another term isn't joined to this term's SIX course", async () => {
    const world = (await openApp({ start: false })).world;
    screen?.close();
    world.edunex.pairs = world.edunex.pairs.map((pair: { course_code: string }) =>
      pair.course_code === "DK4073" ? { ...pair, year: "2025", semester: "2" } : pair,
    );
    screen = await openApp({ world, signedIn: true, six: true });
    expect(card("DK4073")).toContain("Tidak ada di Edunex");
    expect(screen.has("Buka di Edunex: DK4073")).toBe(false);
  });
});

describe("each system on its own", () => {
  it("SIX ending its session: SIX asks to sign in again, Edunex stays live, the courses stay", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.expireSession();
    await screen.engineDoes(() => screen!.engine.refresh("six"));
    expect(screen.text()).toContain("Sesi SIX berakhir. Data terakhir tetap bisa dibaca.");
    await edunexLive();
    expect(await screen.sourceState("SIX")).toBe("Sesi berakhir");
    expect(card("DK4073")).toContain("4/6");
    screen.world.six.sessionValid = true;
    await screen.click("Masuk lagi");
    expect(screen.text()).not.toContain("Sesi SIX berakhir");
    await sixLive();
  });

  it("Edunex ending its session leaves SIX's courses and chip as they were", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.edunex.expireSession();
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    expect(screen.text()).toContain("Sesi Edunex berakhir.");
    await sixLive();
    expect(cards()).toHaveLength(5);
    expect(card("PL3002")).toContain("6/7");
  });

  it("SIX changing something says so and keeps the last courses", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.changeLayout(/\/statusmhs$/, 'title="Hadir', 'data-note="Hadir');
    await refreshSix();
    expect(screen.text()).toContain("SIX berubah");
    expect(screen.text()).toContain("SIX mengirim data yang tidak dikenali.");
    expect(card("DK4073")).toContain("4/6");
    await edunexLive();
  });

  it("SIX rate-limiting the app shows offline and keeps the data", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.rateLimit(1);
    await refreshSix();
    expect(await screen.sourceState("SIX")).toBe("Tidak terhubung");
    expect(card("DK4073")).toContain("4/6");
  });
});

describe("Settings", () => {
  it("shows the SIX account, and signing out of SIX leaves Edunex", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click(/Dimas Pratama/);
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    await screen.click("Keluar dari SIX");
    expect(screen.has("Masuk ke SIX")).toBe(true);
    // Focus stays on the row's button (now "Masuk ke SIX"), not thrown to the dialog, so the list doesn't jump.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(document.activeElement?.textContent).toBe("Masuk ke SIX");
    expect(screen.has("Keluar dari Edunex")).toBe(true);
    expect(screen.vault.secrets.has("six.session")).toBe(false);
    expect(screen.vault.secrets.has("edunex.session")).toBe(true);
    // Back to Edunex's list: no SKS or attendance without SIX.
    expect(cards()).toHaveLength(5);
    expect(card("DK4073")).not.toContain("SKS");
    await screen.key("Escape");
    expect(await screen.sourceState("SIX")).toBe("Belum masuk");
  });

  it("connects SIX from Settings", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click(/Dimas Pratama/);
    await screen.click("Masuk ke SIX");
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    expect(screen.has("Keluar dari SIX")).toBe(true);
  });
});
