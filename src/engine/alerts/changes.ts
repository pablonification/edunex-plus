// Alerts for changes EduNex never announces (#77): a Task the lecturer edited
// after posting it (urgent when it was edited after the Student handed it in:
// they may need to hand it in again), and material posted for a class that
// meets today per SIX's timetable (urgent while that class is still to come
// or going on). The first sync is silent (the center does that); a Task new
// to the list is the new-Task alert, never an edit.
import { wibDay } from "../../core/course-meetings";
import type { ClassSession } from "../../core/models";
import { materialPostedId, taskEditedId, taskEditedText } from "../../core/needs";
import { editedAfterSubmit } from "../../core/tasks";
import { type AlertDraft, clockTime, type Detector } from "./detector";

export const taskEdits: Detector = {
  name: "tasks.edited",
  watches: ["edunex.tasks"],
  changed(change) {
    if (change.name !== "edunex.tasks" || !change.previous) return [];
    const before = new Map(change.previous.map((task) => [task.id, task]));
    const alerts: AlertDraft[] = [];
    for (const task of change.next) {
      const previous = before.get(task.id);
      if (!previous || task.editedAt === null || task.editedAt === previous.editedAt) continue;
      alerts.push({
        id: taskEditedId(task),
        kind: "taskEdited",
        source: "edunex",
        urgent: editedAfterSubmit(task),
        ...taskEditedText(task),
        target: { screen: "task", taskId: task.id },
      });
    }
    return alerts;
  },
};

/** SIX's meetings of a course on the day `now` falls in (WIB). */
export function classesToday(schedule: readonly ClassSession[] | undefined, code: string, now: number): ClassSession[] {
  const day = wibDay(now);
  return (schedule ?? []).filter((s) => s.courseCode === code && wibDay(s.start) === day).sort((a, b) => a.start - b.start);
}

export const materialForToday: Detector = {
  name: "materials.today",
  watches: ["edunex.materials"],
  changed(change, { now, get }) {
    if (change.name !== "edunex.materials" || !change.previous) return [];
    const schedule = get("six.schedule");
    const alerts: AlertDraft[] = [];
    for (const [code, materials] of Object.entries(change.next)) {
      const today = classesToday(schedule, code, now);
      // Only for today's class: other new materials come from EduNex's own feed.
      if (!today.length) continue;
      const known = new Set((change.previous[code] ?? []).map((m) => m.id));
      const coming = today.find((s) => s.end > now);
      for (const material of materials) {
        if (known.has(material.id)) continue;
        alerts.push({
          id: materialPostedId(material),
          kind: "newMaterial",
          source: "edunex",
          urgent: coming !== undefined,
          title: { key: "alert.materialToday", vars: { course: code } },
          body: { key: "alert.materialToday.body", vars: { title: material.title, time: clockTime((coming ?? today[0]).start) } },
          target: { screen: "course", code, tab: "modules" },
        });
      }
    }
    return alerts;
  },
};
