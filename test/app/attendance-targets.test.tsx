// @vitest-environment jsdom
// #85, feedback 7: a course's own attendance target (its course contract), as
// the Student sets and reads it: on the course page, then the same everywhere
// (Beranda, Presensi, Settings), with the default for every other course.
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const card = (code: string) =>
  [...document.querySelectorAll('main section[aria-labelledby="home-courses"] ul > li')].find((li) => li.textContent?.startsWith(code))?.textContent ?? "";
const todayRow = (start: string) =>
  [...document.querySelectorAll('main section[aria-labelledby="home-today"] li')].map((li) => li.textContent ?? "").find((text) => text.startsWith(start)) ??
  "";
const presenceRow = (code: string) =>
  [...document.querySelectorAll("main section[aria-labelledby^=presence-] ul > li")].find((li) => li.textContent?.startsWith(code))?.textContent ?? "";
const header = () => document.querySelector("main header")?.textContent ?? "";
const dialog = () => document.querySelector("[role=dialog]")?.textContent ?? "";
/** The course page's banner, by its one action. */
const banner = () =>
  [...document.querySelectorAll("main button")].find((b) => b.textContent === "Ke Presensi")?.parentElement?.parentElement?.textContent ?? "";

async function openCourse(code: string) {
  await screen!.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith(code))!);
}

describe("a course's own attendance target", () => {
  it("set on the course page, read the same on Beranda and Presensi, listed in Settings, and back to the default from there", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    // DK4073: 4 of 6 with 8 to go (today 11:00 among them). At the default 80%: no absences left.
    expect(card("DK4073")).toContain("Jatah absenTerpakai 2× · habis");
    expect(todayRow("11:00")).toContain("Jatah absen habis");

    await openCourse("DK4073");
    // The bar and its words stay while the banner shows: the banner says what to do, the bar how far. The share, labeled, only here.
    expect(header()).toContain("Jatah absenTerpakai 2× · habisKehadiran 66% sejauh ini (4 dari 6)Target 80%");
    // The banner says what "no absences left" means: every meeting to the last lecture day (November's are the weekly slot carried on).
    expect(banner()).toContain("Jatah absen habisSekitar 8 pertemuan lagi sampai 4 Des. Hadiri semuanya agar tetap 80%.");
    // Its course contract asks for 75%.
    await s.click("Target 80% untuk DK4073");
    expect(dialog()).toContain("Target kehadiran DK4073");
    expect(dialog()).toContain("Sekarang ikut target umum.");
    await s.click("Turunkan target DK4073");
    expect(s.engine.snapshot().settings).toMatchObject({ attendanceTarget: 80, attendanceTargets: { DK4073: 75 } });
    expect(dialog()).toContain("Target khusus mata kuliah ini.");
    await s.key("Escape");
    // One absence left now: the bar says it; a banner is only for no room at all.
    expect(header()).toContain("Jatah absenTerpakai 2× · sisa 1× · target 75%Kehadiran 66% sejauh ini (4 dari 6)Target 75%");
    expect(banner()).toBe("");

    await s.click(/^Beranda/);
    expect(card("DK4073")).toContain("Terpakai 2× · sisa 1×");
    // An absence to spare is no line under today's class.
    expect(todayRow("11:00")).not.toContain("Jatah absen");
    // Every other course keeps the default.
    expect(card("PL3032")).toContain("Terpakai 3× · habis");

    await s.click(/^Presensi/);
    expect(presenceRow("DK4073")).toContain("Terpakai 2× · sisa 1× · target 75%");
    expect(presenceRow("PL3032")).toContain("Terpakai 3× · habis");
    expect(presenceRow("PL3032")).not.toContain("target");

    await s.apply({ type: "command", command: "settings" });
    expect(dialog()).toContain("Target kehadiranUntuk mata kuliah tanpa target sendiri");
    expect(dialog()).toContain("Komunikasi PemasaranDK4073 · target sendiriPakai target umum75%");
    // Meta's facts, so the dot can't end a line.
    expect([...document.querySelectorAll("[role=dialog] [data-fact] > :last-child")].map((fact) => fact.textContent)).toContain("target sendiri");
    // Each stepper says whose target it changes.
    expect(s.has("Naikkan target umum")).toBe(true);
    expect(s.has("Naikkan target DK4073")).toBe(true);
    await s.click("Pakai target umum untuk DK4073");
    expect(s.engine.snapshot().settings.attendanceTargets).toEqual({});
    expect(dialog()).not.toContain("DK4073 · target sendiri");
    await s.key("Escape");
    expect(presenceRow("DK4073")).toContain("Terpakai 2× · habis");
  });

  it("in English", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en", attendanceTargets: { DK4073: 75 } }));
    await openCourse("DK4073");
    expect(header()).toContain("Absences2 used · 1 left · target 75%66% attended so far (4 of 6)Target 75%");
    await screen.click("Target 75% for DK4073");
    expect(dialog()).toContain("DK4073 attendance target");
    expect(dialog()).toContain("Use the default (80%)");
  });
});
