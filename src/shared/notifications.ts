/**
 * Notification contracts shared by the main process, preload bridge, and
 * renderer. The main process detects new Tasks (id-diff against the snapshot
 * cache plus a persisted seen-ledger), fans out through a sink interface to
 * the OS notification and the in-app fallback feed, and the renderer reads
 * the fallback feed over IPC. This file must stay dependency-free (no
 * Electron imports) so every side can use it.
 */

/** A pending Task distilled from the `/todo` feed for notification use. */
export interface NewTaskInfo {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  dueAt: string | null;
}

/** A coalesced outbound notification: one Task, or one digest for a burst. */
export interface TaskNotification {
  kind: "single" | "digest";
  title: string;
  body: string;
  /** Task ids covered by this notification, in feed order. */
  taskIds: string[];
  /** Full task details, in feed order (length 1 for single). */
  tasks: NewTaskInfo[];
  createdAt: string;
}

/** A persisted in-app fallback entry (the Notification Center feed). */
export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  taskIds: string[];
  createdAt: string;
  read: boolean;
}

/** Where an OS or in-app notification click should land. */
export interface NotificationDestination {
  /** The To Do screen (#21) is the destination for new-Task notifications. */
  view: "todo";
  /** Set for a single-task notification; absent for a digest. */
  taskId: string | null;
}

export function notificationDestinationFor(
  notification: Pick<TaskNotification, "taskIds">,
): NotificationDestination {
  return {
    view: "todo",
    taskId: notification.taskIds.length === 1 ? notification.taskIds[0] : null,
  };
}

/** Single-task notification copy: the task title leads, course trails. */
export function buildSingleTaskNotification(
  task: NewTaskInfo,
  createdAt: string,
): TaskNotification {
  const course = task.courseCode || task.courseName;
  return {
    kind: "single",
    title: "New task",
    body: course ? `${task.title} — ${course}` : task.title,
    taskIds: [task.id],
    tasks: [task],
    createdAt,
  };
}

/** Burst notification copy: one digest, never one popup per task. */
export function buildDigestTaskNotification(
  tasks: NewTaskInfo[],
  createdAt: string,
): TaskNotification {
  const names = tasks
    .slice(0, 3)
    .map((task) => task.title)
    .join("; ");
  const remainder = tasks.length > 3 ? `, +${tasks.length - 3} more` : "";
  return {
    kind: "digest",
    title: `${tasks.length} new tasks`,
    body: `${names}${remainder} — see To Do`,
    taskIds: tasks.map((task) => task.id),
    tasks: [...tasks],
    createdAt,
  };
}

export function buildTaskNotification(
  tasks: NewTaskInfo[],
  createdAt: string,
): TaskNotification | null {
  if (tasks.length === 0) return null;
  if (tasks.length === 1) return buildSingleTaskNotification(tasks[0], createdAt);
  return buildDigestTaskNotification(tasks, createdAt);
}

export function toInAppNotification(
  notification: TaskNotification,
  id: string,
): InAppNotification {
  return {
    id,
    title: notification.title,
    body: notification.body,
    taskIds: [...notification.taskIds],
    createdAt: notification.createdAt,
    read: false,
  };
}
