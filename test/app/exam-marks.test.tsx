// @vitest-environment jsdom
// "Tandai selesai" (Mark as done), seam 2: an Edunex exam open for days that
// the Student already took is the one thing about an exam no system tells the
// app. Moving it to Done, Undo, Move back, and Edunex moving the window, with
// the real engine and the pretend Edunex behind the bridge. No real Edunex exam
// record has been recorded (API.md), so the quiz follows the app's model of one.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryStorage } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

const NOW = "2026-10-22T14:10:00+07:00";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

/** DK4073's quiz on Edunex, open ten days; and PL3032's, open a week from Monday. */
function withQuizzes(end = "2026-10-30T23:59:00+07:00"): PretendWorld {
  const world = new PretendWorld({ now: NOW });
  world.edunex.exams.set(93409, [{ id: 88002, type: "exams", attributes: { name: "Kuis Brand Equity", start_at: "2026-10-19T08:00:00+07:00", end_at: end } }]);
  world.edunex.exams.set(95059, [
    { id: 88003, type: "exams", attributes: { name: "Kuis 1", start_at: "2026-10-26T08:00:00+07:00", end_at: "2026-11-01T23:59:00+07:00" } },
  ]);
  return world;
}
const open = async (options: Parameters<typeof openApp>[0] = {}) => {
  screen = await openApp({ world: withQuizzes(), signedIn: true, six: true, ...options });
  await screen.click(/^Tugas & Ujian\d*(, Perlu perhatianmu)?$/);
  return screen;
};
const rows = () => [...document.querySelectorAll<HTMLButtonElement>("main li > button")].map((b) => b.textContent ?? "");
const quizRow = () => rows().find((text) => text.includes("Kuis Brand Equity"));
const toastText = () => document.querySelector("[aria-live=polite]")?.textContent ?? "";
const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe("Mark as done on an Edunex exam open for days", () => {
  it("sits at its close like a deadline, with Mark as done beside it once it's open", async () => {
    const s = await open();
    expect(quizRow()).toContain("KuisKomunikasi Pemasaran");
    expect(quizRow()).toContain("DK4073 · Di Edunex · Kuis Brand Equity · Sudah bisa dikerjakan");
    expect(quizRow()).toContain("Jum, 30 Okt, 23:59");
    expect(s.has("Tandai Kuis Komunikasi Pemasaran selesai")).toBe(true);
    // Not open yet: nothing to mark, and it says when it opens.
    expect(rows().find((text) => text.includes("Kuis 1"))).toContain("Dibuka Sen, 26 Okt, 08:00");
    expect(s.has(/^Tandai Kuis Ekonomi Infrastruktur/)).toBe(false);
  });

  it("moves to Done with a toast and Undo; focus goes on to the next row; Undo brings it back", async () => {
    const s = await open();
    const before = s.button(/^Belum selesai/).textContent;
    const mark = s.button("Tandai Kuis Komunikasi Pemasaran selesai");
    mark.focus();
    await s.click(mark);
    await frame();
    expect(quizRow()).toBeUndefined();
    expect(toastText()).toContain("Dipindah ke Selesai");
    // Focus never falls to the page: it goes to the row that took the quiz's place.
    expect(document.activeElement?.closest("main li")).not.toBeNull();
    expect(Number(s.button(/^Belum selesai/).textContent?.match(/\d+/)?.[0])).toBe(Number(before?.match(/\d+/)?.[0]) - 1);
    expect(s.store.dataset("local.examMarks")?.value).toEqual([
      // Edunex's own id and the window it had, and when (the sync took a few seconds of the pretend clock).
      { id: "edunex-exam:88002", facts: `${Date.parse("2026-10-19T08:00:00+07:00")}|${Date.parse("2026-10-30T23:59:00+07:00")}`, at: expect.any(Number) },
    ]);
    expect(s.store.dataset("local.examMarks")?.value[0].at).toBeGreaterThanOrEqual(Date.parse(NOW));

    await s.click("Urungkan");
    expect(quizRow()).toBeDefined();
    expect(s.store.dataset("local.examMarks")?.value).toEqual([]);
  });

  it("in Done under Past exams it says when it was marked, with Move back", async () => {
    const s = await open();
    await s.click("Tandai Kuis Komunikasi Pemasaran selesai");
    await s.click(/^Selesai/);
    const past = [...document.querySelectorAll("main section")].find((section) =>
      section.querySelector("h2")?.textContent?.startsWith("Ujian yang sudah lewat"),
    );
    expect(past?.textContent).toContain("Ditandai 22 Okt");
    await s.click("Pindahkan Kuis Komunikasi Pemasaran ke Belum selesai");
    expect(toastText()).toContain("Kembali ke Belum selesai");
    await s.click(/^Belum selesai/);
    expect(quizRow()).toBeDefined();
  });

  it("when Edunex moves the window, the mark no longer holds: it's back in To do and says so", async () => {
    const s = await open();
    await s.click("Tandai Kuis Komunikasi Pemasaran selesai");
    expect(quizRow()).toBeUndefined();
    s.world.edunex.exams.set(93409, [
      { id: 88002, type: "exams", attributes: { name: "Kuis Brand Equity", start_at: "2026-10-19T08:00:00+07:00", end_at: "2026-11-03T23:59:00+07:00" } },
    ]);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(quizRow()).toContain("Edunex mengubah waktunya. Cek lagi.");
    expect(quizRow()).toContain("Sel, 3 Nov, 23:59");
  });

  it("drops off Beranda once marked, and the sidebar counts it no more", async () => {
    const s = await open();
    const badge = () => Number(s.button(/^Tugas & Ujian\d+/).textContent?.match(/\d+/)?.[0]);
    const count = badge();
    await s.click("Tandai Kuis Komunikasi Pemasaran selesai");
    expect(badge()).toBe(count - 1);
  });

  it("is kept on this computer: still marked after a restart; data saved before marks existed reads as none", async () => {
    const storage = new MemoryStorage();
    let s = await open({ storage });
    expect(s.store.dataset("local.examMarks")).toBeUndefined();
    await s.click("Tandai Kuis Komunikasi Pemasaran selesai");
    s.close();
    screen = null;
    s = await open({ storage });
    expect(quizRow()).toBeUndefined();
    await expect(s.engine.setLocal("local.examMarks", [{ id: "", facts: "x", at: 1 }])).rejects.toThrow(/valid local.examMarks/);
    await s.engineDoes(() => s.engine.signOut());
    expect(s.store.dataset("local.examMarks")).toBeUndefined();
  });

  it("speaks English", async () => {
    const s = await open();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(quizRow()).toContain("DK4073 · On Edunex · Kuis Brand Equity · Open now");
    await s.click("Mark Quiz Komunikasi Pemasaran as done");
    expect(toastText()).toContain("Moved to Done");
    await s.click(/^Done/);
    await s.click("Move Quiz Komunikasi Pemasaran back to To do");
    expect(toastText()).toContain("Back in To do");
  });
});
