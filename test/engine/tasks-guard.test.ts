// Before handing in (audit A, sev 4): what the app checks so a hand-in can't
// cost the Student their attendance: the Presence window that hand-in counts
// for, the deadline, the connection, the file the lecturer asked for.
import { describe, expect, it } from "vitest";
import type { PresenceSession, Task } from "../../src/core/models";
import { attendanceResult, handInChecks, matchesNaming, namingPattern, requiredFileType } from "../../src/core/tasks";

const at = (iso: string) => Date.parse(iso);
const task = (patch: Partial<Task> = {}): Task => ({
  id: 117003,
  courseCode: "II4091",
  courseId: 1,
  moduleId: null,
  title: "Tugas 02 Bab II",
  status: "not_started",
  opensAt: null,
  dueAt: at("2026-10-16T23:59:00+07:00"),
  score: null,
  module: null,
  kind: "task",
  instructions: "<ol><li>File diunggah dengan format .pdf.</li><li>Penamaan file &#39;NIM Nama - Tugas 02.pdf&#39;.</li></ol>",
  files: [],
  fileRequired: true,
  lateAllowed: true,
  closed: false,
  answer: null,
  postedAt: null,
  editedAt: null,
  ...patch,
});
const session = (patch: Partial<PresenceSession> = {}): PresenceSession => ({
  id: 9,
  courseId: 1,
  classId: 1,
  start: at("2026-10-16T15:00:00+07:00"),
  end: at("2026-10-16T17:00:00+07:00"),
  opensAt: at("2026-10-16T15:00:00+07:00"),
  closesAt: at("2026-10-16T23:59:00+07:00"),
  topic: null,
  note: null,
  countsBy: [{ kind: "assignment", id: "117003" }],
  url: null,
  recorded: null,
  ...patch,
});
const facts = (now: string, patch: Partial<Parameters<typeof handInChecks>[1]> = {}) => ({
  now: at(now),
  sessions: [session()],
  edunex: "live" as const,
  files: [{ name: "18222001 Dimas - Tugas 02.pdf" }],
  ...patch,
});
const kinds = (result: ReturnType<typeof handInChecks>) => result.checks.map((c) => c.kind);

describe("before handing in", () => {
  it("before the attendance window opens: a warning, and waiting is the safe default", () => {
    const result = handInChecks(task(), facts("2026-10-08T08:12:00+07:00"));
    expect(kinds(result)).toEqual(["attendanceEarly"]);
    expect(result.waitForWindow).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("inside the window: it counts, nothing to wait for", () => {
    const result = handInChecks(task(), facts("2026-10-16T16:00:00+07:00"));
    expect(kinds(result)).toEqual(["attendanceIn"]);
    expect(result.waitForWindow).toBe(false);
  });

  it("after the window closed: says it won't count, but waiting doesn't help", () => {
    const result = handInChecks(task({ dueAt: at("2026-10-20T23:59:00+07:00") }), facts("2026-10-18T10:00:00+07:00"));
    expect(kinds(result)).toEqual(["attendanceMissed"]);
    expect(result.waitForWindow).toBe(false);
  });

  it("a Task that isn't attendance has no window check", () => {
    expect(kinds(handInChecks(task({ id: 1 }), facts("2026-10-08T08:12:00+07:00")))).toEqual([]);
  });

  it("no connection or an ended session blocks handing in", () => {
    expect(handInChecks(task(), facts("2026-10-16T16:00:00+07:00", { edunex: "offline" })).blocked).toBe(true);
    expect(kinds(handInChecks(task(), facts("2026-10-16T16:00:00+07:00", { edunex: "expired" })))[0]).toBe("expired");
  });

  it("late, the wrong file type and a name unlike the asked one are warned about", () => {
    const result = handInChecks(task({ dueAt: at("2026-10-07T23:59:00+07:00") }), facts("2026-10-08T08:12:00+07:00", { sessions: [], files: [{ name: "Laporan Tugas - Dimas Pratama.docx" }] }));
    expect(kinds(result)).toEqual(["late", "fileType", "naming"]);
  });
});

describe("after handing in", () => {
  it("inside the window counts; outside it doesn't", () => {
    const sent = (iso: string) =>
      task({ answer: { id: 1, sent: true, text: null, files: [], createdAt: null, updatedAt: null, sentAt: at(iso), reviewedAt: null } });
    expect(attendanceResult(sent("2026-10-16T16:00:00+07:00"), [session()], at("2026-10-17T09:00:00+07:00"))?.outcome).toBe("counted");
    expect(attendanceResult(sent("2026-10-08T08:12:00+07:00"), [session()], at("2026-10-08T09:00:00+07:00"))?.outcome).toBe("outside");
    expect(attendanceResult(task(), [session()], at("2026-10-08T09:00:00+07:00"))).toBeNull();
  });
});

describe("what the lecturer asks of the file", () => {
  it("reads the asked name and type from the instructions", () => {
    expect(namingPattern(task().instructions)).toBe("NIM Nama - Tugas 02.pdf");
    expect(requiredFileType(task().instructions)).toBe("pdf");
    expect(requiredFileType("Kerjakan soal di buku.")).toBeNull();
    expect(namingPattern("Kumpulkan laporan.pdf")).toBeNull();
  });

  it("a name matches when the fixed words and the type match; NIM and Nama can be anything", () => {
    expect(matchesNaming("NIM Nama - Tugas 02.pdf", "18222001 Dimas Pratama - Tugas 2.pdf")).toBe(true);
    expect(matchesNaming("NIM Nama - Tugas 02.pdf", "Laporan Tugas - Dimas Pratama.pdf")).toBe(false);
    expect(matchesNaming("NIM Nama - Tugas 02.pdf", "18222001 Dimas - Tugas 02.docx")).toBe(false);
  });
});
