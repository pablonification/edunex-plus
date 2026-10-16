// Alerts from the Tasks dataset: a new Task (a short-window one at once), and
// reminders before the deadline while it isn't submitted, at the times the
// Student chose in Settings (2 days, 1 day and 3 hours by default), saying so
// when it's only a draft. A reminder's id carries the deadline, so a moved
// deadline gets new reminders at the new times, and a submitted Task has none.
import { DEADLINE_REMINDERS, type DeadlineReminder, type Task } from "../../core/models";
import type { StringKey } from "../../core/strings";
import { type AlertDraft, clockTime, type Detector, type PlannedAlert } from "./detector";

const HOUR = 3_600_000;
/** A Task whose whole answer window is this short is announced at once, never grouped. */
const SHORT_WINDOW = 12 * HOUR;

const notSubmitted = (task: Task) => task.status === "not_started" || task.status === "draft";

export function newTaskAlert(task: Task, now: number): AlertDraft {
  const base = { id: `task.new:${task.id}`, kind: "newTask", source: "edunex", target: { screen: "task", taskId: task.id } } as const;
  const opens = Math.max(task.opensAt ?? now, now);
  if (task.dueAt !== null && task.dueAt > now && task.dueAt - opens <= SHORT_WINDOW) {
    return {
      ...base,
      urgent: true,
      title: { key: "alert.shortTask", vars: { course: task.courseCode } },
      body: { key: "alert.shortTask.body", vars: { title: task.title, time: clockTime(task.dueAt) } },
    };
  }
  return { ...base, title: { key: "alert.newTask", vars: { course: task.courseCode } }, body: { key: "alert.plain", vars: { title: task.title } } };
}

export const newTasks: Detector = {
  name: "tasks.new",
  watches: ["edunex.tasks"],
  changed(change, { now }) {
    if (change.name !== "edunex.tasks") return [];
    const known = new Set((change.previous ?? []).map((task) => task.id));
    return change.next
      .filter((task) => !known.has(task.id) && (task.status === "not_started" || task.status === "draft") && (task.dueAt === null || task.dueAt > now))
      .map((task) => newTaskAlert(task, now));
  },
};

/** Each reminder's id and title. The 24- and 3-hour ids are the ones earlier versions used, so a reminder already seen doesn't come again. */
const REMINDER: Record<DeadlineReminder, { id: string; title: StringKey }> = {
  48: { id: "task.due48", title: "alert.due48" },
  24: { id: "task.due24", title: "alert.due24" },
  3: { id: "task.due3", title: "alert.due3" },
  1: { id: "task.due1", title: "alert.due1" },
};

export const deadlineReminders: Detector = {
  name: "tasks.deadline",
  watches: ["edunex.tasks"],
  plan({ get, settings }) {
    // Earliest first: each reminder lasts until the next one is due, the last until the deadline.
    const chosen = DEADLINE_REMINDERS.filter((hours) => settings.deadlineReminders.includes(hours));
    const planned: PlannedAlert[] = [];
    for (const task of get("edunex.tasks") ?? []) {
      if (task.dueAt === null || !notSubmitted(task)) continue;
      const due = task.dueAt;
      const common = { kind: "deadline", source: "edunex", target: { screen: "task", taskId: task.id } } as const;
      // Saved but not handed in: a draft the Student may think is in.
      const body = { key: task.status === "draft" ? "alert.due.draft" : "alert.due.body", vars: { title: task.title } } as const;
      const reminders = chosen.map(
        (hours, i): PlannedAlert => ({
          ...common,
          id: `${REMINDER[hours].id}:${task.id}:${due}`,
          at: due - hours * HOUR,
          until: due - (chosen[i + 1] ?? 0) * HOUR,
          title: { key: REMINDER[hours].title, vars: { course: task.courseCode } },
          body,
        }),
      );
      // A reminder from before the Task opened says nothing the new-Task alert didn't (a 2-hour quiz).
      planned.push(...reminders.filter((reminder) => task.opensAt === null || reminder.at >= task.opensAt));
    }
    return planned;
  },
};
