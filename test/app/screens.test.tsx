// @vitest-environment jsdom
// v2-03 (#71), seam 2: what the Student sees and can do in the window, with
// the real engine and the pretend EduNex behind the bridge.
import { afterEach, describe, expect, it, vi } from "vitest";
import { openApp } from "./harness";

const COURSES = [
  ["DK4073", "Marketing Communication"],
  ["II4091", "Final Project Proposal"],
  ["KU5014", "Teknik Penyelesaian Masalah Terstruktur"],
  ["PL3002", "Economics and Innovation in Planning"],
  ["PL3032", "Infrastructure and Transportation Economics"],
];

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** Beranda's course cards (the other lists on Beranda are rows). */
const cards = () => [...document.querySelectorAll('main section[aria-labelledby="home-courses"] ul > li')].map((li) => li.textContent ?? "");
/** The top bar's status panel says EduNex is connected. */
const live = async () => expect(await screen!.sourceState("EduNex")).toBe("Terhubung");

describe("first run", () => {
  it("welcomes the Student, and connecting EduNex shows their courses", async () => {
    screen = await openApp();
    expect(screen.text()).toContain("Selamat datang di Edunex Plus");
    await screen.click("Hubungkan EduNex");
    expect(screen.calls.some((c) => c.name === "auth.signIn")).toBe(true);
    // The welcome stays, so SIX can be connected next (#76); the Student moves on when ready.
    await screen.click("Lanjut");
    expect(screen.text()).toContain("Mata kuliah semester ini");
    expect(cards()).toHaveLength(5);
    for (const [code, name] of COURSES) {
      expect(screen.text()).toContain(code);
      expect(screen.text()).toContain(name);
    }
    await live();
  });

  it("closing the sign-in window leaves the welcome screen ready to try again", async () => {
    screen = await openApp({ signInWindow: "closes" });
    await screen.click("Hubungkan EduNex");
    expect(screen.text()).toContain("Selamat datang di Edunex Plus");
    expect(screen.button("Hubungkan EduNex").disabled).toBe(false);
  });

  it("speaks English before signing in, if asked", async () => {
    screen = await openApp();
    await screen.click("English");
    expect(screen.text()).toContain("Welcome to Edunex Plus");
    expect(screen.has("Connect EduNex")).toBe(true);
  });

  it("says so when this computer can't keep the session safely", async () => {
    screen = await openApp({ vaultMode: "memory" });
    expect(screen.text()).toContain("Komputer ini tidak punya penyimpanan aman");
  });
});

describe("Home", () => {
  it("greets the Student by name and lists this term's EduNex courses, the parent class merged", async () => {
    screen = await openApp({ signedIn: true });
    expect(screen.text()).toContain("Kamis, 8 Oktober · Semester 1 2026/2027");
    expect(screen.text()).toContain("Selamat pagi, Dimas");
    expect(cards().map((card) => card.slice(0, 6))).toEqual(COURSES.map(([code]) => code));
    expect(cards().every((card) => card.includes("Kelas 01"))).toBe(true);
    expect(screen.text()).not.toContain("[Parent Class]");
    await live();
  });

  it("opens a course on EduNex's website", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Buka di EduNex: PL3002");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("after a restart shows the saved courses at once, while the session is checked", async () => {
    const before = await openApp({ signedIn: true });
    before.close();
    before.world.setOffline(true);
    screen = await openApp({ world: before.world, storage: before.storage, vault: before.vault, start: false });
    // No request has been answered yet: everything on screen is saved data.
    expect(cards()).toHaveLength(5);
    expect(await screen.sourceState("EduNex")).toBe("Memeriksa…");
    await screen.engineDoes(async () => screen?.engine.start());
    await screen.wait();
    expect(await screen.sourceState("EduNex")).toBe("Offline");
    // Nothing reaches the network: the whole window says so, with the time of the last data.
    expect(screen.text()).toContain("Tidak ada koneksi.");
    expect(cards()).toHaveLength(5);
  });

  it("when EduNex ends the session, the courses stay and the window asks to sign in again", async () => {
    screen = await openApp({ signedIn: true });
    screen.world.edunex.expireSession();
    await screen.engineDoes(async () => screen?.engine.refresh("edunex"));
    expect(screen.text()).toContain("Sesi EduNex berakhir. Data terakhir tetap bisa dibaca.");
    expect(cards()).toHaveLength(5);
    screen.world.edunex.sessionValid = true;
    await screen.click("Masuk lagi");
    expect(screen.text()).not.toContain("Sesi EduNex berakhir");
    await live();
  });

  it("saved courses without a session (a computer that can't keep sessions) stay readable, with Sign in", async () => {
    const before = await openApp({ signedIn: true });
    before.close();
    before.vault.secrets.clear();
    screen = await openApp({ world: before.world, storage: before.storage, vault: before.vault });
    expect(cards()).toHaveLength(5);
    expect(screen.text()).toContain("Kamu belum masuk ke EduNex. Data terakhir tetap bisa dibaca.");
    await screen.click("Masuk ke EduNex");
    expect(screen.text()).not.toContain("Kamu belum masuk ke EduNex");
    await live();
  });

  it("when EduNex changes something, the window says so and keeps the last courses", async () => {
    screen = await openApp({ signedIn: true });
    screen.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "missing-field", field: "course_code" });
    await screen.engineDoes(async () => screen?.engine.refresh("edunex"));
    expect(screen.text()).toContain("EduNex berubah");
    expect(cards()).toHaveLength(5);
  });
});

describe("Settings", () => {
  it("switches language and theme, and remembers them", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click(/Dimas Pratama/);
    expect(screen.text()).toContain("Pengaturan");
    await screen.click("English");
    expect(screen.text()).toContain("Courses this semester");
    await screen.click("Dark");
    expect(screen.button("Dark").getAttribute("aria-checked")).toBe("true");
    expect(screen.engine.snapshot().settings).toMatchObject({ theme: "dark", lang: "en" });
  });

  it("Sign out of everything asks first, then removes every trace and returns to the welcome screen", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click(/Dimas Pratama/);
    const row = [...document.querySelectorAll("[role=dialog] div")].find((el) => el.textContent?.startsWith("Keluar dari semua akun"));
    await screen.click(row!.querySelector("button")!);
    const confirm = document.querySelector("[role=alertdialog]");
    expect(confirm?.textContent).toContain("Keluar dan hapus semua data?");
    expect(screen.vault.secrets.size).toBe(1);
    await screen.click([...confirm!.querySelectorAll("button")].find((b) => b.textContent === "Keluar & hapus data")!);
    expect(screen.text()).toContain("Selamat datang di Edunex Plus");
    expect(screen.vault.secrets.size).toBe(0);
    expect(screen.engine.snapshot().datasets).toEqual([]);
  });
});

describe("crash guard", () => {
  it("a panel that breaks shows an error and a way back, never a blank window", async () => {
    screen = await openApp({ signedIn: true });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const good = screen.store.dataset("edunex.courses")!;
    await screen.apply({ type: "dataset", dataset: { ...good, value: { not: "a list" }, hash: "broken" } });
    expect(screen.text()).toContain("Bagian ini gagal ditampilkan");
    // The rest of the window keeps working.
    await live();
    await screen.apply({ type: "dataset", dataset: good });
    for (const retry of [...document.querySelectorAll("button")].filter((b) => b.textContent === "Coba lagi")) await screen.click(retry);
    expect(screen.text()).not.toContain("Bagian ini gagal ditampilkan");
    expect(cards()).toHaveLength(5);
    quiet.mockRestore();
  });
});
