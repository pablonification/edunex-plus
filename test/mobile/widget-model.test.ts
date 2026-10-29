// The phone's home-screen widget (mobile/src/widget/model.ts): what it says, from the real engine's
// snapshot against the pretend Edunex and SIX, in the tray menu's words (test/desktop/tray-menu.test.ts
// has the same Thursday 8 October: PL3002 08:00–10:00 counted in SIX, DK4073 at 11:00, II4091's
// online meeting on Friday 15:00).
import { describe, expect, it } from "vitest";
import { type WidgetModel, widgetModel } from "../../mobile/src/widget/model";
import { startEngine } from "../engine/harness";
import { startHome } from "../engine/needs-harness";

type Home = Awaited<ReturnType<typeof startHome>>;
const modelOf = (h: Pick<Home, "engine" | "world">): WidgetModel => widgetModel(h.engine.snapshot(), h.world.clock.now());

describe("the widget", () => {
  it("the class on now: its time, room, code and name, opening the course's meetings; the widget turns over when the card does", async () => {
    const h = await startHome();
    const model = modelOf(h);
    expect(model.now).toMatchObject({
      heading: "Sedang berlangsung",
      live: true,
      code: "PL3002",
      time: "08:00–10:00",
      where: "R.SG PWK LT.6",
      open: { kind: "route", route: { screen: "course", code: "PL3002", tab: "meetings" } },
    });
    expect(model.now && "tone" in model.now && model.now.tone).toMatch(/^var\(--course-[a-z]+\)$/);
    // Edunex's Presence window for it closes first (09:30), then the class ends (10:00).
    expect(model.changesAt).toBe(Date.parse("2026-10-08T09:30:00+07:00"));
    // SIX counts PL3002: nothing to press until SIX shows its button.
    expect(model.actions).toEqual([]);
    expect(model.status).toEqual({ text: expect.stringMatching(/^Diperbarui pukul \d\d:\d\d$/), problem: false });
  });

  it("the next class, today or tomorrow", async () => {
    const h = await startHome();
    await h.until("2026-10-08T10:30:00+07:00");
    expect(modelOf(h).now).toMatchObject({ heading: "Kuliah berikutnya · Hari ini", live: false, code: "DK4073", time: "11:00–12:59" });
    await h.until("2026-10-08T18:00:00+07:00");
    expect(modelOf(h).now).toMatchObject({ heading: "Kuliah berikutnya · Besok", code: "II4091", where: "Pertemuan 3 · daring" });
  });

  it("Tandai Hadir open in SIX: the first thing to press, opening SIX's check-in page on the class", async () => {
    const h = await startHome();
    h.world.six.openCheckIn("2194342");
    await h.until("2026-10-08T08:40:00+07:00");
    expect(modelOf(h).actions).toEqual([
      {
        label: "Tandai Hadir sudah dibuka di SIX",
        detail: "PL3002",
        a11y: "Buka di SIX untuk Tandai Hadir di PL3002",
        open: { kind: "checkIn", meetingId: "2194342" },
      },
    ]);
  });

  it("Perlu perhatianmu: every item the tray lists, in its words and order, each opening its screen", async () => {
    const h = await startHome();
    h.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    await h.refresh();
    const needs = modelOf(h).needs;
    expect(needs?.heading).toBe("Perlu perhatianmu");
    const first = needs?.items.find((item) => item.label === "Ringkasan K5");
    expect(first?.detail).toMatch(/^[A-Z]{2}\d{4} · /);
    expect(first?.open).toMatchObject({ kind: "route", route: { screen: "task" } });
    expect(needs?.all?.label).toBe(`Lihat semua ${needs?.items.length} di Beranda`);
  });

  it("in English, and dark or light as the Student chose in the app", async () => {
    const h = await startHome();
    await h.engine.updateSettings({ lang: "en", theme: "dark" });
    const model = modelOf(h);
    expect(model.theme).toBe("dark");
    expect(model.now).toMatchObject({ heading: "On now" });
    expect(model.needs?.heading).toBe("Needs you");
  });

  it("never signed in: where to start, and nothing else", async () => {
    const h = await startEngine();
    const model = modelOf(h);
    expect(model.status).toEqual({ text: "Hubungkan Edunex atau SIX dulu", problem: true });
    expect([model.now, model.actions, model.needs]).toEqual([null, [], null]);
  });
});
