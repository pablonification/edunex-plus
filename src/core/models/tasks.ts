// Tasks with the Student's answers (#72, #73). The first fields are shared
// with the course page and later screens; the rest serve the Task page and
// handing in. What the facts mean at a given moment (status, signals) lives
// in src/core/tasks.ts.
import { z } from "zod";

/** A Task's true status, from the answer's submit bit and the Task's own dates and state. */
export const TaskStatus = z.enum(["not_started", "draft", "submitted", "overdue", "closed", "in_review"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

/** A file on Edunex's storage: one the lecturer attached, or one in the Student's answer. */
export const TaskFile = z.object({ name: z.string(), url: z.string() });
export type TaskFile = z.infer<typeof TaskFile>;

/** Where a Task sits in its course's outline ("Modul 5 · Tugas"). */
export const TaskModule = z.object({ index: z.number(), name: z.string() });
export type TaskModule = z.infer<typeof TaskModule>;

/** The Student's answer. Only `sent` (Edunex's submit bit) means it was handed in. */
export const TaskAnswer = z.object({
  /** Edunex's answer id. */
  id: z.number(),
  sent: z.boolean(),
  /** The written answer (HTML), when there is one. */
  text: z.string().nullable(),
  files: z.array(TaskFile),
  /** First and last saved (ms). A draft's times never mean it was handed in. */
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  /** When it was handed in; null until `sent`. */
  sentAt: z.number().nullable(),
  /** When the lecturer took it up for grading (Edunex's `verified_at`). */
  reviewedAt: z.number().nullable(),
});
export type TaskAnswer = z.infer<typeof TaskAnswer>;

export const Task = z.object({
  /** Edunex's Task id. */
  id: z.number(),
  courseCode: z.string(),
  /** The Edunex course it sits in (the class's own course or its parent). */
  courseId: z.number(),
  /** The module the lecturer put it in (Edunex `taskable_id` when `taskable_type` is modules). */
  moduleId: z.number().nullable(),
  title: z.string(),
  /** As of the last check; screens use taskStatus(task, now), which a passing deadline changes. */
  status: TaskStatus,
  /** When it opens and is due (ms since epoch). */
  opensAt: z.number().nullable(),
  dueAt: z.number().nullable(),
  /** The score, once the lecturer shows it. */
  score: z.number().nullable(),

  /** The module's place and name, when Edunex gave the course outline. */
  module: TaskModule.nullable(),
  /** Edunex's category: a regular Task, or a take-home UTS or UAS (`domain: "uts"` / `"UAS"`). */
  kind: z.enum(["task", "uts", "uas"]),
  /** The lecturer's instructions as HTML: shown only through the safe renderer. */
  instructions: z.string(),
  /** Files the lecturer attached. */
  files: z.array(TaskFile),
  fileRequired: z.boolean(),
  lateAllowed: z.boolean(),
  /** Edunex had stopped taking answers at the last check (`open_status: "overdue"`: past its deadline, no late answers). */
  closed: z.boolean(),
  answer: TaskAnswer.nullable(),
  /** When the lecturer posted it. */
  postedAt: z.number().nullable(),
  /** When the lecturer changed it after posting; Edunex never announces edits. */
  editedAt: z.number().nullable(),
  /** A group Task: the group hands it in on Edunex, through pages the app doesn't copy. Missing in data saved before it was read. */
  group: z.boolean().optional(),
});
export type Task = z.infer<typeof Task>;

export const tasksDatasets = {
  /** Every Task of this term's courses (and their parent classes), with the Student's answers. */
  "edunex.tasks": z.array(Task),
} as const;
