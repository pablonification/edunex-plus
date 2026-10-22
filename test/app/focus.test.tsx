// @vitest-environment jsdom
// Keyboard use: a dialog or panel closed with Escape puts focus back on what
// opened it, so the next Tab carries on from there instead of the top of the page;
// a button that goes once pressed hands focus on instead of dropping it; a new
// screen opened from inside the last one takes focus on its title; a button that
// can't run just now (busy, at its limit) keeps focus.
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { finishLeaving, playCssAnimations } from "./fake-animations";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
  vi.restoreAllMocks();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

async function openAndEscape(opener: HTMLElement) {
  opener.focus();
  await screen!.click(opener);
  expect(document.querySelector("[role=dialog]")).not.toBeNull();
  await screen!.key("Escape");
  await tick();
  expect(document.querySelector("[role=dialog]")).toBeNull();
}

describe("focus after closing", () => {
  it("Settings, opened from the sidebar, gives focus back to its button", async () => {
    screen = await openApp({ signedIn: true });
    const opener = screen.button(/Pengaturan$/);
    await openAndEscape(opener);
    expect(document.activeElement).toBe(opener);
  });

  it("search gives focus back to the search button", async () => {
    screen = await openApp({ signedIn: true });
    const opener = screen.button("Cari");
    await openAndEscape(opener);
    expect(document.activeElement).toBe(opener);
  });

  it("the phone-calendar dialog gives focus back to its button", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click(/^Jadwal$/);
    const opener = screen.button(/kalender HP/);
    await openAndEscape(opener);
    expect(document.activeElement).toBe(opener);
  });
});

describe("focus when the focused control goes", () => {
  const rows = () => [...document.querySelectorAll('main ul[aria-label="Mata kuliah"] > li')].map((li) => li.textContent?.slice(0, 6));

  it("a course's target, back to the default from its panel: the panel closes and focus is on its button again", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ attendanceTargets: { DK4073: 75 } }));
    await screen.click(/^Presensi/);
    const opener = screen.button("Target 75% untuk DK4073");
    opener.focus();
    await screen.click(opener);
    await screen.click("Pakai target umum (80%)");
    await tick();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(screen.engine.snapshot().settings.attendanceTargets).toEqual({});
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Target 80% untuk DK4073");
  });

  it("the default target, back to 80% from Presensi's panel: the panel closes and focus is on its button again", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ attendanceTarget: 75 }));
    await screen.click(/^Presensi/);
    const opener = screen.button("Target semua mata kuliah: 75%");
    opener.focus();
    await screen.click(opener);
    await screen.click("Kembali ke 80%");
    await tick();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(document.activeElement?.textContent).toBe("Target semua mata kuliah: 80%");
  });

  it("Presensi's rows hold still while a course's target is being changed, and sort again once it closes", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click(/^Presensi/);
    const before = rows();
    expect(before.indexOf("DK4073")).toBeLessThan(before.indexOf("PL3032"));
    const opener = screen.button("Target 80% untuk DK4073");
    opener.focus();
    await screen.click(opener);
    // 75%: one absence left, so DK4073 would sort below PL3032 (none left).
    await screen.click("Turunkan target DK4073");
    expect(rows()).toEqual(before);
    await screen.key("Escape");
    await tick();
    const after = rows();
    expect(after.indexOf("DK4073")).toBeGreaterThan(after.indexOf("PL3032"));
  });

  it("Settings: a course back to the default gives focus to the next course's, then to the default's stepper", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ attendanceTargets: { DK4073: 75, PL3032: 85 } }));
    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Pakai target umum untuk DK4073");
    expect(screen.engine.snapshot().settings.attendanceTargets).toEqual({ PL3032: 85 });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Pakai target umum untuk PL3032");
    await screen.click("Pakai target umum untuk PL3032");
    expect(screen.engine.snapshot().settings.attendanceTargets).toEqual({});
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Turunkan target umum");
  });
});

describe("focus when the screen changes", () => {
  /** Two frames: the new screen draws, then focus is looked at (as refocus does). */
  const frames = () => act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

  it("a row that opens a Task: focus goes to the Task's title, not to the page", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click(/^Tugas & Ujian/);
    const row = screen.button(/^Tugas 02 Bab II/);
    row.focus();
    await screen.click(row);
    await frames();
    const title = document.querySelector<HTMLElement>("main h1");
    expect(title?.textContent).toBe("Tugas 02 Bab II");
    expect(document.activeElement).toBe(title);
    // A heading, not a control: reachable by script only, never a Tab stop of its own.
    expect(title?.tabIndex).toBe(-1);
  });

  it("Back between two detail screens: it stays in the top bar, and focus goes to the title it returns to", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click(/^Tugas & Ujian/);
    const exam = [...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.includes("Komunikasi Pemasaran"));
    await screen.click(exam!);
    await frames();
    const examTitle = document.querySelector("main h1")?.textContent;
    await screen.click(screen.button(/Buka tugas/));
    await frames();
    expect(document.querySelector("main h1")?.textContent).not.toBe(examTitle);
    const back = screen.button(/^Kembali ke/);
    back.focus();
    await screen.click(back);
    await frames();
    const title = document.querySelector<HTMLElement>("main h1");
    expect(title?.textContent).toBe(examTitle);
    expect(screen.has(/^Kembali ke/)).toBe(true);
    expect(document.activeElement).toBe(title);
  });

  it("a screen picked in the sidebar leaves focus in the sidebar", async () => {
    screen = await openApp({ signedIn: true });
    const nav = screen.button(/^Jadwal/);
    nav.focus();
    await screen.click(nav);
    await frames();
    expect(document.activeElement).toBe(nav);
  });
});

describe("a control that can't run just now keeps focus", () => {
  it("Perbarui sekarang, pressed from the keyboard, stays focused while it works", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.click(/^Status data:/);
    const refresh = screen.button("Perbarui sekarang");
    refresh.focus();
    await act(async () => refresh.click());
    for (let i = 0; i < 20; i++) await act(async () => new Promise((resolve) => setImmediate(resolve)));
    expect(refresh.textContent).toBe("Memperbarui…");
    expect(refresh.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(refresh);
  });

  it("a target stepped down to its floor keeps focus on its − button, which then changes nothing", async () => {
    screen = await openApp({ signedIn: true, six: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ attendanceTarget: 55 }));
    await screen.apply({ type: "command", command: "settings" });
    const lower = screen.button("Turunkan target umum");
    lower.focus();
    await screen.click(lower);
    expect(screen.engine.snapshot().settings.attendanceTarget).toBe(50);
    expect(lower.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(lower);
    await screen.click(lower);
    expect(screen.engine.snapshot().settings.attendanceTarget).toBe(50);
  });
});

describe("a question before something final", () => {
  it("takes no click beside it as an answer, starts on Cancel, and Escape gives focus back to the button that asked", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click(/Dimas Pratama/);
    const row = [...document.querySelectorAll("[role=dialog] div")].find((el) => el.textContent?.startsWith("Keluar dari semua akun"));
    const asker = row!.querySelector("button")!;
    asker.focus();
    await screen.click(asker);
    const question = () => document.querySelector("[role=alertdialog]");
    expect(question()?.textContent).toContain("Keluar dan hapus semua data?");
    await tick();
    expect(document.activeElement?.textContent).toBe("Batal");

    // A click on the dimmed window around it.
    const scrim = question()!.previousElementSibling as HTMLElement;
    scrim.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    scrim.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    scrim.click();
    await tick();
    expect(question()).not.toBeNull();

    await screen.key("Escape");
    await tick();
    expect(question()).toBeNull();
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(document.activeElement).toBe(asker);
    expect(screen.vault.secrets.size).toBe(1);
  });
});

describe("a question that leaves the way it came", () => {
  it("hands a Task in once, however fast the second click on Kumpulkan", async () => {
    playCssAnimations();
    screen = await openApp({ signedIn: true });
    await screen.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
    await screen.click(/^Tugas 02 Bab II/);
    await screen.write("<p>Berikut jawaban saya.</p>");
    screen.willPick([{ name: "Bab II.pdf" }]);
    await screen.click(/^Lampirkan berkas/);
    await screen.click("Kumpulkan");
    const question = document.querySelector<HTMLElement>("[role=alertdialog]")!;
    const yes = [...question.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Kumpulkan"))!;

    await screen.click(yes);
    // Handed in: the question is on its way out, still on screen, and the second click lands on it.
    expect(question.isConnected && question.dataset.state).toBe("closed");
    await screen.click(yes);
    expect(screen.calls.filter((call) => call.name === "tasks.submit")).toHaveLength(1);

    await finishLeaving(question);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
  });
});
