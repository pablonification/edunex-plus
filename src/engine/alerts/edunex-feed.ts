// Alerts from Edunex's own notification feed: ASSIGNMENT is a new Task,
// CONTENT a new material. The feed misses many Tasks, so the Tasks dataset
// raises them too; both use the same id, so a Task alerts once. When the
// Tasks dataset knows the Task better (a short window), that version wins.
// A material for a course that meets today comes from the materials dataset
// instead (./changes.ts), with its exact title and urgency.
import type { Course, EdunexNotification } from "../../core/models";
import { classesToday } from "./changes";
import type { AlertDraft, Detector } from "./detector";
import { newTaskAlert } from "./tasks";

/** Older items showing up (Edunex backfilling its list) are history, not news. */
const FRESH = 3 * 86_400_000;

const courseOf = (courses: readonly Course[], courseId: number) =>
  courses.find((course) => course.edunex.courseId === courseId || course.edunex.relatedCourseIds.includes(courseId));

export const edunexNotifications: Detector = {
  name: "edunex.notifications",
  watches: ["edunex.notifications"],
  changed(change, { now, get }) {
    if (change.name !== "edunex.notifications") return [];
    const known = new Set((change.previous ?? []).map((item) => item.key));
    const courses = get("edunex.courses") ?? [];
    const tasks = get("edunex.tasks") ?? [];
    const alerts: AlertDraft[] = [];
    for (const item of change.next) {
      if (known.has(item.key) || item.at < now - FRESH) continue;
      if (item.type === "task") {
        const task = tasks.find((t) => t.id === item.objectId);
        alerts.push(task ? newTaskAlert(task, now) : taskFromFeed(item, courses));
      } else {
        const course = courseOf(courses, item.objectId);
        if (course && get("edunex.materials") && classesToday(get("six.schedule"), course.code, now).length) continue;
        alerts.push({
          id: `material.new:${item.key}`,
          kind: "newMaterial",
          source: "edunex",
          title: { key: "alert.newMaterial", vars: { course: course?.code ?? item.courseName ?? "Edunex" } },
          body: { key: "alert.plain", vars: { title: item.title } },
          target: course ? { screen: "course", code: course.code, tab: "modules" } : { screen: "home" },
        });
      }
    }
    return alerts;
  },
};

function taskFromFeed(item: EdunexNotification, courses: readonly Course[]): AlertDraft {
  const course = courses.find((c) => c.name === item.courseName);
  return {
    id: `task.new:${item.objectId}`,
    kind: "newTask",
    source: "edunex",
    title: { key: "alert.newTask", vars: { course: course?.code ?? item.courseName ?? "Edunex" } },
    body: { key: "alert.plain", vars: { title: item.title } },
    target: { screen: "task", taskId: item.objectId },
  };
}
