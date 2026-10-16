// v2-09 (#77), seam 1: the schedule and exam alerts, by the real engine
// against the pretend Edunex, SIX and ITB calendar, on a fake clock. The
// recorded timetable has PL3032 and KU5014 overlapping on Thursdays, DK4073's
// UTS in class on 15 October, and II4091's meeting 3 announced only in Edunex.
import { describe, expect, it } from "vitest";
import { mergeExams } from "../../src/core/exams";
import type { AlertHistory } from "../../src/core/models";
import { translate } from "../../src/core/strings";
import { GROUP_WINDOW } from "../../src/engine/alerts/center";
import { createEngine, type Engine } from "../../src/engine/engine";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import type { Shown } from "./alerts-harness";

const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const KINDS = ["scheduleChanged", "meeting", "exam"];

async function start(now = "2026-10-08T08:12:00+07:00") {
  const world = new PretendWorld({ now });
  const shown: Shown[] = [];
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage: new MemoryStorage(),
    vault: new MemoryVault(),
    version: "2.0.0-test",
    emit: () => undefined,
    random: () => 0.5,
    alert: (notice) => {
      const text = [notice.title, notice.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — ");
      shown.push({ ...notice, shownAt: world.clock.now(), text });
    },
  });
  await engine.load();
  engine.start();
  /** SIX is read at human pace: the clock runs a second at a time until the work is done. */
  const meanwhile = async (work: Promise<unknown>) => {
    let done = false;
    const watched = work.finally(() => (done = true));
    for (let second = 0; second < 600 && !done; second++) {
      await new Promise((resolve) => setImmediate(resolve));
      if (!done) await world.clock.advance(1_000);
    }
    await watched;
    // Past the grouping window, so what was raised has gone out.
    await world.clock.advance(25_000);
  };
  await engine.signIn("edunex", { token: PRETEND_TOKEN });
  await meanwhile(engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  return {
    world,
    engine,
    shown,
    texts: () => shown.filter((n) => KINDS.includes(n.kind)).map((n) => n.text),
    /** Alerts of a kind in the in-app history (each one, though a burst goes out as one notification), as "title — body". */
    history: (kind: string) =>
      (engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as AlertHistory | undefined)?.items
        .filter((a) => a.kind === kind)
        .map((a) => [a.title, a.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — ")) ?? [],
    refresh: (source: "six" | "edunex") => meanwhile(engine.refresh(source)),
    until: (iso: string) => world.clock.advanceTo(iso),
  };
}

describe("schedule alerts", () => {
  it("the first sync is silent, though the timetable already has a moved class, an overlap, an exam and a meeting outside SIX", async () => {
    const app = await start();
    await app.until("2026-10-08T12:00:00+07:00");
    expect(app.texts()).toEqual([]);
  });

  it("a class moved in SIX: the day it's seen, naming old → new, once", async () => {
    const app = await start();
    app.world.six.moveMeeting("2194343", "10:00", "11:30", "9009");
    await app.refresh("six");
    const moved = app.shown.filter((n) => n.kind === "scheduleChanged");
    expect(moved.map((n) => n.text)).toEqual(["Jadwal berubah · PL3002 — Kam, 15 Okt 08:00–09:30 · R.SG PWK LT.6 → 10:00–11:30 · 9009"]);
    expect(translate("en", moved[0].body!.key, moved[0].body!.vars)).toBe("Thu, 15 Oct 08:00–09:30 · R.SG PWK LT.6 → 10:00–11:30 · 9009");
    expect(moved[0]).toMatchObject({ source: "six", target: { screen: "schedule" } });
    await app.refresh("six");
    expect(app.shown.filter((n) => n.kind === "scheduleChanged")).toHaveLength(1);
  });

  it("an extra meeting is told as one, not as the class having moved; one standing in for the week's usual meeting is a move", async () => {
    const app = await start();
    const pl = { code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan", room: "R.SG PWK LT.6" };
    // PL3002 usually meets Thursdays 08:00–09:30. The week of 9 November: Thursday's meeting, and an extra one on Friday.
    app.world.six.addMeeting({ ...pl, id: "2194360", day: "2026-11-12", start: "08:00", end: "09:30" });
    app.world.six.addMeeting({ ...pl, id: "2194361", day: "2026-11-13", start: "10:00", end: "11:30", room: "9009" });
    // The week of 16 November: no Thursday meeting; Friday's stands in for it.
    app.world.six.addMeeting({ ...pl, id: "2194362", day: "2026-11-20", start: "08:00", end: "09:30" });
    await app.refresh("six");
    const told = app.history("scheduleChanged");
    expect(told.map((text) => text.split(" — ")[0]).sort()).toEqual(["Jadwal berubah · PL3002", "Pertemuan tambahan · PL3002"]);
    expect(told).toContain("Pertemuan tambahan · PL3002 — Jum, 13 Nov 10:00–11:30 · 9009");
    // The week's usual Thursday meeting, and the Friday one standing in for it.
    expect(told).toContain("Jadwal berubah · PL3002 — Kam, 19 Nov 08:00–09:30 · R.SG PWK LT.6 → Jum, 20 Nov 08:00–09:30 · R.SG PWK LT.6");
  });

  it("overlapping classes: on Monday morning of a week where they clash, once that week", async () => {
    // Sunday evening: this week's overlap is already in the first sync, so it stays silent.
    const app = await start("2026-10-11T20:00:00+07:00");
    await app.until("2026-10-12T05:59:00+07:00");
    expect(app.texts()).toEqual([]);
    await app.until("2026-10-12T06:01:00+07:00");
    expect(app.texts()).toEqual(["Kelas bentrok · KU5014 dan PL3032 — Kam, 15 Okt 16:00–16:30"]);
    await app.until("2026-10-15T17:00:00+07:00");
    expect(app.texts().filter((text) => text.startsWith("Kelas bentrok"))).toHaveLength(1);
  });

  it("overlapping classes: a new week, a new alert", async () => {
    const app = await start("2026-10-18T20:00:00+07:00");
    await app.until("2026-10-19T06:01:00+07:00");
    expect(app.texts()).toEqual(["Kelas bentrok · KU5014 dan PL3032 — Kam, 22 Okt 16:00–16:30"]);
  });

  it("a meeting announced only in Edunex text", async () => {
    const app = await start();
    app.world.edunex.postAnnouncement(95326, { announcement: "Pertemuan 05: Jumat, 23 Oktober 2026 Pkl. 13:00 - 15:00 WIB (Online)" });
    await app.refresh("edunex");
    const meeting = app.shown.filter((n) => n.kind === "meeting");
    expect(meeting.map((n) => n.text)).toEqual(["Pertemuan di luar jadwal SIX · II4091 — Pertemuan 5 · Jum, 23 Okt 13:00–15:00"]);
    expect(translate("en", meeting[0].body!.key, meeting[0].body!.vars)).toBe("Meeting 5 · Fri, 23 Oct 13:00–15:00");
    expect(meeting[0].source).toBe("edunex");
  });

  it("a month counts as read only from its own page: early December on November's page doesn't make December's meetings 'outside SIX'", async () => {
    const app = await start();
    // SIX's November page also shows 1–4 December, here with PL3002's class on Thursday 3 December.
    app.world.six.addMeeting({
      id: "2194354",
      code: "PL3002",
      name: "Ekonomi dan Inovasi dalam Perencanaan",
      day: "2026-12-03",
      start: "08:00",
      end: "09:30",
      room: "R.SG PWK LT.6",
    });
    await app.refresh("six");
    // Announced only in Edunex text: one in December (SIX's December page isn't read yet), one in November (it is).
    app.world.edunex.postAnnouncement(95326, { announcement: "Pertemuan 09: Jumat, 11 Desember 2026 Pkl. 15:00 - 17:00 WIB" });
    app.world.edunex.postAnnouncement(95326, { announcement: "Pertemuan 07: Jumat, 13 November 2026 Pkl. 15:00 - 17:00 WIB" });
    await app.refresh("edunex");
    const meetings = app.shown.filter((n) => n.kind === "meeting").map((n) => n.text);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toContain("Pertemuan 7 ·");
  });

  it("an exam newly in SIX, and the evening before each exam", async () => {
    const app = await start("2026-10-14T12:00:00+07:00");
    // KU5014's class on 22 October becomes its UTS.
    app.world.six.editPage(/\/kelas\/jadwal\/mahasiswa\/\d+$/, (html) =>
      html.replace(/(<div title="[^"]*\()Kuliah(\)"><a [^>]*?pertemuan\/2185660\/[\s\S]*?\()Kuliah 9134\)/, "$1UTS$2UTS 9134)"),
    );
    await app.refresh("six");
    const scheduled = app.shown.filter((n) => n.kind === "exam");
    expect(scheduled.map((n) => n.text)).toEqual(["UTS dijadwalkan · KU5014 — Kam, 22 Okt 16:00 · 9134"]);
    expect(scheduled[0].target).toEqual({ screen: "exam", examId: "KU5014-UTS" });

    await app.until("2026-10-14T17:59:00+07:00");
    expect(app.shown.filter((n) => n.kind === "exam")).toHaveLength(1);
    await app.until("2026-10-14T18:01:00+07:00");
    const tomorrow = app.shown.filter((n) => n.kind === "exam").slice(1);
    expect(tomorrow.map((n) => [n.text, n.shownAt])).toEqual([["UTS besok · DK4073 — Kam, 15 Okt 11:00 · TVST C", wib("2026-10-14T18:00:00") + GROUP_WINDOW]]);
    expect(tomorrow[0].target).toEqual({ screen: "exam", examId: "DK4073-UTS" });
  });

  it("an exam a week before and on its morning, naming the day, time and room", async () => {
    const app = await start("2026-10-07T20:00:00+07:00");
    const dk = () => app.history("exam").filter((text) => text.includes("DK4073"));
    await app.until("2026-10-08T06:59:00+07:00");
    expect(dk()).toEqual([]);
    await app.until("2026-10-08T07:01:00+07:00");
    expect(dk()).toEqual(["UTS seminggu lagi · DK4073 — Kam, 15 Okt 11:00 · TVST C"]);
    await app.until("2026-10-15T07:01:00+07:00");
    // Newest first.
    expect(dk()).toEqual([
      "UTS hari ini · DK4073 — Kam, 15 Okt 11:00 · TVST C",
      "UTS besok · DK4073 — Kam, 15 Okt 11:00 · TVST C",
      "UTS seminggu lagi · DK4073 — Kam, 15 Okt 11:00 · TVST C",
    ]);
  });

  it("two quizzes newly in SIX are two exams, each alert opening its own", async () => {
    const app = await start();
    const pl = { code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan", room: "R.SG PWK LT.6", activity: "Kuis" };
    app.world.six.addMeeting({ ...pl, id: "2194370", day: "2026-11-05", start: "08:00", end: "09:00" });
    app.world.six.addMeeting({ ...pl, id: "2194371", day: "2026-11-19", start: "08:00", end: "09:00" });
    await app.refresh("six");
    const history = (app.engine.snapshot().datasets.find((d) => d.name === "app.alerts")!.value as AlertHistory).items.filter((a) => a.kind === "exam");
    const targets = history.map((a) => (a.target.screen === "exam" ? a.target.examId : null));
    expect(new Set(targets).size).toBe(2);
    // Each target is an exam of the merged list, so the page finds it.
    const exams = mergeExams({ schedule: app.engine.snapshot().datasets.find((d) => d.name === "six.schedule")?.value as never, now: app.world.clock.now() });
    expect(targets.every((id) => exams.some((e) => e.id === id && e.kind === "KUIS"))).toBe(true);
    expect(history.map((a) => translate("en", a.title.key, a.title.vars))).toEqual(["Quiz scheduled · PL3002", "Quiz scheduled · PL3002"]);
  });

  it("class in 15 minutes: off unless the Student turns it on", async () => {
    const app = await start("2026-10-14T20:00:00+07:00");
    await app.until("2026-10-15T17:00:00+07:00");
    expect(app.history("classSoon")).toEqual([]);
  });

  it("class in 15 minutes: turned on, a moved class at its new time and room", async () => {
    const app = await start("2026-10-14T20:00:00+07:00");
    await app.engine.updateSettings({ classSoonAlerts: true });
    app.world.six.moveMeeting("2194343", "10:00", "11:30", "9009");
    await app.refresh("six");
    const pl = () => app.shown.filter((n) => n.kind === "classSoon" && n.title.vars?.course === "PL3002");
    await app.until("2026-10-15T09:44:00+07:00");
    expect(pl()).toEqual([]);
    await app.until("2026-10-15T09:46:00+07:00");
    expect(pl().map((n) => n.text)).toEqual(["Kuliah 15 menit lagi · PL3002 — 10:00–11:30 · 9009"]);
    expect(translate("en", pl()[0].title.key, pl()[0].title.vars)).toBe("Class in 15 minutes · PL3002");
    expect(pl()[0].target).toEqual({ screen: "schedule" });
  });

  it("turned off in Settings: no notification, still in the history", async () => {
    const app = await start();
    await app.engine.updateSettings({ mutedAlerts: ["changes"] });
    app.world.six.moveMeeting("2194343", "10:00", "11:30");
    await app.refresh("six");
    expect(app.shown.filter((n) => n.kind === "scheduleChanged")).toEqual([]);
    const history = app.engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { kind: string }[] };
    expect(history.items.filter((a) => a.kind === "scheduleChanged")).toHaveLength(1);
  });
});
