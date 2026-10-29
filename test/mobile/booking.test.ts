// The phone's timed alerts booked with Android ahead (mobile/src/host/booking.ts): what's booked,
// cancelled and skipped, then the real engine against the pretend Edunex with a pretend Android
// that shows each booking at its time, the app closed or open: every reminder reaches the Student once.
import { describe, expect, it } from "vitest";
import { type Booked, CHANNELS, HORIZON, LEAD, LIMIT, liveCheck, noticeContent, readBooked, rebook, writeBooked } from "../../mobile/src/host/booking";
import type { AlertNotice } from "../../src/engine/alerts/center";
import type { PlannedAlert } from "../../src/engine/alerts/detector";
import { createEngine } from "../../src/engine/engine";
import { edunex } from "../../src/engine/sources/edunex";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse("2026-10-08T08:00:00+07:00");

const deadline = (id: string, at: number, extra: Partial<PlannedAlert> = {}): PlannedAlert => ({
  id,
  kind: "deadline",
  source: "edunex",
  at,
  until: at + HOUR,
  title: { key: "alert.due3", vars: { course: "II4091" } },
  body: { key: "alert.due.body", vars: { title: "Laporan kemajuan" } },
  target: { screen: "task", taskId: 1 },
  ...extra,
});

const none = new Set<string>();

describe("what's booked with Android", () => {
  it("words it as the live one, on its channel, with a tap that opens its screen, and a deadline says it may be done already", () => {
    const { book } = rebook({ planned: [deadline("a", NOW + HOUR)], booked: {}, waiting: none, now: NOW, lang: "id" });
    expect(book).toHaveLength(1);
    expect(book[0]).toMatchObject({ id: "a", at: NOW + HOUR, booking: { at: NOW + HOUR, until: NOW + 2 * HOUR } });
    expect(book[0].content).toEqual({
      title: "Tenggat 3 jam lagi · II4091",
      body: "Laporan kemajuan · belum dikumpulkan\nAbaikan kalau sudah dikumpulkan.",
      data: { target: { screen: "task", taskId: 1 } },
      channelId: CHANNELS.normal,
    });
    // The live one has no footnote: it's raised from what was just read.
    expect(noticeContent(deadline("a", NOW), "en").body).toBe("Laporan kemajuan · not submitted yet");
    const presence = noticeContent(
      { ...deadline("p", NOW), kind: "presenceOpen", checkIn: { meetingId: "m1", url: "https://six.itb.ac.id/x" }, body: null },
      "en",
      true,
    );
    expect(presence).toMatchObject({
      channelId: CHANNELS.urgent,
      body: "Ignore this if you're already marked present.",
      data: { checkIn: { meetingId: "m1" } },
    });
  });

  it("books the nearest ones only: not inside a minute (the app's own timer has it), not past the horizon, at most LIMIT", () => {
    const planned = [
      deadline("soon", NOW + LEAD - 1),
      deadline("far", NOW + HORIZON + 1),
      ...Array.from({ length: LIMIT + 5 }, (_, i) => deadline(`d${String(i).padStart(2, "0")}`, NOW + (LIMIT + 5 - i) * HOUR)),
    ];
    const { book } = rebook({ planned, booked: {}, waiting: none, now: NOW, lang: "id" });
    expect(book).toHaveLength(LIMIT);
    expect(book.map((b) => b.id)).not.toContain("soon");
    expect(book.map((b) => b.id)).not.toContain("far");
    expect(book.map((b) => b.at)).toEqual(Array.from({ length: LIMIT }, (_, i) => NOW + (i + 1) * HOUR));
  });

  it("keeps what's unchanged, books again what changed or Android lost, cancels what left the plan", () => {
    const first = rebook({
      planned: [deadline("same", NOW + HOUR), deadline("moved", NOW + 2 * HOUR), deadline("gone", NOW + 3 * HOUR)],
      booked: {},
      waiting: none,
      now: NOW,
      lang: "id",
    });
    const booked: Booked = Object.fromEntries(first.book.map((b) => [b.id, b.booking]));
    const waiting = new Set(["same", "moved", "gone"]);
    const next = rebook({ planned: [deadline("same", NOW + HOUR), deadline("moved", NOW + 4 * HOUR)], booked, waiting, now: NOW, lang: "id" });
    expect(next.kept).toEqual({ same: booked.same });
    expect(next.cancel.sort()).toEqual(["gone", "moved"]);
    expect(next.book.map((b) => [b.id, b.at])).toEqual([["moved", NOW + 4 * HOUR]]);

    // Android lost one (cleared by the system): booked again.
    const lost = rebook({ planned: [deadline("same", NOW + HOUR)], booked: { same: booked.same }, waiting: none, now: NOW, lang: "id" });
    expect(lost).toMatchObject({ cancel: [], kept: {} });
    expect(lost.book.map((b) => b.id)).toEqual(["same"]);

    // Another language: every one is worded again.
    expect(rebook({ planned: [deadline("same", NOW + HOUR)], booked: { same: booked.same }, waiting, now: NOW, lang: "en" }).book.map((b) => b.id)).toEqual([
      "same",
    ]);

    // Held by Android with no record of it (the record was lost): let go.
    expect(rebook({ planned: [], booked: {}, waiting: new Set(["stray"]), now: NOW, lang: "id" }).cancel).toEqual(["stray"]);
  });

  it("remembers one whose time came until its alert is over, so the live one isn't shown again", () => {
    const booking = { at: NOW - MINUTE, until: NOW + HOUR, hash: "x" };
    expect(rebook({ planned: [], booked: { a: booking }, waiting: none, now: NOW, lang: "id" })).toEqual({ cancel: [], book: [], kept: { a: booking } });
    expect(rebook({ planned: [], booked: { a: booking }, waiting: none, now: NOW + HOUR, lang: "id" }).kept).toEqual({});
  });

  it("reads back what it saved, and nothing from a file it can't read", () => {
    const booked: Booked = { "task.due3:1:2": { at: NOW, until: NOW + HOUR, hash: "abc" } };
    expect(readBooked(writeBooked(booked))).toEqual(booked);
    expect(readBooked(null)).toEqual({});
    expect(readBooked("{not json")).toEqual({});
    expect(readBooked(JSON.stringify({ format: 2, booked }))).toEqual({});
  });
});

describe("a live alert and its booking", () => {
  const booked: Booked = { a: { at: NOW, until: NOW + HOUR, hash: "x" }, b: { at: NOW, until: NOW + HOUR, hash: "y" } };

  it("is skipped once Android showed it", () => {
    expect(liveCheck({ ids: ["a"] }, booked, none)).toEqual({ show: false, cancel: [] });
    expect(liveCheck({ ids: ["a", "b"] }, booked, none)).toEqual({ show: false, cancel: [] });
  });

  it("is shown, and the booking cancelled, while Android hasn't shown it yet (an alarm running late)", () => {
    expect(liveCheck({ ids: ["a"] }, booked, new Set(["a"]))).toEqual({ show: true, cancel: ["a"] });
  });

  it("is shown when it wasn't booked, or only part of its group was", () => {
    expect(liveCheck({ ids: ["new"] }, booked, none)).toEqual({ show: true, cancel: [] });
    expect(liveCheck({ ids: ["a", "new"] }, booked, none)).toEqual({ show: true, cancel: [] });
  });
});

/** Android's side: what the app booked, shown at its time (or `late` after it), and every notification seen. */
class PretendAndroid {
  readonly waiting = new Map<string, { at: number; timer: { readonly id: number } | ReturnType<typeof setTimeout> }>();
  readonly shown: { id: string; at: number; from: "android" | "live"; title: string }[] = [];
  booked: Booked = {};

  constructor(
    private readonly world: PretendWorld,
    private readonly late = 0,
  ) {}

  /** The engine's plan, booked as ../../mobile/src/host/reminders.ts books it. */
  upcoming(planned: readonly PlannedAlert[]): void {
    const now = this.world.clock.now();
    const plan = rebook({ planned, booked: this.booked, waiting: new Set(this.waiting.keys()), now, lang: "id" });
    for (const id of plan.cancel) this.cancel(id);
    this.booked = { ...plan.kept };
    for (const { id, at, content, booking } of plan.book) {
      this.cancel(id);
      const timer = this.world.clock.setTimeout(
        () => {
          this.waiting.delete(id);
          this.shown.push({ id, at: this.world.clock.now(), from: "android", title: content.title });
        },
        at + this.late - now,
      );
      this.waiting.set(id, { at, timer });
      this.booked[id] = booking;
    }
  }

  /** An alert the engine raised live, through liveCheck. */
  deliver(notice: AlertNotice): void {
    const check = liveCheck(notice, this.booked, new Set(this.waiting.keys()));
    for (const id of check.cancel) this.cancel(id);
    if (check.show) this.shown.push({ id: notice.id, at: this.world.clock.now(), from: "live", title: noticeContent(notice, "id").title });
  }

  private cancel(id: string): void {
    const waiting = this.waiting.get(id);
    if (waiting) this.world.clock.clearTimeout(waiting.timer);
    this.waiting.delete(id);
  }
}

async function phoneApp(late = 0) {
  const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
  const android = new PretendAndroid(world, late);
  const engine = createEngine({
    transport: world,
    clock: world.clock,
    storage: new MemoryStorage(),
    vault: new MemoryVault(),
    version: "2.0.0-test",
    emit: () => undefined,
    random: () => 0.5,
    sources: [edunex],
    alert: (notice) => android.deliver(notice),
    upcoming: (planned) => android.upcoming(planned),
  });
  await engine.load();
  await engine.updateSettings({ lang: "id" });
  engine.start();
  await engine.signIn("edunex", { token: PRETEND_TOKEN });
  // The first sync is silent; then a Task due Saturday 15:00 (reminders 2 days, 1 day and 3 hours before).
  await world.clock.advance(10 * MINUTE);
  const task = world.edunex.postTask(95326, { name: "Laporan kemajuan", end_at: "2026-10-10T15:00:00+07:00" });
  await world.clock.advance(20 * MINUTE);
  const reminders = () => android.shown.filter((one) => one.id.startsWith("task.due") && one.id.includes(`:${task}:`));
  return { world, android, engine, task, reminders };
}

describe("the phone, with the real engine", () => {
  it("books a new Task's deadline reminders, and Android shows them with the app closed, once", async () => {
    const { world, android, engine, task, reminders } = await phoneApp();
    const due = Date.parse("2026-10-10T15:00:00+07:00");
    expect([...android.waiting.keys()].filter((id) => id.includes(`:${task}:`)).sort()).toEqual(
      [`task.due24:${task}:${due}`, `task.due3:${task}:${due}`, `task.due48:${task}:${due}`].sort(),
    );

    // The Student leaves the app; Android freezes it. The reminder 2 days before still comes, from Android.
    engine.stop();
    await world.clock.advanceTo("2026-10-08T16:00:00+07:00");
    expect(reminders()).toEqual([{ id: `task.due48:${task}:${due}`, at: due - 48 * HOUR, from: "android", title: "Tenggat 2 hari lagi · II4091" }]);

    // Opened again before the next one: the engine raises the one it missed, and it isn't shown a second time.
    engine.start();
    await world.clock.advance(MINUTE);
    expect(reminders()).toHaveLength(1);

    // Open at the next one's time: Android's comes, the engine's own is skipped.
    await world.clock.advanceTo("2026-10-09T15:05:00+07:00");
    expect(reminders().map((one) => [one.from, one.at])).toEqual([
      ["android", due - 48 * HOUR],
      ["android", due - 24 * HOUR],
    ]);
    engine.stop();
  });

  it("shows the live one instead when Android's alarm runs late, and cancels Android's", async () => {
    const { world, android, engine, task, reminders } = await phoneApp(5 * MINUTE);
    const due = Date.parse("2026-10-10T15:00:00+07:00");
    await world.clock.advanceTo("2026-10-08T15:30:00+07:00");
    expect(reminders().map((one) => [one.from, one.id])).toEqual([["live", `task.due48:${task}:${due}`]]);
    expect(android.waiting.has(`task.due48:${task}:${due}`)).toBe(false);
    engine.stop();
  });

  it("cancels them once deadline reminders are turned off", async () => {
    const { world, android, engine, task, reminders } = await phoneApp();
    expect([...android.waiting.keys()].filter((id) => id.includes(`:${task}:`))).toHaveLength(3);
    await engine.updateSettings({ mutedAlerts: ["deadline"] });
    engine.planAlerts();
    expect([...android.waiting.keys()].filter((id) => id.startsWith("task.due"))).toEqual([]);
    await world.clock.advanceTo("2026-10-10T15:00:00+07:00");
    expect(reminders()).toEqual([]);
    engine.stop();
  });
});
