// v2-09 (#77), seam 1: "Needs you" from the real engine's datasets against the
// pretend Edunex, SIX and ITB calendar on a fake clock: what each provider
// raises, in which band, with which action and sources, and the ranking.
import { describe, expect, it } from "vitest";
import { type HomeWorld, type Need, type NeedProvider, needsYou, PROVIDERS, recentChanges, slotChange } from "../../src/core/needs";
import { translate } from "../../src/core/strings";
import { wib } from "../pretend/edunex";
import { PretendWorld } from "../pretend/world";
import { startHome } from "./needs-harness";

const at = (iso: string) => Date.parse(`${iso}+07:00`);
const summary = (needs: Need[]) => needs.map((n) => `${n.band} ${n.id}`);
const find = (needs: Need[], id: string) => needs.find((n) => n.id === id);

describe("the recorded Thursday morning (8 Oct, 08:12)", () => {
  it("signed out of SIX, the open Presence can't be said to count: not a must-do, and the card doesn't claim it counts", async () => {
    const h = await startHome();
    const world = { ...h.home(), sixConnected: false };
    const presence = find(needsYou(world), "presence:2194342");
    expect(presence).toMatchObject({ kind: "presence", countedIn: "noSix" });
  });

  it("ranks the open Presence first, then today's classes that can't be missed, the meeting only in Edunex, and attendance out of reach", async () => {
    const h = await startHome();
    const needs = needsYou(h.home());
    expect(summary(needs)).toEqual([
      "now presence:2194342",
      "soon class:2153983",
      "soon class:2194402",
      `soon meeting:II4091:${at("2026-10-09T15:00:00")}`,
      "soon attendance:KU5014:out",
    ]);
    expect(needs.map((n) => n.rank)).toEqual([1, 2, 3, 4, 5]);

    // PL3002: Edunex's window is open while SIX's class runs (moved: until 10:00, usually 09:30); SIX counts.
    const presence = needs[0];
    expect(presence).toMatchObject({
      kind: "presence",
      course: "PL3002",
      open: true,
      activity: "course",
      countedIn: "six",
      sources: ["edunex", "six"],
      at: at("2026-10-08T09:30:00"),
    });
    expect(presence.action).toEqual({ kind: "open", url: "https://edunex.itb.ac.id/courses/95001", via: "edunex" });
    if (presence.kind !== "presence") throw new Error("not a Presence item");
    expect(presence.class?.room).toBe("R.SG PWK LT.6");
    expect(presence.classMoved).toEqual({ usualStart: at("2026-10-08T08:00:00"), usualEnd: at("2026-10-08T09:30:00"), usualRoom: null });

    // DK4073 4/6 and PL3032 4/7: no absences left before 80%, and both meet later today.
    expect(find(needs, "class:2153983")).toMatchObject({
      course: "DK4073",
      state: "none",
      absencesLeft: 0,
      countedIn: "six",
      sources: ["six"],
      action: { kind: "go", route: { screen: "course", code: "DK4073", tab: "meetings" } },
    });

    // II4091's meeting 3 is announced only in an Edunex text, with its Teams link.
    expect(find(needs, `meeting:II4091:${at("2026-10-09T15:00:00")}`)).toMatchObject({
      sources: ["edunex"],
      action: { kind: "open", via: "link", url: expect.stringContaining("teams.microsoft.com") },
    });

    // KU5014 2/6 can't reach 80% anymore; the meetings left come from SIX's timetable and ITB's last lecture day.
    expect(find(needs, "attendance:KU5014:out")).toMatchObject({ sources: ["six", "itb"], action: { kind: "go", route: { screen: "presence" } } });
  });

  it("speaks only of what it knows: without SIX, nothing is 'not in SIX' and no class or count is guessed", async () => {
    const h = await startHome();
    const world: HomeWorld = { ...h.home(), schedule: null, courses: h.home().courses.map((c) => ({ ...c, six: null })) };
    expect(summary(needsYou(world))).toEqual(["now presence:2194342"]);
  });
});

describe("a Presence window opening midday", () => {
  it("isn't there before it opens, and is on top the minute it does, with the action that counts and when it closes", async () => {
    const h = await startHome();
    const id = h.world.edunex.schedulePresence(92948, 84725, { start: "2026-10-08T12:00:00+07:00", end: "2026-10-08T13:30:00+07:00" });
    await h.refresh();
    await h.until("2026-10-08T11:59:00+07:00");
    expect(find(needsYou(h.home()), `presence:${id}`)).toBeUndefined();
    await h.until("2026-10-08T12:01:00+07:00");
    const needs = needsYou(h.home());
    expect(needs[0]).toMatchObject({
      id: `presence:${id}`,
      band: "now",
      course: "KU5014",
      activity: "course",
      at: at("2026-10-08T13:30:00"),
      action: { kind: "open", via: "edunex" },
    });
    await h.until("2026-10-08T13:31:00+07:00");
    expect(find(needsYou(h.home()), `presence:${id}`)).toBeUndefined();
  });

  it("one that counts only by handing in a Task is announced ahead, in place of the Task's own deadline item", async () => {
    const h = await startHome({ now: "2026-10-15T20:00:00+07:00" });
    const needs = needsYou(h.home());
    // II4091's window Fri 16 Oct 15:00–23:59 counts only if Tugas 02 Bab II is handed in inside it.
    expect(find(needs, "presence:2243740")).toMatchObject({
      band: "soon",
      activity: "assignment",
      task: { id: 117003 },
      action: { kind: "go", route: { screen: "task", taskId: 117003 } },
    });
    expect(find(needs, "task:117003")).toBeUndefined();
    await h.until("2026-10-16T15:01:00+07:00");
    expect(needsYou(h.home())[0]).toMatchObject({ id: "presence:2243740", band: "now", open: true });
  });
});

describe("a Presence window of a course that counts in SIX", () => {
  it("is optional: not announced ahead, and the Task it asks for keeps its own deadline item", async () => {
    // PL3002 counts in SIX (6 of 7; Edunex recorded 1 of its 6 windows). Its lecturer ties Thursday's window to a Task.
    const h = await startHome({ now: "2026-10-12T20:00:00+07:00" });
    h.world.edunex.moveDeadline(117873, "2026-10-15T23:59:00+07:00");
    const id = h.world.edunex.schedulePresence(95001, 86778, {
      start: "2026-10-15T08:00:00+07:00",
      end: "2026-10-15T23:59:00+07:00",
      patch: { presentable: [{ presentable: "assignment", presentable_id: "117873" }] },
    });
    await h.refresh();
    const needs = needsYou(h.home());
    expect(find(needs, `presence:${id}`)).toBeUndefined();
    expect(find(needs, "task:117873")).toMatchObject({ band: "later", reason: "due" });
    // Open, it's said as optional; the Task still stands on its own.
    await h.until("2026-10-15T08:01:00+07:00");
    expect(find(needsYou(h.home()), `presence:${id}`)).toMatchObject({ open: true, countedIn: "six", task: { id: 117873 } });
    expect(find(needsYou(h.home()), "task:117873")).toMatchObject({ band: "now" });
  });
});

describe("a deadline at midnight", () => {
  it("due tonight is now, in three days soon, within a week coming up, later not yet; past midnight it's gone unless still accepted", async () => {
    const h = await startHome();
    const tonight = h.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00", is_lateable: false });
    const late = h.world.edunex.postTask(95059, { name: "Refleksi", end_at: "2026-10-08T23:59:00+07:00", is_lateable: true });
    const soon = h.world.edunex.postTask(95001, { name: "Esai", end_at: "2026-10-10T23:59:00+07:00" });
    const week = h.world.edunex.postTask(95001, { name: "Proposal", end_at: "2026-10-14T23:59:00+07:00" });
    const far = h.world.edunex.postTask(95001, { name: "Laporan akhir", end_at: wib(at("2026-10-30T23:59:00")) });
    await h.refresh();
    const bands = () =>
      Object.fromEntries(
        needsYou(h.home())
          .filter((n) => n.kind === "task" && n.reason !== "edited")
          .map((n) => [n.id, `${n.band} ${n.kind === "task" ? n.reason : ""}`]),
      );
    expect(bands()).toEqual({ [`task:${tonight}`]: "now due", [`task:${late}`]: "now due", [`task:${soon}`]: "soon due", [`task:${week}`]: "later due" });
    expect(bands()[`task:${far}`]).toBeUndefined();

    await h.until("2026-10-09T00:01:00+07:00");
    expect(bands()).toEqual({ [`task:${late}`]: "now overdue", [`task:${soon}`]: "soon due", [`task:${week}`]: "later due" });

    // Handed in: nothing left to do.
    h.world.edunex.submitOnWebsite(late);
    await h.refresh();
    expect(bands()[`task:${late}`]).toBeUndefined();
  });

  it("a short answer window is now", async () => {
    const h = await startHome();
    const quiz = h.world.edunex.postTask(95001, { name: "Kuis kelas", end_at: wib(h.world.clock.now() + 2 * 3_600_000) });
    await h.refresh();
    expect(find(needsYou(h.home()), `task:${quiz}`)).toMatchObject({ band: "now", reason: "short" });
  });
});

describe("a class moved", () => {
  it("later today off its usual slot: soon, with the usual time and room", async () => {
    const h = await startHome({ now: "2026-10-15T06:00:00+07:00" });
    // PL3002 usually meets Thursdays 08:00–09:30 in R.SG PWK LT.6.
    h.world.six.moveMeeting("2194343", "10:00", "11:30", "9009");
    await h.refresh();
    const moved = find(needsYou(h.home()), "class:2194343");
    expect(moved).toMatchObject({
      band: "soon",
      course: "PL3002",
      // 6 of 7, and today's class is in UTS week: it may not run, so it isn't counted, and one absence is left.
      state: "risk",
      moved: { usualStart: at("2026-10-15T08:00:00"), usualEnd: at("2026-10-15T09:30:00"), usualRoom: "R.SG PWK LT.6" },
    });
    // An exam later today isn't a class to attend: DK4073's UTS (no absences left) isn't raised here.
    expect(find(needsYou(h.home()), "class:2179909")).toBeUndefined();
    // Within the hour it's "now": time to go. (Until 09:30 its own Presence window, open from 08:00, speaks for it.)
    await h.until("2026-10-15T09:10:00+07:00");
    expect(find(needsYou(h.home()), "presence:2194343")).toMatchObject({ class: { id: "2194343" } });
    await h.until("2026-10-15T09:31:00+07:00");
    expect(find(needsYou(h.home()), "class:2194343")).toMatchObject({ band: "now" });
  });
});

describe("exams", () => {
  it("an exam within the week, with when and where; a take-home due another day is its second part, not a reason to worry", async () => {
    // Friday 9 October: DK4073's UTS is in class on Thursday 15 October (SIX), its take-home part due 22 October (Edunex).
    const h = await startHome({ now: "2026-10-09T10:00:00+07:00" });
    const uts = find(needsYou(h.home()), "exam:DK4073-UTS");
    expect(uts).toMatchObject({
      kind: "exam",
      band: "later",
      course: "DK4073",
      at: at("2026-10-15T11:00:00"),
      disagree: false,
      takeHomeDue: at("2026-10-22T23:50:00"),
      sources: ["six", "edunex"],
    });
    expect(uts).toMatchObject({ sitting: { start: at("2026-10-15T11:00:00"), end: at("2026-10-15T12:59:00"), room: "TVST C", source: "six" } });
    expect(uts?.action).toEqual({ kind: "go", route: { screen: "exam", examId: "DK4073-UTS" } });
  });

  it("the morning of the exam it's now, and the class item never speaks for it; once it's over it's gone", async () => {
    const h = await startHome({ now: "2026-10-15T10:30:00+07:00" });
    const needs = needsYou(h.home());
    expect(find(needs, "exam:DK4073-UTS")).toMatchObject({ band: "now" });
    expect(find(needs, "class:2179909")).toBeUndefined();
    await h.until("2026-10-15T13:00:00+07:00");
    expect(find(needsYou(h.home()), "exam:DK4073-UTS")).toBeUndefined();
  });

  it("SIX and Edunex giving its sitting different days makes it soon: time to ask the lecturer", async () => {
    const h = await startHome({ now: "2026-10-09T10:00:00+07:00" });
    const online = { id: "9002", courseId: 93409, title: "UTS Markom", start: at("2026-10-16T09:00:00"), end: null };
    expect(find(needsYou({ ...h.home(), exams: { DK4073: [online] } }), "exam:DK4073-UTS")).toMatchObject({ band: "soon", disagree: true });
  });

  it("an exam only Edunex dates (an online quiz) is one too, on Edunex", async () => {
    const h = await startHome({ now: "2026-10-19T09:00:00+07:00" });
    const quiz = { id: "9001", courseId: 95001, title: "Kuis 2", start: at("2026-10-20T19:00:00"), end: at("2026-10-20T20:00:00") };
    expect(find(needsYou({ ...h.home(), exams: { PL3002: [quiz] } }), "exam:PL3002-KUIS-e9001")).toMatchObject({
      band: "soon",
      sources: ["edunex"],
      sitting: { start: quiz.start, end: quiz.end, room: null, source: "edunex" },
      action: { kind: "go", route: { screen: "exam", examId: "PL3002-KUIS-e9001" } },
    });
  });

  it("an exam SIX and Edunex agree on is coming up within the week, and not before", async () => {
    // KU5014's class on Thursday 22 October becomes its UTS.
    const world = new PretendWorld({ now: "2026-10-14T12:00:00+07:00" });
    world.six.editPage(/\/kelas\/jadwal\/mahasiswa\/\d+$/, (html) =>
      html.replace(/(<div title="[^"]*\()Kuliah(\)"><a [^>]*?pertemuan\/2185660\/[\s\S]*?\()Kuliah 9134\)/, "$1UTS$2UTS 9134)"),
    );
    const h = await startHome({ world });
    expect(find(needsYou(h.home()), "exam:KU5014-UTS")).toBeUndefined();
    await h.until("2026-10-16T09:00:00+07:00");
    expect(find(needsYou(h.home()), "exam:KU5014-UTS")).toMatchObject({ band: "later", disagree: false, sources: ["six"], sitting: { room: "9134" } });
  });
});

describe("an extra meeting", () => {
  it("is never called a class that moved, on another day or the same day; one standing in for the week's usual meeting is", async () => {
    const h = await startHome();
    const schedule = h.home().schedule!;
    // PL3002 usually meets Thursdays 08:00–09:30 in R.SG PWK LT.6.
    const usual = schedule.find((s) => s.id === "2194343")!;
    const meeting = (id: string, start: string, end: string, room: string) => ({ ...usual, id, start: at(start), end: at(end), room });
    const friday = meeting("x1", "2026-10-16T13:00:00", "2026-10-16T14:30:00", "9009");
    const afternoon = meeting("x2", "2026-10-22T13:00:00", "2026-10-22T14:30:00", "R.SG PWK LT.6");
    expect(slotChange(friday, [...schedule, friday])).toBeNull();
    expect(slotChange(afternoon, [...schedule, afternoon])).toBeNull();
    // Without Thursday's meeting that week, Friday's stands in for it: moved, with the usual slot on its own day.
    const standIn = [...schedule.filter((s) => s.id !== "2194343"), friday];
    expect(slotChange(friday, standIn)).toEqual({ usualStart: at("2026-10-15T08:00:00"), usualEnd: at("2026-10-15T09:30:00"), usualRoom: "R.SG PWK LT.6" });
    // "What changed" names the usual day, in each language.
    const [moved] = recentChanges({ ...h.home(), now: at("2026-10-12T08:00:00"), schedule: standIn }, []).filter((a) => a.id.startsWith("schedule.moved:x1:"));
    expect(translate("id", moved.body!.key, moved.body!.vars)).toBe("Jum, 16 Okt 13:00–14:30 · biasanya Kamis 08:00–09:30");
    expect(translate("en", moved.body!.key, moved.body!.vars)).toBe("Fri, 16 Oct 13:00–14:30 · usually Thursday 08:00–09:30");
  });
});

describe("what changed", () => {
  it("a class SIX moves, or a meeting announced outside SIX, is one change, though it's both an alert and something Beranda sees itself", async () => {
    const h = await startHome();
    // DK4073 usually meets Thursdays 11:00–12:59 in TVST C: today's meeting moves to the afternoon in 9009.
    h.world.six.moveMeeting("2153983", "13:00", "14:59", "9009");
    h.world.edunex.postAnnouncement(95326, { announcement: "Pertemuan 05: Jumat, 23 Oktober 2026 Pkl. 13:00 - 15:00 WIB" });
    await h.refresh();
    const history = h.dataset("app.alerts")?.items ?? [];
    expect(history.filter((a) => a.kind === "scheduleChanged" || a.kind === "meeting")).toHaveLength(2);
    const changes = recentChanges(h.home(), history);
    expect(changes.filter((a) => a.kind === "scheduleChanged" && a.title.vars?.course === "DK4073")).toHaveLength(1);
    expect(changes.filter((a) => a.kind === "meeting" && a.id.endsWith(`:${at("2026-10-23T13:00:00")}`))).toHaveLength(1);
  });

  it("reminders aren't changes: the evening-before exam alert and the weekly overlap alert stay out", async () => {
    // Sunday evening before UTS week; by Thursday both reminders have gone out.
    const h = await startHome({ now: "2026-10-11T20:00:00+07:00" });
    await h.until("2026-10-15T09:00:00+07:00");
    const history = h.dataset("app.alerts")?.items ?? [];
    expect(history.map((a) => translate("id", a.title.key, a.title.vars))).toEqual(
      expect.arrayContaining(["UTS besok · DK4073", "Kelas bentrok · KU5014 dan PL3032"]),
    );
    expect(recentChanges(h.home(), history).filter((a) => a.kind === "exam" || a.title.key === "alert.overlap")).toEqual([]);
  });
});

describe("an edit after submitting", () => {
  it("a handed-in Task the lecturer changed is now while Edunex still takes answers, soon once it doesn't, and gone after a week", async () => {
    const h = await startHome();
    // PL3002's Task was handed in on 16 Sep and is due tonight; KU5014's TUGAS 1 closed on 17 Sep.
    h.world.edunex.editTask(117432, { description: "<p>Tambahkan referensi.</p>" });
    h.world.edunex.editTask(117044, { description: "<p>Format baru.</p>" });
    await h.refresh();
    const needs = needsYou(h.home());
    expect(find(needs, "task:117432:edited")).toMatchObject({
      band: "now",
      reason: "edited",
      action: { kind: "go", route: { screen: "task", taskId: 117432 } },
    });
    expect(find(needs, "task:117044:edited")).toMatchObject({ band: "soon", reason: "edited" });
    // A week on, with the same data.
    expect(needsYou({ ...h.home(), now: h.world.clock.now() + 7 * 24 * 3_600_000 }).filter((n) => n.id.endsWith(":edited"))).toEqual([]);
  });
});

describe("the ranking", () => {
  const item = (id: string, kind: Need["kind"], band: Need["band"], at: number | null) =>
    ({ id, kind, band, at, course: null, sources: [], action: { kind: "go", route: { screen: "home" } } }) as never;
  const world = {
    now: 0,
    term: null,
    courses: [],
    tasks: [],
    presence: {},
    materials: {},
    announcements: {},
    schedule: null,
    calendar: undefined,
  } satisfies HomeWorld;

  it("band first, then the area in the providers' order, then the soonest moment", () => {
    const providers: NeedProvider[] = [
      { area: "presence", needs: () => [item("p-later", "presence", "later", 1)] },
      { area: "task", needs: () => [item("t-now-late", "task", "now", 20), item("t-now-early", "task", "now", 10), item("t-soon", "task", "soon", null)] },
      { area: "attendance", needs: () => [item("a-now", "attendance", "now", 5)] },
    ];
    expect(needsYou(world, providers).map((n) => `${n.rank} ${n.id}`)).toEqual(["1 t-now-early", "2 t-now-late", "3 a-now", "4 t-soon", "5 p-later"]);
  });

  it("nothing in the data: nothing needs the Student", () => {
    expect(needsYou(world, PROVIDERS)).toEqual([]);
  });
});
