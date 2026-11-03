// "Tambahkan ke kalender HP" on the exam page (the desktop's exam page has the schedule's export
// there): only this exam's own events, the very ones the Jadwal sheet puts in the phone's calendar
// (src/core/phone-calendar.ts), picked by their UIDs. SIX's sittings with their rooms, Edunex's
// dated sittings and the take-homes' deadlines. Same UIDs, so adding the whole calendar later
// updates these instead of adding copies.
import type { Exam } from "../../../../src/core/exams";
import type { PhoneItem } from "../../../../src/core/phone-calendar";

/** The UIDs phoneItems gives this exam's parts. */
export function examUids(exam: Pick<Exam, "six" | "edunex" | "tasks">): Set<string> {
  return new Set([
    ...exam.six.map((session) => `six-${session.id}@edunex-plus`),
    ...exam.edunex.map((sitting) => `edunex-exam-${sitting.id}@edunex-plus`),
    ...exam.tasks.map((task) => `edunex-task-${task.id}@edunex-plus`),
  ]);
}

/** This exam's events out of everything the phone calendar can hold, in their order. */
export function examCalendarItems(items: readonly PhoneItem[], exam: Pick<Exam, "six" | "edunex" | "tasks">): PhoneItem[] {
  const uids = examUids(exam);
  return items.filter((item) => uids.has(item.uid));
}
