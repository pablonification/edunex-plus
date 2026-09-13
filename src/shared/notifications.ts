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
  /** Window ids for Presence-open entries; absent for Task entries. */
  presenceIds?: string[];
  /** Entry kind — absent on pre-#24 Task entries (treated as task). */
  kind?: "single" | "digest" | "presence";
  createdAt: string;
  read: boolean;
}

/** Where an OS or in-app notification click should land. */
export interface NotificationDestination {
  /** The To Do screen (#21) is the destination for new-Task notifications. */
  view: "todo" | "agenda";
  /** Set for a single-task notification; absent for a digest. */
  taskId: string | null;
  /** Set for a Presence-open notification; absent otherwise. */
  presenceId?: string | null;
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
  notification: TaskNotification | PresenceNotification,
  id: string,
): InAppNotification {
  if (notification.kind === "presence") {
    return {
      id,
      title: notification.title,
      body: notification.body,
      taskIds: [],
      presenceIds: [...notification.presenceIds],
      kind: "presence",
      createdAt: notification.createdAt,
      read: false,
    };
  }
  return {
    id,
    title: notification.title,
    body: notification.body,
    taskIds: [...notification.taskIds],
    kind: notification.kind,
    createdAt: notification.createdAt,
    read: false,
  };
}

/** A Presence window distilled for notification use. */
export interface PresenceWindowInfo {
  id: string;
  courseCode: string;
  courseName: string;
  meeting: string;
  startAt: string;
  endAt: string;
}

/**
 * An immediate Presence-open alert (#24): one window, never coalesced into
 * a digest. Time-critical windows bypass the tick-burst digest rule that
 * new-Task notifications follow.
 */
export interface PresenceNotification {
  kind: "presence";
  title: string;
  body: string;
  /** Window ids covered — always length 1 in v1 (no coalescing). */
  presenceIds: string[];
  /** Full window details, in feed order (length 1 in v1). */
  windows: PresenceWindowInfo[];
  createdAt: string;
}

/** Any outbound notification the sink interface can deliver. */
export type OutboundNotification = TaskNotification | PresenceNotification;

/** Presence-open copy: the course + meeting lead so the window is actionable. */
export function buildPresenceNotification(
  window: PresenceWindowInfo,
  createdAt: string,
): PresenceNotification {
  const course = window.courseCode || window.courseName;
  const where = course ? `${window.meeting} — ${course}` : window.meeting;
  return {
    kind: "presence",
    title: "Presence open",
    body: `${where} — Presence is open`,
    presenceIds: [window.id],
    windows: [window],
    createdAt,
  };
}

export function presenceDestinationFor(
  notification: Pick<PresenceNotification, "presenceIds">,
): NotificationDestination {
  // v1 windows are agenda meetings, so the click lands on the agenda where
  // the open meeting is visible (the Presence view holds history records).
  return {
    view: "agenda",
    taskId: null,
    presenceId: notification.presenceIds.length === 1 ? notification.presenceIds[0] : null,
  };
}
