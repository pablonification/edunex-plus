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
    // PL3002's Edunex Presence is open: something to do, never optional, even where SIX counts too (#294).
    expect(model.actions).toEqual([
      {
        label: "Isi Presensi PL3002",
        // The button's word: the class is named right above it.
        short: "Isi Presensi",
        detail: "Tutup 09:30",
        open: { kind: "url", url: "https://edunex.itb.ac.id/courses/95001" },
      },
    ]);
    expect(model.status).toEqual({ text: expect.stringMatching(/^Diperbarui \d\d:\d\d$/), problem: false });
  });

  it("the next class, today or tomorrow", async () => {
    const h = await startHome();
    await h.until("2026-10-08T10:30:00+07:00");
    expect(modelOf(h).now).toMatchObject({ heading: "Kuliah berikutnya · Hari ini", live: false, code: "DK4073", time: "11:00–12:59" });
    await h.until("2026-10-08T18:00:00+07:00");
    expect(modelOf(h).now).toMatchObject({ heading: "Kuliah berikutnya · Besok", code: "II4091", where: "Pertemuan 3 · daring" });
  });

  it("Tandai Hadir open in SIX: the first thing to press, opening SIX's check-in page on the class, then the Presence", async () => {
    const h = await startHome();
    h.world.six.openCheckIn("2194342");
    await h.until("2026-10-08T08:40:00+07:00");
    expect(modelOf(h).actions).toEqual([
      {
        label: "Tandai Hadir sudah dibuka di SIX",
        short: "Tandai Hadir",
        detail: "PL3002",
        a11y: "Buka di SIX untuk Tandai Hadir di PL3002",
        open: { kind: "checkIn", meetingId: "2194342" },
      },
      // Then the class's open Edunex Presence, as the tray lists it.
      {
        label: "Isi Presensi PL3002",
        // The button's word: the class is named right above it.
        short: "Isi Presensi",
        detail: "Tutup 09:30",
        open: { kind: "url", url: "https://edunex.itb.ac.id/courses/95001" },
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

  it("Hari ini: today's classes in time order, the one on now marked, each opening its sheet; then the next deadline", async () => {
    const h = await startHome();
    const today = modelOf(h).today;
    expect(today?.heading).toBe("Hari ini · Kam 8 Okt");
    expect(today?.classes.map(({ time, code, room, live, past }) => ({ time, code, room, live, past }))).toEqual([
      { time: "08:00–10:00", code: "PL3002", room: "R.SG PWK LT.6", live: true, past: false },
      { time: "11:00–12:59", code: "DK4073", room: "TVST C", live: false, past: false },
      { time: "15:00–16:30", code: "PL3032", room: "R.SG PWK LT.6", live: false, past: false },
      { time: "16:00–17:50", code: "KU5014", room: "R. 9134", live: false, past: false },
    ]);
    expect(today?.classes[0]?.open).toEqual({ kind: "class", sessionId: expect.any(String) });
    // A row calls its course by name, whole; the code is the short form.
    expect(today?.classes[0]).toMatchObject({ code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan" });
    expect(today?.none).toBeNull();
    expect(today?.deadline).toMatchObject({ label: expect.stringMatching(/^Tenggat .+ · [A-Z]{2}\d{4}$/), open: { kind: "route", route: { screen: "task" } } });
    // The widget is drawn again when the class on now ends.
    expect(modelOf(h).changesAt).toBe(Date.parse("2026-10-08T09:30:00+07:00"));
    await h.until("2026-10-08T10:30:00+07:00");
    const later = modelOf(h).today;
    expect(later?.classes.map((one) => [one.code, one.live, one.past])).toEqual([
      ["PL3002", false, true],
      ["DK4073", false, false],
      ["PL3032", false, false],
      ["KU5014", false, false],
    ]);
    expect(modelOf(h).changesAt).toBe(Date.parse("2026-10-08T11:00:00+07:00"));
  });

  it("Hari ini on a day without classes says so, and opens Jadwal", async () => {
    const h = await startHome();
    await h.until("2026-10-10T09:00:00+07:00");
    expect(modelOf(h).today).toMatchObject({
      heading: "Hari ini · Sab 10 Okt",
      classes: [],
      none: { label: "Tidak ada kuliah hari ini.", open: { kind: "route", route: { screen: "schedule" } } },
    });
    // Nothing starts or ends today: midnight is when its words stop being true ("Hari ini · Sab 10 Okt", "Besok").
    expect(modelOf(h).changesAt).toBe(Date.parse("2026-10-11T00:00:00+07:00"));
    // The next day with classes fills a taller widget.
    expect(modelOf(h).today?.next).toMatchObject({
      heading: expect.any(String),
      classes: expect.arrayContaining([expect.objectContaining({ live: false, past: false })]),
    });
  });

  it("never signed in: where to start, and nothing else", async () => {
    const h = await startEngine();
    const model = modelOf(h);
    expect(model.status).toEqual({ text: "Hubungkan Edunex atau SIX dulu", problem: true });
    expect([model.now, model.actions, model.needs, model.today]).toEqual([null, [], null, null]);
    // Both widgets draw the one shared layout: their own name, one sentence, one thing to tap.
    expect(model.quiet).toEqual({
      now: {
        state: "signedOut",
        name: "Sekarang",
        label: "Kamu belum masuk.",
        short: "Belum masuk",
        action: "Masuk",
        open: { kind: "route", route: { screen: "home" } },
      },
      today: {
        state: "signedOut",
        name: "Hari ini",
        label: "Kamu belum masuk.",
        short: "Belum masuk",
        action: "Masuk",
        open: { kind: "route", route: { screen: "home" } },
      },
    });
  });

  it("a week without classes keeps what needs the Student; the card alone only with nothing else to say", async () => {
    const own = await startHome();
    const snapshot = own.engine.snapshot();
    const model = widgetModel(
      {
        ...snapshot,
        datasets: snapshot.datasets.map((d) =>
          d.name === "six.schedule" || d.name === "edunex.presence" || d.name === "edunex.materials" ? { ...d, value: Array.isArray(d.value) ? [] : {} } : d,
        ),
      } as typeof snapshot,
      own.world.clock.now(),
    );
    expect(model.now).toMatchObject({ label: "Tidak ada kuliah dalam seminggu ke depan." });
    expect(model.needs?.heading).toBe("Perlu perhatianmu");
    expect(model.needs?.items.length).toBeGreaterThan(0);
    expect(model.quiet.now).toBeNull();
    // "Hari ini" has nothing of its own: the shared card, in SIX's own words (never "Libur": a week off isn't always one).
    expect(model.quiet.today).toMatchObject({ state: "holiday", label: "Tidak ada kuliah dalam seminggu ke depan.", short: "Tidak ada kuliah" });
  });

  it("once today's last class is over, Hari ini says so in Kuliah's words, and a need names its course as the rows do", async () => {
    const own = await startHome();
    const evening = widgetModel(own.engine.snapshot(), Date.parse("2026-10-08T19:00:00+07:00"));
    expect(evening.today?.done).toBe("Kelas hari ini sudah selesai");
    const morning = widgetModel(own.engine.snapshot(), own.world.clock.now());
    expect(morning.today?.done).toBeUndefined();
    expect(morning.needs?.items.map((item) => item.named ?? item.label)).toContain("UTS Komunikasi Pemasaran");
  });
});
