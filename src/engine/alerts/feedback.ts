// Alerts for what a lecturer says about the Student's answer: a Task handed
// back to work on again (urgent: it has to go in again), and a new message
// from a lecturer in the thread under an answer. A message the lecturer wrote
// as they handed the Task back is that hand-back's, never a second alert. The
// first sync is silent (the center does that); a thread the app reads for the
// first time announces only what's new (the last three days).
import { htmlText } from "../../core/course-materials";
import { handedBackAt } from "../../core/tasks";
import type { AlertDraft, Detector } from "./detector";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** A thread read for the first time: older messages than this were there before the app looked. */
const FRESH = 3 * DAY;
/** A lecturer's message this close to their hand-back is its reason: the hand-back says it. */
const WITH_HAND_BACK = 10 * MINUTE;
/** How much of a message the notification quotes. */
const QUOTE = 120;

export const handedBack: Detector = {
  name: "tasks.handedBack",
  watches: ["edunex.tasks"],
  changed(change) {
    if (change.name !== "edunex.tasks" || !change.previous) return [];
    const before = new Map(change.previous.map((task) => [task.id, task]));
    const alerts: AlertDraft[] = [];
    for (const task of change.next) {
      const at = handedBackAt(task);
      const previous = before.get(task.id);
      // A Task new to the list is the new-Task alert's.
      if (at === null || !previous || handedBackAt(previous) === at) continue;
      alerts.push({
        id: `task.handedBack:${task.id}:${at}`,
        kind: "taskHandedBack",
        source: "edunex",
        urgent: true,
        title: { key: "alert.handedBack", vars: { course: task.courseCode } },
        body: { key: "alert.handedBack.body", vars: { title: task.title } },
        target: { screen: "task", taskId: task.id },
      });
    }
    return alerts;
  },
};

export const lecturerMessages: Detector = {
  name: "tasks.comments",
  watches: ["edunex.taskThreads"],
  changed(change, { now, get }) {
    if (change.name !== "edunex.taskThreads" || !change.previous) return [];
    const known = new Map(change.previous.map((thread) => [thread.answerId, new Set(thread.messages.map((message) => message.id))]));
    const tasks = new Map((get("edunex.tasks") ?? []).map((task) => [task.id, task]));
    const alerts: AlertDraft[] = [];
    for (const thread of change.next) {
      const task = tasks.get(thread.taskId);
      if (!task) continue;
      const seen = known.get(thread.answerId);
      const backAt = task.answer?.id === thread.answerId ? (task.answer.handedBack?.at ?? null) : null;
      for (const message of thread.messages) {
        if (message.from !== "lecturer" || seen?.has(message.id)) continue;
        if (!seen && (message.at === null || now - message.at > FRESH)) continue;
        if (backAt !== null && message.at !== null && Math.abs(message.at - backAt) <= WITH_HAND_BACK) continue;
        const text = htmlText(message.html).replace(/\s+/g, " ").trim();
        alerts.push({
          id: `task.comment:${message.id}`,
          kind: "taskComment",
          source: "edunex",
          urgent: false,
          title: { key: "alert.taskComment", vars: { course: task.courseCode } },
          body: { key: "alert.taskComment.body", vars: { title: task.title, text: text.length > QUOTE ? `${text.slice(0, QUOTE - 1).trimEnd()}…` : text } },
          target: { screen: "task", taskId: task.id },
        });
      }
    }
    return alerts;
  },
};
