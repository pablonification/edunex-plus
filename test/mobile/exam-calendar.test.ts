// "Tambahkan ke kalender HP" on the phone's exam page (mobile/src/screens/tasks/exam-calendar.ts):
// the exam's own events out of the very ones Jadwal's sheet puts in the phone's calendar, read from
// the real engine against the pretend Edunex and SIX.
import { describe, expect, it } from "vitest";
import { examCalendarItems } from "../../mobile/src/screens/tasks/exam-calendar";
import { mergeExams } from "../../src/core/exams";
import { phoneItems } from "../../src/core/phone-calendar";
import { startHome } from "../engine/needs-harness";

describe("an exam into the phone's calendar", () => {
  it("takes each exam's SIX sittings, Edunex sittings and take-home deadlines, and nothing else", async () => {
    const h = await startHome();
    const now = h.world.clock.now();
    const get = ((name: Parameters<typeof h.dataset>[0]) => h.dataset(name)) as never;
    const items = phoneItems(get, "id", now);
    const exams = mergeExams({
      schedule: h.dataset("six.schedule"),
      edunexExams: h.dataset("edunex.exams"),
      tasks: h.dataset("edunex.tasks"),
      outline: h.dataset("edunex.outline"),
      calendar: h.dataset("itb.calendar"),
      term: h.dataset("six.student")?.term ?? null,
      now,
    });
    const dated = exams.filter((exam) => exam.six.length > 0 || exam.tasks.some((task) => task.dueAt !== null) || exam.edunex.some((e) => e.start !== null));
    expect(dated.length).toBeGreaterThan(0);
    for (const exam of dated) {
      const mine = examCalendarItems(items, exam);
      const expected = exam.six.length + exam.edunex.filter((e) => e.start !== null).length + exam.tasks.filter((task) => task.dueAt !== null).length;
      expect(mine).toHaveLength(expected);
      for (const item of mine) expect(item.summary).toContain(exam.courseCode);
    }
    const sitting = dated.find((exam) => exam.six.length > 0);
    expect(sitting).toBeDefined();
    const [first] = examCalendarItems(items, sitting!);
    expect(first).toMatchObject({ kind: "exams", start: sitting!.six[0]!.start, location: sitting!.six[0]!.room });
  });

  it("an exam with no date anywhere has nothing to add", () => {
    expect(examCalendarItems([], { six: [], edunex: [], tasks: [] })).toEqual([]);
  });
});
