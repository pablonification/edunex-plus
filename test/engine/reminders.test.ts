// Smarter reminders, seam 2: what the deadline, exam and class detectors plan
// from the data and the Student's settings, read straight off their plans:
// each reminder's moment, how long it stays true (`until`) and its stable id.
// The engine-level runs are in alerts, attendance-alerts and schedule-alerts.
import { describe, expect, it } from "vitest";
import { type ClassSession, type DatasetName, type DatasetValue, DEFAULT_SETTINGS, type Settings, type Task } from "../../src/core/models";
import { translate } from "../../src/core/strings";
import type { DetectorContext, PlannedAlert } from "../../src/engine/alerts/detector";
import { classSoon, examAlerts } from "../../src/engine/alerts/schedule";
import { deadlineReminders } from "../../src/engine/alerts/tasks";

const HOUR = 3_600_000;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const DUE = wib("2026-10-16T23:59:00");

const task = (patch: Partial<Task> = {}): Task => ({
  id: 117003,
  courseCode: "II4091",
  courseId: 1,
  moduleId: null,
  title: "Tugas 02 Bab II",
  status: "not_started",
  opensAt: null,
  dueAt: DUE,
  score: null,
  module: null,
  kind: "task",
  instructions: "",
  files: [],
  fileRequired: false,
  lateAllowed: false,
  closed: false,
  answer: null,
  postedAt: null,
  editedAt: null,
  ...patch,
});

const session = (patch: Partial<ClassSession> = {}): ClassSession => ({
  id: "2194343",
  courseCode: "PL3002",
  courseName: "Ekonomi dan Inovasi dalam Perencanaan",
  start: wib("2026-10-15T08:00:00"),
  end: wib("2026-10-15T09:30:00"),
  activity: "Kuliah",
  room: "R.SG PWK LT.6",
  ...patch,
});

function context(data: { [N in DatasetName]?: DatasetValue<N> }, settings: Partial<Settings> = {}): DetectorContext {
  return { now: wib("2026-10-01T00:00:00"), get: (name) => data[name] as never, fetchedAt: () => null, settings: { ...DEFAULT_SETTINGS, ...settings } };
}

/** Each planned alert as id, moment and end, then "title — body" as the Student reads it in Indonesian. */
const read = (alerts: readonly PlannedAlert[]) =>
  alerts.map((a) => ({
    id: a.id,
    at: a.at,
    until: a.until,
    text: [a.title, a.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — "),
  }));

describe("deadline reminders", () => {
  const plan = (tasks: Task[], settings: Partial<Settings> = {}) => read(deadlineReminders.plan!(context({ "edunex.tasks": tasks }, settings)));

  it("by default 2 days, 1 day and 3 hours before, each until the next one, the last until the deadline", () => {
    expect(plan([task()])).toEqual([
      {
        id: `task.due48:117003:${DUE}`,
        at: DUE - 48 * HOUR,
        until: DUE - 24 * HOUR,
        text: "Tenggat 2 hari lagi · II4091 — Tugas 02 Bab II · belum dikumpulkan",
      },
      {
        id: `task.due24:117003:${DUE}`,
        at: DUE - 24 * HOUR,
        until: DUE - 3 * HOUR,
        text: "Tenggat 24 jam lagi · II4091 — Tugas 02 Bab II · belum dikumpulkan",
      },
      { id: `task.due3:117003:${DUE}`, at: DUE - 3 * HOUR, until: DUE, text: "Tenggat 3 jam lagi · II4091 — Tugas 02 Bab II · belum dikumpulkan" },
    ]);
  });

  it("at the times the Student chose, in any order saved; 1 hour before is one of them", () => {
    expect(
      plan([task()], { deadlineReminders: [1, 48, 24, 3] }).map(({ id, at, until }) => [id.split(":")[0], (DUE - at) / HOUR, (DUE - until) / HOUR]),
    ).toEqual([
      ["task.due48", 48, 24],
      ["task.due24", 24, 3],
      ["task.due3", 3, 1],
      ["task.due1", 1, 0],
    ]);
    expect(plan([task()], { deadlineReminders: [24, 1] }).map(({ id, until }) => [id.split(":")[0], (DUE - until) / HOUR])).toEqual([
      ["task.due24", 1],
      ["task.due1", 0],
    ]);
    expect(plan([task()], { deadlineReminders: [1] })[0].text).toBe("Tenggat 1 jam lagi · II4091 — Tugas 02 Bab II · belum dikumpulkan");
  });

  it("none chosen: no deadline reminders at all", () => {
    expect(plan([task()], { deadlineReminders: [] })).toEqual([]);
  });

  it("none from before the Task opened, none once it's handed in", () => {
    // Opened 30 hours before its deadline: 2 days before was before it existed.
    expect(plan([task({ opensAt: DUE - 30 * HOUR })]).map((r) => r.id.split(":")[0])).toEqual(["task.due24", "task.due3"]);
    expect(plan([task({ status: "submitted" })])).toEqual([]);
  });

  it("only a draft: says it's saved but not handed in, with the same ids", () => {
    const draft = plan([task({ status: "draft" })]);
    expect(draft.map((r) => r.text)).toEqual([
      "Tenggat 2 hari lagi · II4091 — Tugas 02 Bab II · masih draf, belum dikumpulkan",
      "Tenggat 24 jam lagi · II4091 — Tugas 02 Bab II · masih draf, belum dikumpulkan",
      "Tenggat 3 jam lagi · II4091 — Tugas 02 Bab II · masih draf, belum dikumpulkan",
    ]);
    expect(draft.map((r) => r.id)).toEqual(plan([task()]).map((r) => r.id));
    const [first] = deadlineReminders.plan!(context({ "edunex.tasks": [task({ status: "draft" })] }));
    expect(translate("en", first.body!.key, first.body!.vars)).toBe("Tugas 02 Bab II · still a draft, not submitted yet");
  });
});

describe("exam reminders", () => {
  const plan = (schedule: ClassSession[]) => read(examAlerts.plan!(context({ "six.schedule": schedule })));
  const uts = (start: string, end: string) =>
    session({ id: "2190001", courseCode: "DK4073", start: wib(start), end: wib(end), activity: "UTS", room: "TVST C" });

  it("a week before and that morning, each only while it's true, naming the day, time and room", () => {
    const start = wib("2026-10-15T11:00:00");
    expect(plan([uts("2026-10-15T11:00:00", "2026-10-15T13:00:00")])).toEqual([
      {
        id: `exam.week:six:2190001:${start}`,
        at: wib("2026-10-08T07:00:00"),
        until: wib("2026-10-09T00:00:00"),
        text: "UTS seminggu lagi · DK4073 — Kam, 15 Okt 11:00 · TVST C",
      },
      {
        id: `exam.tomorrow:six:2190001:${start}`,
        at: wib("2026-10-14T18:00:00"),
        until: wib("2026-10-15T00:00:00"),
        text: "UTS besok · DK4073 — Kam, 15 Okt 11:00 · TVST C",
      },
      { id: `exam.today:six:2190001:${start}`, at: wib("2026-10-15T07:00:00"), until: start, text: "UTS hari ini · DK4073 — Kam, 15 Okt 11:00 · TVST C" },
    ]);
  });

  it("an early exam's morning reminder comes an hour before it", () => {
    const today = plan([uts("2026-10-15T06:30:00", "2026-10-15T08:30:00")]).find((r) => r.id.startsWith("exam.today:"));
    expect(today).toMatchObject({
      at: wib("2026-10-15T05:30:00"),
      until: wib("2026-10-15T06:30:00"),
      text: "UTS hari ini · DK4073 — Kam, 15 Okt 06:30 · TVST C",
    });
  });
});

describe("class in 15 minutes", () => {
  const schedule = [session(), session({ id: "2190001", courseCode: "DK4073", start: wib("2026-10-15T11:00:00"), activity: "UTS", room: "TVST C" })];

  it("off unless the Student turns it on", () => {
    expect(classSoon.plan!(context({ "six.schedule": schedule }))).toEqual([]);
  });

  it("15 minutes before each class, with its room; not for an exam", () => {
    expect(read(classSoon.plan!(context({ "six.schedule": schedule }, { classSoonAlerts: true })))).toEqual([
      {
        id: `class.soon:2194343:${wib("2026-10-15T08:00:00")}:R.SG PWK LT.6`,
        at: wib("2026-10-15T07:45:00"),
        until: wib("2026-10-15T08:00:00"),
        text: "Kuliah 15 menit lagi · PL3002 — 08:00–09:30 · R.SG PWK LT.6",
      },
    ]);
  });
});
