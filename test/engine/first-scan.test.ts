// #81 (spec story 68): the first-run scan over what the first full sync of
// the pretend EduNex and SIX saved (real recorded shapes): which lines it
// has, the number and courses on each, and the screen each opens. A line with
// nothing to say stays out.
import { describe, expect, it } from "vitest";
import { type Finding, type FindingKind, firstScan, notable, scanReady, scanSummary } from "../../src/core/first-scan";
import type { SourceStatus, Transcript } from "../../src/core/models";
import type { Saved } from "../../src/core/saved";
import { aTask } from "../kit/tasks";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { firstSync, savedOf, until } from "./first-sync";
import { startEngine } from "./harness";

const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const TRANSCRIPT = /\/transkrip\/historis\/\d+$/;
const TIMETABLE = /\/kelas\/jadwal\/mahasiswa\/\d+$/;

type Of<K extends FindingKind> = Extract<Finding, { kind: K }>;
const of = <K extends FindingKind>(findings: Finding[], kind: K) => findings.find((f): f is Of<K> => f.kind === kind);
const kinds = (findings: Finding[]) => findings.map((f) => f.kind);
const scan = (saved: Saved, statuses: readonly SourceStatus[], now: number, target = 80) => firstScan({ saved, statuses, target, now });

describe("after the first full sync of EduNex and SIX", () => {
  it("lists what neither system tells the Student, most pressing first", async () => {
    const h = await firstSync();
    const findings = scan(h.saved(), h.statuses(), h.world.clock.now());
    expect(kinds(findings)).toEqual(["attendance", "clash", "unusedPresence", "exams", "notInSix", "edited", "ipk"]);

    // SIX's exact counts against 80%, to ITB's last lecture day (4 Dec): KU5014 can't make it, DK4073 and PL3032 have no absences left.
    const attendance = of(findings, "attendance")!;
    expect(attendance).toMatchObject({ count: 3, tone: "danger", sources: ["six", "itb"], routes: [{ screen: "presence" }] });
    expect(attendance.courses.map((c) => [c.code, c.state, c.attended, c.held])).toEqual([
      ["KU5014", "out", 2, 6],
      ["DK4073", "none", 4, 6],
      ["PL3032", "none", 4, 7],
    ]);
    expect(Math.round(attendance.courses[0].best! * 100)).toBe(73);

    // PL3032 (15:00–16:30) and KU5014 (16:00–17:50) share every Thursday's half hour: five on SIX's timetable, counted as the KRS tab counts them.
    const clash = of(findings, "clash")!;
    expect(clash).toMatchObject({
      count: 1,
      tone: "danger",
      sources: ["six"],
      routes: [{ screen: "schedule" }, { screen: "plan", tab: "krs" }, { screen: "course", code: "KU5014", tab: "meetings" }],
    });
    expect(clash.overlaps).toEqual([{ codes: ["KU5014", "PL3032"], count: 5, upcoming: true, start: wib("2026-10-08T16:00:00"), end: wib("2026-10-08T16:30:00") }]);

    // PL3002 is counted in SIX (6 of 7); EduNex recorded 1 of its 6 closed windows, so it would show 5 absences.
    expect(of(findings, "unusedPresence")).toMatchObject({ count: 1, tone: "info", sources: ["edunex", "six"], courses: [{ code: "PL3002", absent: 5, attended: 6, held: 7 }] });

    // SIX's UTS for DK4073 (room and time), EduNex's take-home UTS for the same course, and PL3032's outline exam weeks dated by ITB's calendar.
    // The line opens the soonest where it shows: PL3032's outline, with its "Midex/UTS" module.
    const exams = of(findings, "exams")!;
    expect(exams).toMatchObject({ count: 4, tone: "warning", sources: ["six", "edunex", "itb"], routes: [{ screen: "course", code: "PL3032", tab: "modules" }] });
    expect(exams.exams.map((e) => [e.source, e.code])).toEqual([
      ["outline", "PL3032"],
      ["six", "DK4073"],
      ["task", "DK4073"],
      ["outline", "PL3032"],
    ]);
    expect(exams.exams[0]).toMatchObject({ kind: "UTS", module: { title: "Midex/UTS" }, week: { firstDay: "2026-10-12", lastDay: "2026-10-16" } });
    expect(exams.exams[1]).toMatchObject({ kind: "UTS", at: wib("2026-10-15T11:00:00"), session: { room: "TVST C" } });
    expect(exams.exams[2]).toMatchObject({ task: { id: 117764, title: "UTS Markom" } });
    expect(exams.exams[3]).toMatchObject({ kind: "UAS", module: { title: "Finex/UAS" }, week: { firstDay: "2026-12-07", lastDay: "2026-12-22" } });

    // "Pertemuan 03: Jumat, 09 Oktober 2026 Pkl. 15:00 - 17:00 WIB (Online …)" sits only in EduNex's parent class text.
    const outside = of(findings, "notInSix")!;
    expect(outside).toMatchObject({ count: 1, sources: ["edunex"], routes: [{ screen: "course", code: "II4091", tab: "meetings" }] });
    expect(outside.meetings[0]).toMatchObject({ code: "II4091", meeting: { number: 3, start: wib("2026-10-09T15:00:00"), end: wib("2026-10-09T17:00:00"), online: true } });

    // Six Tasks edited after posting, two of them after the Student had handed in.
    const edited = of(findings, "edited")!;
    expect(edited).toMatchObject({ count: 6, afterSubmit: 2, tone: "warning", routes: [{ screen: "tasks" }] });
    expect(edited.tasks.map((t) => t.id)).toEqual([117764, 117001, 113986, 117003, 117010, 117023]);

    // SIX's IPK 3.26: no honors yet; cum laude starts at 3.50.
    expect(of(findings, "ipk")).toMatchObject({ count: 3.26, ipk: 3.26, band: null, next: { level: "cum", min: 3.5 }, blocked: null, tone: "info", routes: [{ screen: "grades" }] });
    // Everything but what couldn't be read counts as something neither system says.
    expect(notable(findings)).toBe(7);
  });

  it("says what was read", async () => {
    const h = await firstSync();
    const summary = scanSummary(h.saved(), h.statuses());
    expect(summary).toMatchObject({ connected: ["edunex", "six"], read: ["edunex", "six"], courses: 5, tasks: 10 });
    // Every SIX meeting, plus EduNex's Presence and announced meetings SIX doesn't list.
    expect(summary.meetings).toBeGreaterThan(h.saved()["six.schedule"]!.length);

    // SIX ends the session: its data was still read, but it isn't connected.
    h.world.six.expireSession();
    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("expired");
    expect(scanSummary(h.saved(), h.statuses())).toMatchObject({ connected: ["edunex"], read: ["edunex", "six"] });
  });

  it("the attendance target changes who is at risk", async () => {
    const h = await firstSync();
    const at = (target: number) => of(scan(h.saved(), h.statuses(), h.world.clock.now(), target), "attendance")?.courses.map((c) => [c.code, c.state]);
    // At 60% KU5014 (2 of 6) and PL3032 (4 of 7) are below it now, though both can still recover.
    expect(at(60)).toEqual([
      ["KU5014", "risk"],
      ["PL3032", "risk"],
    ]);
    expect(at(90)).toEqual([
      ["DK4073", "out"],
      ["KU5014", "out"],
      ["PL3032", "out"],
      ["PL3002", "none"],
      ["II4091", "risk"],
    ]);
  });
});

describe("when the scan is ready", () => {
  const statuses = (h: Awaited<ReturnType<typeof startEngine>>) => h.engine.snapshot().statuses;

  it("after EduNex's first sync; with SIX connected, only once SIX has read its timetable and transcript too", async () => {
    const h = await startEngine();
    await h.wait(5_000);
    expect(scanReady(savedOf(h), statuses(h))).toBe(false);

    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    await h.wait(5_000);
    expect(scanReady(savedOf(h), statuses(h))).toBe(true);

    let done = false;
    const signingIn = h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }).finally(() => (done = true));
    const steps: { six: string; ready: boolean; read: boolean }[] = [];
    for (let second = 0; second < 600 && !done; second++) {
      const saved = savedOf(h);
      steps.push({ six: h.status("six").state, ready: scanReady(saved, statuses(h)), read: saved["six.schedule"] !== undefined && saved["six.transcript"] !== undefined });
      await h.world.clock.advance(1_000);
    }
    await signingIn;
    // From the moment SIX's session starts until its timetable and transcript are in, the scan waits.
    const reading = steps.filter((step) => step.six !== "signed-out" && !step.read);
    expect(reading.length).toBeGreaterThan(3);
    expect(reading.map((step) => step.ready)).toEqual(reading.map(() => false));
    expect(scanReady(savedOf(h), statuses(h))).toBe(true);
  });

  it("when a system stops with a reason instead of reading everything", async () => {
    const h = await firstSync({ before: (h) => h.world.six.changeLayout(TRANSCRIPT, "Masuk Transkrip", "Status") });
    expect(h.status("six").state).toBe("changed");
    expect(h.saved()["six.transcript"]).toBeUndefined();
    expect(scanReady(h.saved(), h.statuses())).toBe(true);
  });
});

describe("with EduNex alone", () => {
  it("only what EduNex can tell: exams it knows and edited Tasks", async () => {
    const h = await firstSync({ six: false });
    const findings = scan(h.saved(), h.statuses(), h.world.clock.now());
    expect(kinds(findings)).toEqual(["exams", "edited"]);
    expect(of(findings, "exams")?.exams.map((e) => [e.source, e.code])).toEqual([
      ["outline", "PL3032"],
      ["task", "DK4073"],
      ["outline", "PL3032"],
    ]);
    expect(scanSummary(h.saved(), h.statuses())).toMatchObject({ connected: ["edunex"], read: ["edunex"], courses: 5, tasks: 10 });
  });
});

describe("what couldn't be read", () => {
  it("SIX changed its transcript page: that part is named, and the IPK line stays out", async () => {
    const h = await firstSync({ before: (h) => h.world.six.changeLayout(TRANSCRIPT, "Masuk Transkrip", "Status") });
    const findings = scan(h.saved(), h.statuses(), h.world.clock.now());
    expect(of(findings, "ipk")).toBeUndefined();
    expect(of(findings, "unread")).toMatchObject({
      count: 1,
      tone: "danger",
      sources: ["six"],
      routes: [{ screen: "home" }],
      parts: [{ source: "six", state: "changed", missing: ["six.transcript"] }],
    });
    expect(notable(findings)).toBe(findings.length - 1);
    expect(findings.at(-1)?.kind).toBe("unread");
  });

  it("SIX's timetable didn't answer: named, and the lines that need it stay out", async () => {
    const h = await firstSync({ before: (h) => h.world.six.fail(TIMETABLE, 503) });
    const findings = scan(h.saved(), h.statuses(), h.world.clock.now());
    expect(h.status("six").state).toBe("offline");
    expect(kinds(findings)).not.toContain("attendance");
    expect(kinds(findings)).not.toContain("clash");
    expect(kinds(findings)).not.toContain("notInSix");
    expect(of(findings, "unread")?.parts).toEqual([{ source: "six", state: "offline", missing: ["six.schedule"] }]);
  });

  it("an offline system whose earlier data is all there has nothing missing to report", async () => {
    const h = await firstSync();
    h.world.setOffline(true);
    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("offline");
    expect(of(scan(h.saved(), h.statuses(), h.world.clock.now()), "unread")).toBeUndefined();
  });
});

describe("each line's own rules", () => {
  /** The recorded data, changed on purpose. */
  const base = async () => {
    const h = await firstSync();
    return { saved: h.saved(), statuses: h.statuses(), now: h.world.clock.now() };
  };

  it("nothing to say, nothing listed", () => {
    const quiet: Saved = {
      "edunex.courses": [{ code: "II3120", name: "Layanan Sistem", classNo: "01", term: "2026-1", edunex: { courseId: 1, classId: 2, relatedCourseIds: [] } }],
      "edunex.tasks": [aTask({ id: 1, courseCode: "II3120", courseId: 1, title: "Tugas 1", status: "not_started", dueAt: wib("2026-10-20T23:59:00") })],
      "edunex.materials": { II3120: [] },
      "edunex.presence": { II3120: [] },
      "edunex.announcements": { II3120: [] },
      "edunex.exams": { II3120: [] },
    };
    expect(scan(quiet, [{ source: "edunex", state: "live", updatedAt: 0, detail: null }], wib("2026-10-08T09:00:00"))).toEqual([]);
  });

  it("the IPK line: the honors level SIX's IPK reaches (Peraturan Akademik ITB) and the next one, or what rules it out", async () => {
    const { saved, statuses, now } = await base();
    const withIpk = (ipk: number, retake = false): Saved => {
      const transcript = structuredClone(saved["six.transcript"]!) as Transcript;
      transcript.ipk.six = ipk;
      if (retake) transcript.terms[1].courses[0].attempt = 2;
      return { ...saved, "six.transcript": transcript };
    };
    const ipkOf = (s: Saved) => of(scan(s, statuses, now), "ipk");
    expect(ipkOf(withIpk(3.49))).toMatchObject({ band: null, next: { level: "cum", min: 3.5 }, tone: "info" });
    expect(ipkOf(withIpk(3.5))).toMatchObject({ band: "cum", next: { level: "magna", min: 3.75 }, tone: "success" });
    expect(ipkOf(withIpk(3.8))).toMatchObject({ band: "magna", next: { level: "summa", min: 3.85 }, blocked: null });
    // A retake rules out summa cum laude, whatever the IPK.
    expect(ipkOf(withIpk(3.8, true))).toMatchObject({ band: "magna", next: null, blocked: { level: "summa", reason: "retake" } });
    expect(ipkOf(withIpk(3.95, true))).toMatchObject({ band: "magna", blocked: { level: "summa", reason: "retake" } });
    expect(ipkOf(withIpk(3.9))).toMatchObject({ band: "summa", next: null, blocked: null });
    // Past the 9th semester no honors are open.
    const late: Saved = { ...withIpk(3.9), "six.student": { ...saved["six.student"]!, term: "2030-1" } };
    expect(ipkOf(late)).toMatchObject({ band: null, next: null, blocked: { level: "cum", reason: "time" } });
    // SIX's figure when it shows one, as Nilai shows it; before any grade there is none: no line.
    const none = structuredClone(saved["six.transcript"]!) as Transcript;
    none.ipk.six = null;
    expect(ipkOf({ ...saved, "six.transcript": none })).toMatchObject({ ipk: none.ipk.computed });
    none.ipk.computed = null;
    expect(ipkOf({ ...saved, "six.transcript": none })).toBeUndefined();
  });

  it("overlapping classes: every pair still to come, soonest first; a clash already over doesn't count", async () => {
    const { saved, statuses, now } = await base();
    const schedule = saved["six.schedule"]!;
    const extra = { ...schedule.find((s) => s.courseCode === "PL3002")!, id: "extra", start: wib("2026-10-16T16:00:00"), end: wib("2026-10-16T18:00:00") };
    const clash = of(scan({ ...saved, "six.schedule": [...schedule, extra] }, statuses, now), "clash")!;
    expect(clash.count).toBe(2);
    expect(clash.overlaps.map((o) => [o.codes, o.count, o.start])).toEqual([
      [["KU5014", "PL3032"], 5, wib("2026-10-08T16:00:00")],
      [["II4091", "PL3002"], 1, wib("2026-10-16T16:00:00")],
    ]);
    expect(of(scan(saved, statuses, wib("2026-10-29T16:31:00")), "clash")).toBeUndefined();
    // Without SIX's KRS the overlap shows on the course's meetings.
    const { ["six.krs"]: _krs, ...withoutKrs } = saved;
    expect(of(scan(withoutKrs, statuses, now), "clash")?.routes).toEqual([{ screen: "schedule" }, { screen: "course", code: "KU5014", tab: "meetings" }]);
  });

  it("exams: a take-home UTS handed in, or an exam week already over, isn't upcoming", async () => {
    const { saved, statuses } = await base();
    const tasks = saved["edunex.tasks"]!.map((t) => (t.id === 117764 ? { ...t, answer: { id: 1, sent: true, text: null, files: [], createdAt: null, updatedAt: null, sentAt: wib("2026-10-20T10:00:00"), reviewedAt: null } } : t));
    const after = of(scan({ ...saved, "edunex.tasks": tasks }, statuses, wib("2026-10-17T08:00:00")), "exams");
    expect(after?.exams.map((e) => [e.source, e.code, "kind" in e ? e.kind : null])).toEqual([["outline", "PL3032", "UAS"]]);
  });

  it("one exam, or one edited Task, opens it directly", async () => {
    const { saved, statuses, now } = await base();
    const tasks = saved["edunex.tasks"]!.map((t) => (t.id === 117010 ? t : { ...t, editedAt: null }));
    expect(of(scan({ ...saved, "edunex.tasks": tasks }, statuses, now), "edited")).toMatchObject({ count: 1, afterSubmit: 0, tone: "info", routes: [{ screen: "task", taskId: 117010 }] });
    const onlyTakeHome: Saved = { ...saved, "six.schedule": saved["six.schedule"]!.filter((s) => s.activity !== "UTS"), "edunex.outline": {} };
    expect(of(scan(onlyTakeHome, statuses, now), "exams")).toMatchObject({ count: 1, routes: [{ screen: "task", taskId: 117764 }] });
    // SIX's exam session opens its course's meetings, where SIX's timetable shows it.
    const onlySix: Saved = { ...saved, "edunex.tasks": saved["edunex.tasks"]!.filter((t) => t.kind !== "uts"), "edunex.outline": {} };
    expect(of(scan(onlySix, statuses, now), "exams")).toMatchObject({ count: 1, sources: ["six"], routes: [{ screen: "course", code: "DK4073", tab: "meetings" }] });
  });

  it("a course whose EduNex record keeps up with SIX isn't flagged as counted elsewhere", async () => {
    const { saved, statuses, now } = await base();
    const presence = { ...saved["edunex.presence"]! };
    presence.PL3002 = presence.PL3002.map((p) => (p.closesAt <= now ? { ...p, recorded: { present: true, at: p.opensAt } } : p));
    expect(of(scan({ ...saved, "edunex.presence": presence }, statuses, now), "unusedPresence")).toBeUndefined();
  });

  it("a meeting announced only in EduNex needs SIX's timetable to be called that, and must still be to come", async () => {
    const { saved, statuses, now } = await base();
    const { ["six.schedule"]: _schedule, ...withoutTimetable } = saved;
    expect(of(scan(withoutTimetable, statuses, now), "notInSix")).toBeUndefined();
    expect(of(scan(saved, statuses, wib("2026-10-09T17:01:00")), "notInSix")).toBeUndefined();
  });
});
