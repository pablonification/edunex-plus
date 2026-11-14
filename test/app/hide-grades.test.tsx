// @vitest-environment jsdom
// "Sembunyikan nilai" on the desktop, as on the phone: with it on, Nilai, the planner, Kurikulum and a course's
// Nilai tab show dots or one quiet line where a grade, an IP or the IPK was, and a screen reader hears "disembunyikan";
// off, every figure is back. The eye beside the IPK and Settings' switch flip the one setting. The real window code on
// the real engine, with SIX's records read from the recorded pages.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { HIDDEN_FIGURE } from "../../src/core/hide-grades";
import { records } from "../engine/grades-records";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

let hash = 0;
async function inject(name: string, value: unknown) {
  await screen!.apply({ type: "dataset", dataset: { name: name as never, value: value as never, fetchedAt: 0, hash: `h${++hash}` } });
}

/** Signed in with the Student's SIX records; `hide`: grades hidden first. */
async function open({ hide }: { hide: boolean }) {
  screen = await openApp({ world: new PretendWorld({ now: "2026-10-11T09:00:00+07:00" }), signedIn: true });
  if (hide) await screen.engineDoes(() => screen!.engine.updateSettings({ hideGrades: true }));
  const data = await records();
  for (const [name, value] of [
    ["six.transcript", data.transcript],
    ["six.progress", data.progress],
    ["six.curriculum", data.curriculum],
    ["itb.catalog", data.catalog],
    ["itb.calendar", data.calendar],
  ] as const)
    await inject(name, value);
  return screen;
}

/** Radix tabs switch on mouse down, as a real click starts. */
async function tab(name: RegExp) {
  const trigger = [...document.querySelectorAll<HTMLElement>("main [role=tab]")].find((el) => name.test(el.textContent ?? ""));
  if (!trigger) throw new Error(`No tab ${String(name)}`);
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
  await screen!.wait(0);
}

const main = () => document.querySelector("main")?.textContent ?? "";
/** What a screen reader hears for each hidden figure. */
const said = () => [...document.querySelectorAll("main [role=img][aria-label]")].map((el) => el.getAttribute("aria-label"));
const standing = () => document.querySelector("main section[aria-label=Posisimu]")?.textContent ?? "";
const block = (title: RegExp) =>
  [...document.querySelectorAll<HTMLElement>("main section[aria-label]")].find((el) => title.test(el.getAttribute("aria-label") ?? ""));
const summary = () => document.querySelector("main [data-guide=plan]")?.textContent ?? "";
const row = (code: string) => [...document.querySelectorAll("main li")].find((li) => li.textContent?.startsWith(code))?.textContent;
const settings = () => screen!.engine.snapshot().settings;

describe("hiding grades on the desktop", () => {
  it("Nilai: dots in the IPK's place and each figure's, one quiet line for the grades, nothing a screen reader can read out", async () => {
    const s = await open({ hide: true });
    await s.click("Nilai");
    expect(standing()).not.toMatch(/\d,\d\d/);
    expect(standing()).toContain(HIDDEN_FIGURE);
    // SKS aren't a grade: they stay.
    expect(standing()).toContain("125");
    expect(said()).toEqual([
      "IPK disembunyikan",
      "Perkiraan saat lulus disembunyikan",
      "IP semester lalu disembunyikan",
      "IPK tertinggi yang mungkin disembunyikan",
    ]);
    // The honors word says where the IPK is: gone with it.
    expect(main()).not.toContain("Sangat memuaskan");
    // The chart, this term's grades and the transcript give way to one line and the way to show them.
    expect(main()).toContain("Nilai disembunyikan");
    expect(main()).not.toContain("IP dan IPK per semester");
    expect(main()).not.toContain("Transkrip");
    expect(main()).not.toMatch(/IP \d/);
  });

  it("Nilai: the eye beside the IPK shows every grade, and hides them again", async () => {
    const s = await open({ hide: true });
    await s.click("Nilai");
    await s.click(s.button("Tampilkan nilai"));
    expect(settings().hideGrades).toBe(false);
    expect(standing()).toContain("3,26");
    expect(standing()).toContain("Sangat memuaskan");
    expect(main()).toContain("Transkrip");
    expect(said()).toEqual([]);
    await s.click(s.button("Sembunyikan nilai"));
    expect(settings().hideGrades).toBe(true);
    expect(standing()).not.toContain("3,26");
    // The quiet line's own button shows them too.
    await s.click(s.button(/^Tampilkan nilai$/));
    expect(main()).toContain("IP dan IPK per semester");
  });

  it("off by default: Nilai shows the IPK and every grade as before", async () => {
    const s = await open({ hide: false });
    await s.click("Nilai");
    expect(standing()).toContain("3,26");
    expect(main()).toContain("IP 3,27");
    expect(main()).not.toContain(HIDDEN_FIGURE);
  });

  it("Rencana studi: the IPK at graduation, each semester's IP, the outlook and Kurikulum's grades are hidden; shown again when off", async () => {
    const s = await open({ hide: true });
    await s.click("Rencana studi");
    expect(summary()).toContain(`IPK saat lulus${HIDDEN_FIGURE}`);
    expect(summary()).not.toContain("Sangat memuaskan");
    expect(block(/^Semester 7 · sekarang/)?.textContent).not.toMatch(/IP \d|IPK jadi/);
    const past = s.button(/^Semester 1–6/);
    await s.click(past);
    const panel = document.getElementById(past.getAttribute("aria-controls")!)?.textContent ?? "";
    expect(panel).toContain(`IP ${HIDDEN_FIGURE}`);
    expect(panel).not.toMatch(/IP \d/);
    expect(past.textContent).not.toMatch(/\d,\d\d/);
    // The target stays the Student's to set; what it needs, the chart and the honors give way to one line.
    expect(main()).toContain("Target IPK");
    expect(main()).toContain("Nilai disembunyikan");
    expect(main()).not.toContain("IP dan IPK per semester");
    await tab(/^Kurikulum/);
    expect(row("MA1101")).toBe("MA1101Matematika ILulus4");

    await s.engineDoes(() => s.engine.updateSettings({ hideGrades: false }));
    expect(row("MA1101")).toBe("MA1101Matematika ILulus AB4");
    await tab(/^Rencana/);
    expect(summary()).toContain("IPK saat lulus3,30Sangat memuaskan");
    expect(block(/^Semester 7 · sekarang/)?.textContent).toContain("IP 3,50IPK jadi 3,29");
  });

  it("a course's Nilai tab: the calculator and Edunex's grade give way to one line", async () => {
    const s = await open({ hide: true });
    await s.click([...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"))!);
    await tab(/^Nilai/);
    expect(main()).toContain("Nilai disembunyikan");
    expect(main()).not.toContain("Nilai di Edunex");
    expect(document.querySelector("input[aria-label='Nilai UTS']")).toBeNull();
    await s.click(s.button(/^Tampilkan nilai$/));
    expect(main()).toContain("Nilai di Edunex");
  });

  it("Beranda and the bell: a new grade names its course only, never the grade or the IPK", async () => {
    const s = await open({ hide: true });
    const history = {
      readAt: 0,
      items: [
        {
          id: "grade:2026-1:PL3002:A",
          kind: "grade",
          source: "six",
          at: Date.parse("2026-10-11T08:30:00+07:00"),
          title: { key: "alert.grade.new", vars: { course: "PL3002", grade: "A" } },
          body: { key: "alert.grade.body", vars: { name: "Ekonomi dan Inovasi dalam Perencanaan", ipk: "3.42" } },
          target: { screen: "grades" },
        },
      ],
    };
    await inject("app.alerts", history);
    expect(main()).toContain("Nilai baru · PL3002");
    expect(main()).not.toMatch(/PL3002 · A|PL3002: A|3[,.]42/);
    await s.click(document.querySelector<HTMLButtonElement>("header button[aria-label*=otifikasi]")!);
    // Opening the bell marks it read and the engine sends its own history again: the grade goes in after that.
    await inject("app.alerts", history);
    const bell = document.querySelector("[role=dialog][aria-label=Notifikasi]")?.textContent ?? "";
    expect(bell).toContain("Nilai baru · PL3002");
    expect(bell).toContain("Ekonomi dan Inovasi dalam Perencanaan");
    expect(bell).not.toMatch(/PL3002: A|IPK sekarang|3[,.]42/);
  });

  it("Settings: the switch beside the theme and language hides and shows grades", async () => {
    const s = await open({ hide: false });
    await s.click(s.button(/Pengaturan/));
    const toggle = document.querySelector<HTMLButtonElement>("[role=switch][aria-label='Sembunyikan nilai']")!;
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await s.click(toggle);
    expect(settings().hideGrades).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });
});
