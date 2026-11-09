// Notifikasi once a class or a Presence window is over (round 3's third review): an alert that told the Student to act
// ("Kuliah sudah mulai · Tandai Hadir · sampai 17:50") says what happened instead, five days later; and an exam SIX
// lists in the class's own slot in both weeks of ITB's exam period is one row with both days
// (mobile/src/screens/alerts/past.ts).
import { describe, expect, it } from "vitest";
import { pastAlert } from "../../mobile/src/screens/alerts/past";
import { examSittings, sittingsLine } from "../../src/core/exam-sittings";
import { makeFormat } from "../../src/core/format";
import type { Alert, ClassSession, PresenceSession } from "../../src/core/models";
import { aTask } from "../kit/tasks";

const wib = (iso: string) => Date.parse(`${iso}+07:00`);

const session = (id: string, start: string, end: string, activity = "Kuliah", room: string | null = "9009"): ClassSession =>
  ({ id, courseCode: "DK4073", courseName: "Komunikasi Pemasaran", activity, start: wib(start), end: wib(end), room }) as ClassSession;

const alert = (id: string, at: number, extra: Partial<Alert> = {}): Alert => ({
  id,
  kind: "presenceOpen",
  source: "six",
  at,
  title: { key: "mobile.alert.classStarted", vars: { course: "DK4073" } },
  body: { key: "mobile.alert.classStarted.body", vars: { time: "17:50" } },
  target: { screen: "home" },
  ...extra,
});

describe("pastAlert", () => {
  const klass = session("2194342", "2026-11-05T16:00:00", "2026-11-05T17:50:00");
  const started = alert(`six.classStart:2194342:${klass.start}`, klass.start);

  it("leaves a class's alert as it is while the class is on", () => {
    expect(pastAlert(started, { schedule: [klass], presence: {} }, wib("2026-11-05T17:00:00"))).toBeNull();
  });

  it("says what SIX's count did once it's over, five days later", () => {
    const world = {
      schedule: [klass],
      presence: {},
      classResults: { "2194342": { courseCode: "DK4073", start: klass.start, end: klass.end, result: "counted" as const, at: klass.end } },
    };
    expect(pastAlert(started, world, wib("2026-11-10T09:00:00"))).toEqual({ kind: "class", code: "DK4073", key: "six:2194342", outcome: "counted" });
    // Tandai Hadir's own alerts for the same class are the same row.
    expect(pastAlert(alert("six.checkInClosing:2194342", klass.end - 15 * 60_000), world, wib("2026-11-10T09:00:00"))?.key).toBe("six:2194342");
  });

  it("is over even when SIX's timetable no longer lists the class, with nothing claimed about it", () => {
    expect(pastAlert(started, { schedule: [], presence: {} }, wib("2026-11-10T09:00:00"))).toEqual({
      kind: "class",
      code: "DK4073",
      key: "six:2194342",
      outcome: null,
    });
  });

  it("says what Edunex recorded once a Presence window has closed", () => {
    const window = { id: 77, opensAt: wib("2026-11-05T08:00:00"), closesAt: wib("2026-11-05T10:00:00"), recorded: null } as unknown as PresenceSession;
    const opened = alert(`presence.open:77:${window.opensAt}`, window.opensAt, {
      source: "edunex",
      title: { key: "alert.presenceOpen", vars: { course: "DK4073" } },
    });
    expect(pastAlert(opened, { schedule: null, presence: { DK4073: [window] } }, wib("2026-11-05T09:00:00"))).toBeNull();
    expect(pastAlert(opened, { schedule: null, presence: { DK4073: [window] } }, wib("2026-11-10T09:00:00"))?.outcome).toBe("notRecorded");
    const present = { ...window, recorded: { present: true, at: wib("2026-11-05T08:30:00") } };
    expect(pastAlert(opened, { schedule: null, presence: { DK4073: [present] } }, wib("2026-11-10T09:00:00"))?.outcome).toBe("present");
  });

  it("is over six hours after it opened when Edunex no longer lists the window, with nothing claimed about it", () => {
    const opensAt = wib("2026-11-05T08:00:00");
    const opened = alert(`presence.open:78:${opensAt}`, opensAt, { source: "edunex", title: { key: "alert.presenceOpen", vars: { course: "DK4073" } } });
    expect(pastAlert(opened, { schedule: null, presence: {} }, wib("2026-11-05T10:00:00"))).toBeNull();
    expect(pastAlert(opened, { schedule: null, presence: {} }, wib("2026-11-10T09:00:00"))).toEqual({
      kind: "presence",
      code: "DK4073",
      key: "presence:78",
      outcome: null,
    });
  });

  it("says whether the Task was handed in once its deadline has passed, every reminder of it one row", () => {
    const due = wib("2026-11-05T23:59:00");
    const oneHour = alert(`task.due1:117003:${due}`, due - 3_600_000, {
      kind: "deadline",
      source: "edunex",
      title: { key: "alert.due1", vars: { course: "II4091" } },
      body: { key: "alert.due.body", vars: { title: "Tugas 02 Bab II" } },
      target: { screen: "task", taskId: 117003 },
    });
    const task = aTask({ id: 117003, courseCode: "II4091", courseId: 95326, title: "Tugas 02 Bab II", status: "not_started", dueAt: due });
    const world = { schedule: null, presence: {}, tasks: [task] };
    expect(pastAlert(oneHour, world, due - 60_000)).toBeNull();
    expect(pastAlert(oneHour, world, wib("2026-11-10T09:00:00"))).toEqual({
      kind: "deadline",
      code: "II4091",
      key: "task:117003",
      outcome: "notHandedIn",
      task: "Tugas 02 Bab II",
    });
    const sent = {
      ...task,
      answer: { id: 1, text: "", files: [], createdAt: due - 7_200_000, updatedAt: due - 7_200_000, sent: true, sentAt: due - 7_200_000, reviewedAt: null },
    };
    expect(pastAlert(oneHour, { ...world, tasks: [sent] }, wib("2026-11-10T09:00:00"))?.outcome).toBe("handedIn");
    // The 24-hour reminder of the same deadline is the same row.
    expect(pastAlert({ ...oneHour, id: `task.due24:117003:${due}` }, world, wib("2026-11-10T09:00:00"))?.key).toBe("task:117003");
    // Edunex moved the deadline later: still ahead, the alert stays as it came.
    expect(pastAlert(oneHour, { ...world, tasks: [{ ...task, dueAt: wib("2026-11-12T23:59:00") }] }, wib("2026-11-10T09:00:00"))).toBeNull();
    // Gone from the data: over, with its name from the alert and nothing claimed.
    expect(pastAlert(oneHour, { ...world, tasks: [] }, wib("2026-11-10T09:00:00"))).toMatchObject({ outcome: null, task: "Tugas 02 Bab II" });
  });

  it("leaves every other alert as it is", () => {
    expect(pastAlert(alert("task.new:1", wib("2026-11-05T08:00:00"), { kind: "newTask" }), undefined, wib("2026-11-10T09:00:00"))).toBeNull();
  });
});

describe("examSittings", () => {
  // SIX lists DK4073's UAS in its Thursday slot in both weeks of ITB's exam period (7–22 Des): two "dijadwalkan" alerts.
  const first = session("3001", "2026-12-10T11:00:00", "2026-12-10T12:50:00", "UAS");
  const second = session("3002", "2026-12-17T11:00:00", "2026-12-17T12:50:00", "UAS");
  const scheduled = (s: ClassSession, at: number): Alert =>
    alert(`exam.scheduled:six:${s.id}`, at, {
      kind: "exam",
      title: { key: "alert.examScheduled", vars: { kindId: "UAS", kindEn: "UAS", course: "DK4073" } },
      target: { screen: "exam", examId: "DK4073-UAS" },
    });

  it("folds one exam's sittings into its newest row, soonest first", () => {
    const items = [scheduled(second, wib("2026-11-10T08:00:01")), scheduled(first, wib("2026-11-10T08:00:00"))];
    const { sittings, folded } = examSittings(items, [first, second]);
    expect(sittings.get(items[0]!.id)?.map((s) => s.id)).toEqual(["3001", "3002"]);
    expect([...folded]).toEqual([items[1]!.id]);
  });

  it("leaves an exam with one sitting as it is", () => {
    const { sittings, folded } = examSittings([scheduled(first, wib("2026-11-10T08:00:00"))], [first]);
    expect(sittings.size).toBe(0);
    expect(folded.size).toBe(0);
  });
});

describe("sittingsLine", () => {
  const f = makeFormat("id", wib("2026-11-10T09:00:00"));
  const en = makeFormat("en", wib("2026-11-10T09:00:00"));
  const first = session("3001", "2026-12-10T11:00:00", "2026-12-10T12:50:00", "UAS");
  const second = session("3002", "2026-12-17T11:00:00", "2026-12-17T12:50:00", "UAS");

  it("says the weekday, the time and the room once", () => {
    expect(sittingsLine(f, [first, second])).toBe("Kam, 10 Des dan 17 Des, 11:00 · 9009");
    expect(sittingsLine(en, [first, second])).toBe("Thu, 10 Dec and 17 Dec, 11:00 · 9009");
    expect(sittingsLine(f, [first, second], { time: false, room: false })).toBe("Kam, 10 Des dan 17 Des");
  });

  it("says each day's time when they differ, and a day once", () => {
    const later = { ...second, start: wib("2026-12-17T13:00:00") };
    expect(sittingsLine(f, [first, later], { room: false })).toBe("Kam, 10 Des, 11:00 dan Kam, 17 Des, 13:00");
    const sameDay = { ...first, id: "3003", start: wib("2026-12-10T14:00:00") };
    expect(sittingsLine(f, [first, sameDay], { room: false })).toBe("Kam, 10 Des, 11:00 dan 14:00");
  });
});
