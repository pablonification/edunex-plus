// SIX's "Tandai Hadir": while a class is on, the real engine reads the class's
// popup on the pretend SIX (modelled: SIX's was never recorded) every two
// minutes; the moment the button shows, an urgent alert that opens SIX on the
// class, on the phone too; 15 minutes before the end, again if it still shows;
// once pressed, nothing more. On a fake clock, on the recorded Thursday:
// PL3002 08:00–10:00 (SIX meeting 2194342), then DK4073 at 11:00.
import { describe, expect, it } from "vitest";
import { sequenceId } from "../../src/engine/alerts/phone";
import { edunex } from "../../src/engine/sources/edunex";
import { six } from "../../src/engine/sources/six";
import { nextCheckIn, showsCheckIn } from "../../src/engine/sources/six/check-in";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import { startAlerts } from "./alerts-harness";

const MINUTE = 60_000;
const PL3002 = "2194342";
const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const TIMETABLE = "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001?bulan=202610";

/** Signed in to Edunex and SIX at `now`, past the first sync, with the phone linked. */
async function inClass(now: string) {
  const world = new PretendWorld({ now: `${now}+07:00` });
  const app = await startAlerts({ world, sources: [edunex, six] });
  // SIX is read at human pace: the clock runs while it signs in.
  const signedIn = app.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
  await app.wait(MINUTE);
  await signedIn;
  const link = await app.engine.phone.connect();
  if (!link.connected) throw new Error("not linked");
  await app.engine.phone.idle();
  const popups = () => world.six.requests.filter((r) => r.path.includes("/kelas/pertemuan/"));
  const checkIns = () => app.shown.filter((n) => n.id.startsWith("six.checkIn"));
  return { ...app, topic: link.topic, popups, checkIns };
}

describe("reading a class's popup for Tandai Hadir", () => {
  it("only while the class is on, every two minutes or so, the way SIX's own timetable asks for it", async () => {
    const app = await inClass("2026-10-08T07:30:00");
    await app.until("2026-10-08T07:54:00+07:00");
    expect(app.popups()).toEqual([]);

    await app.until("2026-10-08T10:30:00+07:00");
    const popups = app.popups();
    expect(popups.every((r) => r.path === "/app/mahasiswa:18223901+2026-1/kelas/pertemuan/2194342/mhs/2021000001" && r.xhr)).toBe(true);
    // From 5 minutes before 08:00 to 10 minutes after 10:00.
    expect(popups[0].at).toBeGreaterThanOrEqual(wib("2026-10-08T07:55:00"));
    expect(popups.at(-1)!.at).toBeLessThanOrEqual(wib("2026-10-08T10:10:00") + 2 * MINUTE);
    const gaps = popups.slice(1).map((r, i) => r.at - popups[i].at);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(100_000);
    expect(popups.length).toBeLessThanOrEqual(70);

    // Between classes, nothing.
    const before = app.popups().length;
    await app.until("2026-10-08T10:50:00+07:00");
    expect(app.popups()).toHaveLength(before);
  });

  it("finds SIX's button, and only one that can be pressed", () => {
    expect(showsCheckIn('<form method="post"><button type="submit" class="btn btn-primary">\n  Tandai   Hadir\n</button></form>')).toBe(true);
    expect(showsCheckIn('<a class="btn btn-primary" href="/hadir">Tandai Hadir</a>')).toBe(true);
    expect(showsCheckIn('<input type="submit" value="Tandai Hadir">')).toBe(true);
    expect(showsCheckIn('<button class="btn" disabled>Tandai Hadir</button>')).toBe(false);
    expect(showsCheckIn('<a class="btn disabled">Tandai Hadir</a>')).toBe(false);
    expect(showsCheckIn("<table><tr><th>Kehadiran</th><td>Hadir</td></tr></table>")).toBe(false);
    expect(showsCheckIn("<p>Tandai Hadir dibuka oleh dosen.</p>")).toBe(false);
  });

  it("knows open, then gone once it went: a class whose button came and went isn't read again", () => {
    const waiting = nextCheckIn(undefined, false, 1);
    expect(waiting).toEqual({ state: "waiting", since: 1 });
    expect(nextCheckIn(waiting, false, 2)).toBe(waiting);
    const open = nextCheckIn(waiting, true, 3);
    expect(open).toEqual({ state: "open", since: 3 });
    expect(nextCheckIn(open, true, 4)).toBe(open);
    expect(nextCheckIn(open, false, 5)).toEqual({ state: "gone", since: 5 });
  });
});

describe("the Tandai Hadir alerts", () => {
  it("the moment it shows: one urgent alert that opens SIX on the class, on the phone too, never twice", async () => {
    const app = await inClass("2026-10-08T07:30:00");
    await app.until("2026-10-08T08:20:00+07:00");
    expect(app.checkIns()).toEqual([]);

    app.world.six.openCheckIn(PL3002);
    await app.until("2026-10-08T08:23:00+07:00");
    const [alert] = app.checkIns();
    expect(alert).toMatchObject({
      id: `six.checkIn:${PL3002}`,
      kind: "presenceOpen",
      source: "six",
      urgent: true,
      count: 1,
      checkIn: { meetingId: PL3002, url: TIMETABLE },
    });
    expect(alert.text).toBe("Tandai Hadir sudah dibuka · PL3002 — Buka kelasnya di SIX, lalu tekan Tandai Hadir · kuliah sampai 10:00");
    expect(alert.shownAt).toBeLessThanOrEqual(wib("2026-10-08T08:22:30"));
    // On the phone at once, first in line; a tap opens SIX's timetable, where the class's popup has the button.
    await app.engine.phone.idle();
    const sent = app.ntfy.sent.find((m) => m.sequence_id === sequenceId(alert.id));
    expect(sent).toMatchObject({ priority: 4, click: TIMETABLE, title: "Tandai Hadir sudah dibuka · PL3002" });

    await app.until("2026-10-08T09:00:00+07:00");
    expect(app.checkIns().filter((n) => n.kind === "presenceOpen")).toHaveLength(1);
  });

  it("15 minutes before the class ends, again if it still shows; booked on the phone in case the laptop sleeps", async () => {
    const app = await inClass("2026-10-08T07:30:00");
    app.world.six.openCheckIn(PL3002);
    await app.until("2026-10-08T08:05:00+07:00");
    await app.engine.phone.idle();
    const closing = sequenceId(`six.checkInClosing:${PL3002}`);
    expect(app.ntfy.booked(app.topic).find((m) => m.sequence_id === closing)).toMatchObject({
      delay: String(wib("2026-10-08T09:45:00") / 1000),
      click: TIMETABLE,
    });

    await app.until("2026-10-08T09:46:00+07:00");
    expect(app.checkIns().map((n) => [n.kind, n.text, n.shownAt])).toEqual([
      ["presenceOpen", expect.stringContaining("Tandai Hadir sudah dibuka · PL3002"), expect.any(Number)],
      ["presenceClosing", "Belum Tandai Hadir · PL3002 — Buka kelasnya di SIX, lalu tekan Tandai Hadir · kuliah sampai 10:00", wib("2026-10-08T09:45:00")],
    ]);
  });

  it("once pressed (the button goes), nothing more: the reminder booked on the phone is taken back, and the popup isn't read again", async () => {
    const app = await inClass("2026-10-08T07:30:00");
    app.world.six.openCheckIn(PL3002);
    await app.until("2026-10-08T08:05:00+07:00");
    await app.engine.phone.idle();
    const closing = sequenceId(`six.checkInClosing:${PL3002}`);
    expect(app.ntfy.booked(app.topic).map((m) => m.sequence_id)).toContain(closing);

    app.world.six.closeCheckIn(PL3002);
    await app.until("2026-10-08T08:10:00+07:00");
    await app.engine.phone.idle();
    expect(app.ntfy.deletes()).toContain(closing);
    const read = app.popups().length;

    await app.until("2026-10-08T10:15:00+07:00");
    expect(app.checkIns().map((n) => n.kind)).toEqual(["presenceOpen"]);
    expect(app.popups()).toHaveLength(read);
  });

  it("already showing at the first look after signing in to SIX mid-class: still said", async () => {
    const world = new PretendWorld({ now: "2026-10-08T08:40:00+07:00" });
    world.six.openCheckIn(PL3002);
    const app = await startAlerts({ world, sources: [edunex, six] });
    const signedIn = app.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
    await app.wait(3 * MINUTE);
    await signedIn;
    expect(app.shown.filter((n) => n.id === `six.checkIn:${PL3002}`)).toHaveLength(1);
  });

  it("one class's popup failing doesn't keep the other class on from being read", async () => {
    const world = new PretendWorld({ now: "2026-10-08T07:30:00+07:00" });
    // A lab running into the lecture, whose popup SIX fails to load.
    world.six.addMeetingBeside(PL3002, {
      id: "2194391",
      code: "PL3002",
      name: "Ekonomi dan Inovasi dalam Perencanaan",
      start: "07:00",
      end: "08:30",
      activity: "Praktikum",
    });
    world.six.fail(/\/kelas\/pertemuan\/2194391\//, 404);
    world.six.openCheckIn(PL3002);
    const app = await startAlerts({ world, sources: [edunex, six] });
    const signedIn = app.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
    await app.wait(MINUTE);
    await signedIn;
    await app.until("2026-10-08T08:05:00+07:00");
    expect(app.shown.filter((n) => n.id === `six.checkIn:${PL3002}`)).toHaveLength(1);
  });

  it("turned off in Settings (Presensi): no notification, still in the history", async () => {
    const app = await inClass("2026-10-08T07:30:00");
    await app.engine.updateSettings({ mutedAlerts: ["presence"] });
    app.world.six.openCheckIn(PL3002);
    await app.until("2026-10-08T08:10:00+07:00");
    expect(app.checkIns()).toEqual([]);
    expect(app.history()?.items.map((item) => item.id)).toContain(`six.checkIn:${PL3002}`);
  });
});
