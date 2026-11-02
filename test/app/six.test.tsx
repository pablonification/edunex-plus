// @vitest-environment jsdom
// v2-08 (#76), seam 2: SIX in the window. The real engine reads the pretend
// Edunex and SIX behind the bridge; the tests look at what the Student sees.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
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
/** Beranda's "Mata kuliah semester ini", with what's said about it. */
const coursesSection = () => document.querySelector('main section[aria-labelledby="home-courses"]')?.textContent ?? "";
/** A screen still waiting for its data. */
const waiting = () => document.querySelector("main [aria-busy=true]") !== null;
/** How a first-run button looks: blue (press it), busy (dimmed behind its spinner), grey (can't run yet) or plain. */
const look = (name: string) => {
  const button = screen!.button(name);
  if (button.disabled) return button.className.includes("disabled:bg-edge") ? "grey" : "faded";
  if (button.getAttribute("aria-busy") === "true") return "busy";
  const classes = button.className.split(" ");
  const pill = classes.includes("welcome-pill") && !classes.includes("welcome-pill-quiet");
  return pill || classes.includes("bg-accent") ? "blue" : "plain";
};
/** What the top bar's status panel says about each system. */
const edunexLive = async () => expect(await screen!.sourceState("Edunex")).toBe("Terhubung");
const sixLive = async () => expect(await screen!.sourceState("SIX")).toBe("Terhubung");
/** SIX is read again (the status panel's "Perbarui sekarang" reads every source; here only SIX matters). */
const refreshSix = () => screen!.engineDoes(() => screen!.engine.refresh("six"));

describe("first run", () => {
  it("connects Edunex, then SIX, then shows this term's courses from SIX with SKS and attendance", async () => {
    screen = await openApp();
    await screen.click("Mulai");
    // Edunex's is the big button, and SIX's logo connects SIX first; nothing to continue to yet.
    expect(screen.button("Hubungkan Edunex").className).toContain("welcome-pill");
    expect(screen.has("Hubungkan SIX")).toBe(true);
    expect(screen.has("Lanjut")).toBe(false);

    await screen.click("Hubungkan Edunex");
    // Still welcoming: SIX is next, with the same Microsoft sign-in.
    expect(screen.text()).toContain("Dimas Pratama · 18223901");
    expect(screen.has("Hubungkan Edunex")).toBe(false);
    expect(screen.button("Lewati SIX").disabled).toBe(false);
    // SIX's is the big button now, as Edunex's was, with a quiet way to skip it beside it.
    expect(look("Hubungkan SIX")).toBe("blue");
    expect(screen.button("Lewati SIX").className).toContain("welcome-pill-quiet");
    expect(screen.text()).toContain("SIX bisa dihubungkan nanti dari Pengaturan");

    // While the Student is in SIX's sign-in window, its button is busy, not pressable again.
    const signedIn = screen.holdSignIn();
    await screen.click("Hubungkan SIX");
    expect(look("Hubungkan SIX")).toBe("busy");
    await screen.engineDoes(signedIn);
    expect(screen.calls.filter((c) => c.name === "auth.signIn").map((c) => c.input)).toEqual([{ source: "edunex" }, { source: "six" }]);
    expect(screen.text()).toContain("SIXSistem dan Teknologi Informasi");
    expect(screen.has("Hubungkan SIX")).toBe(false);
    // Connected says who, never still "waiting" (the audit's stale SIX line).
    expect(screen.text()).not.toContain("Masuk di jendela Microsoft");
    expect(screen.text()).not.toContain("Memeriksa…");

    await screen.click("Lanjut");
    // Moving on wipes the sign-in windows' Microsoft session.
    expect(screen.calls.some((c) => c.name === "auth.signInDone")).toBe(true);
    await screen.wait();
    await screen.click("Buka Edunex Plus");
    expect(screen.text()).toContain("Mata kuliah semester ini");
    expect(cards()).toHaveLength(5);
    expect(card("DK4073")).toContain("Komunikasi Pemasaran");
    expect(card("DK4073")).toContain("Kelas 01 · 3 SKS");
    expect(card("DK4073")).toContain("Terpakai 2× · habis");
    await edunexLive();
    await sixLive();
  });

  it("SIX can come first; continuing needs at least one system", async () => {
    screen = await openApp();
    await screen.click("Mulai");
    await screen.click("Hubungkan SIX");
    expect(screen.text()).toContain("SIXSistem dan Teknologi Informasi");
    expect(screen.has("Hubungkan Edunex")).toBe(true);
    await screen.click("Lewati Edunex");
    await screen.wait();
    await screen.click("Buka Edunex Plus");
    expect(cards()).toHaveLength(5);
    expect(card("PL3002")).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(card("PL3002")).toContain("Tidak ada di Edunex");
  });

  it("while Edunex's sign-in runs, SIX's logo waits instead of starting a second one", async () => {
    screen = await openApp();
    await screen.click("Mulai");
    const signedIn = screen.holdSignIn();
    await screen.click("Hubungkan Edunex");
    expect(look("Hubungkan SIX")).toBe("busy");
    await screen.click(screen.button("Hubungkan SIX"));
    await screen.engineDoes(signedIn);
    expect(screen.calls.filter((c) => c.name === "auth.signIn").map((c) => c.input)).toEqual([{ source: "edunex" }]);
  });

  it("closing the SIX sign-in window leaves SIX ready to try again", async () => {
    screen = await openApp({ signInWindow: "closes" });
    await screen.click("Mulai");
    await screen.click("Hubungkan SIX");
    expect(screen.button("Hubungkan SIX").disabled).toBe(false);
    expect(screen.has("Lanjut")).toBe(false);
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
      KU5014: ["Kelas 01 · 3 SKS", "Jatah absenTerpakai 4× · lewat batas 1×"],
      PL3002: ["Kelas 01 · 3 SKS", "Jatah absenTerpakai 1× · sisa 1×"],
      PL3032: ["Kelas 01 · 3 SKS", "Jatah absenTerpakai 3× · habis"],
    };
    for (const [code, facts] of Object.entries(expected)) for (const fact of facts) expect(card(code)).toContain(fact);
    // No share on a card: nothing that could seem to disagree with the bar.
    for (const text of cards()) {
      expect(text).not.toMatch(/\d+\/\d+/);
      // The only percent a card may name is the target.
      expect([...text.matchAll(/(\d+)%/g)].every((m) => m[1] === "80")).toBe(true);
    }
    // SIX's (Indonesian) names, and Edunex's course page for each.
    expect(card("PL3032")).toContain("Ekonomi Infrastruktur dan Transportasi");
    expect(screen.has("Buka di Edunex: PL3032")).toBe(true);
    // The bar's own name says the allowance; screen readers hear it.
    expect(meter("KU5014").label).toBe("Jatah absen semester ini 3×. Terpakai 4×, lewat batas 1×.");
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
    expect(card("PL3032")).toContain("Terpakai 3× · habis");
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

  it("an Edunex course stays when SIX's list left out a row it couldn't tell the course of: that row was probably it", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.changeLayout(/\/statusmhs$/, "<td>KU5014</td>", "<td>KU-5014</td>");
    await refreshSix();
    expect(cards().map((text) => text.slice(0, 6))).toEqual(["DK4073", "II4091", "PL3002", "PL3032", "KU5014"]);
    expect(card("KU5014")).toContain("Teknik Penyelesaian Masalah Terstruktur");
    expect(sidebar()).toContain("KU5014");
  });

  it("a detail SIX writes another way doesn't make its list incomplete: a course SIX doesn't list stays out", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.editPage(/\/statusmhs$/, (html) =>
      html
        .replace(/<tr>(?:(?!<\/tr>)[\s\S])*?<td>KU5014<\/td>[\s\S]*?<\/tr>/, "")
        .replace('<span title="Hadir 4 dari 6 pertemuan">66.67%</span>', '<span title="Hadir 4 dari 7 pertemuan, sakit 2">66.67% / 85.71%</span>'),
    );
    await refreshSix();
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
    expect(card("DK4073")).toContain("Terpakai 2× · habis");
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
    expect(card("PL3002")).toContain("Terpakai 1× · sisa 1×");
  });

  it("SIX changing something says so and keeps the last courses", async () => {
    screen = await openApp({ signedIn: true, six: true });
    // The course list's term: what the rest of SIX rests on.
    screen.world.six.changeLayout(/\/statusmhs$/, "Daftar Kuliah Semester 1-2026/2027", "Daftar Kuliah");
    await refreshSix();
    expect(screen.text()).toContain("SIX berubah");
    expect(screen.text()).toContain("SIX mengirim data yang tidak dikenali.");
    expect(card("DK4073")).toContain("Terpakai 2× · habis");
    await edunexLive();
  });

  // #278, #279: SIX makes a new Student fill in Pengkinian Data Induk first, and sends every page to that form.
  it("SIX wanting the Student to update their personal data first says what to do there, opens SIX, and reads again once done", async () => {
    const world = new PretendWorld();
    world.six.requireDataInduk();
    screen = await openApp({ world, signedIn: true, six: true });
    expect(screen.text()).toContain(
      "SIX minta kamu memperbarui data diri dulu. Isi Pengkinian Data Induk di SIX, lalu kembali ke sini. Aplikasi membaca SIX lagi sendiri.",
    );
    // Not SIX changing: nothing to report.
    expect(screen.text()).not.toContain("SIX berubah");
    expect(screen.has("Laporkan")).toBe(false);
    expect(screen.button(/^Status data:/).getAttribute("aria-label")).toBe("Status data: SIX menunggumu");
    expect(await screen.sourceState("SIX")).toBe("Menunggumu");
    await edunexLive();
    // SIX was never read: its status page by Edunex's NIM, which SIX sends on to the form.
    await screen.click("Buka SIX");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs" } });
    // Settings says it on SIX's row, still signed in.
    await screen.click(/Dimas Pratama/);
    expect(screen.text()).toContain("Menunggumu · isi Pengkinian Data Induk di SIX");
    expect(screen.has("Keluar dari SIX")).toBe(true);
    await screen.key("Escape");

    // Done on SIX, back in the app.
    screen.world.six.requireDataInduk(false);
    await screen.click("Coba lagi");
    expect(screen.text()).not.toContain("Pengkinian Data Induk");
    await sixLive();
    expect(card("DK4073")).toContain("Terpakai 2× · habis");
  });

  it("in English, SIX waiting for the Student says so in English", async () => {
    const world = new PretendWorld();
    world.six.requireDataInduk();
    screen = await openApp({ world, signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    expect(screen.text()).toContain(
      "SIX wants you to update your personal details first. Fill in Pengkinian Data Induk on SIX, then come back. The app reads SIX again on its own.",
    );
    expect(screen.has("Open SIX")).toBe(true);
    expect(await screen.sourceState("SIX")).toBe("Waiting for you");
  });

  it("SIX rate-limiting the app shows offline and keeps the data", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.rateLimit(1);
    await refreshSix();
    expect(await screen.sourceState("SIX")).toBe("Tidak terhubung");
    expect(card("DK4073")).toContain("Terpakai 2× · habis");
  });
});

describe("SIX's course table changing on its own", () => {
  it("says so where the courses are listed and keeps the last ones; the rest of SIX reads on", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.joinCodeAndName();
    await refreshSix();
    expect(screen.text()).not.toContain("SIX berubah");
    await sixLive();
    expect(coursesSection()).toMatch(/SIX mengubah halaman iniData dari .+ tetap ditampilkan\.Buka di SIX/);
    expect(card("DK4073")).toContain("Terpakai 2× · habis");
    await screen.click("Presensi");
    expect(screen.text()).toMatch(/SIX mengubah halaman iniData dari .+ tetap ditampilkan\.Buka di SIX/);
    // Its report sends the status page.
    await screen.click("Laporkan masalah");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("SIX mengubah halaman status mahasiswaHalaman ini ikut dikirim.");
    await screen.key("Escape");
    for (const other of ["Jadwal", "Nilai"]) {
      await screen.click(other);
      expect(screen.text(), other).not.toContain("SIX mengubah halaman ini");
    }
  });

  it("never read: Edunex's courses of SIX's term show, without SIX's details, and the list says why", async () => {
    const world = new PretendWorld();
    world.six.joinCodeAndName();
    world.edunex.pairs = world.edunex.pairs.map((pair: { course_code: string }) =>
      pair.course_code === "PL3032" ? { ...pair, year: "2025", semester: "2" } : pair,
    );
    screen = await openApp({ world, signedIn: true, six: true });
    expect(cards().map((text) => text.slice(0, 6))).toEqual(["DK4073", "II4091", "KU5014", "PL3002"]);
    expect(card("DK4073")).toContain("Kelas 01");
    expect(card("DK4073")).not.toContain("SKS");
    expect(coursesSection()).toContain("SIX mengubah halaman iniBagian ini belum bisa dibaca dari SIX.");
    await sixLive();
  });

  it("never read, with only SIX connected: the screens say so instead of waiting, or of saying there are no courses", async () => {
    const world = new PretendWorld();
    world.six.joinCodeAndName();
    screen = await openApp({ world, six: true });
    expect(waiting()).toBe(false);
    expect(coursesSection()).toBe("Mata kuliah semester iniSIX mengubah halaman iniBagian ini belum bisa dibaca dari SIX.Buka di SIXLaporkan");
    await screen.click("Presensi");
    expect(waiting()).toBe(false);
    expect(screen.text()).toContain("SIX mengubah halaman iniBagian ini belum bisa dibaca dari SIX.");
    expect(screen.text()).not.toContain("Belum ada mata kuliah semester ini");
  });

  it("without an attendance column: every course stays, and Presensi says that detail is left blank, once", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.six.editPage(/\/statusmhs$/, (html) =>
      html.replace('<th class="text-right">Kehadiran</th>', "").replace(/<td class="text-right">[\s\S]*?<\/td>/g, ""),
    );
    await refreshSix();
    expect(cards()).toHaveLength(5);
    await screen.click(/^Presensi/);
    expect(screen.text()).toContain("1 baris belum terbaca utuhSebagian isinya belum ditampilkan di sini. Cek di SIX.Kode · Mata Kuliah · Kelas · SKS · Nilai");
    expect(screen.text()).not.toContain("belum dikenali");
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
