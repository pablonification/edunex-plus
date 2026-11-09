// Notifikasi once a class or a Presence window is over (round 3's third review): an alert that told the Student to act
// ("Kuliah sudah mulai · Tandai Hadir · sampai 17:50") says what happened instead, five days later; and an exam SIX
// lists in the class's own slot in both weeks of ITB's exam period is one row with both days
// (mobile/src/screens/alerts/past.ts).
import { describe, expect, it } from "vitest";
import { examSittings, pastAlert } from "../../mobile/src/screens/alerts/past";
import type { Alert, ClassSession, PresenceSession } from "../../src/core/models";

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
