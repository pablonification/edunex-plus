// Tasks with the Student's answers (#72, #73). The fields below are shared
// with the course page and later screens; #72 adds the rest.
import { z } from "zod";

/** A Task's true status, from the answer's submit bit and the Task's own dates and state. */
export const TaskStatus = z.enum(["not_started", "draft", "submitted", "overdue", "closed", "in_review"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Task = z.object({
  /** EduNex's Task id. */
  id: z.number(),
  courseCode: z.string(),
  /** The EduNex course it sits in (the class's own course or its parent). */
  courseId: z.number(),
  /** The module the lecturer put it in (EduNex `taskable_id` when `taskable_type` is modules). */
  moduleId: z.number().nullable(),
  title: z.string(),
  status: TaskStatus,
  /** When it opens and is due (ms since epoch). */
  opensAt: z.number().nullable(),
  dueAt: z.number().nullable(),
  /** The score, once the lecturer shows it. */
  score: z.number().nullable(),
});
export type Task = z.infer<typeof Task>;

export const tasksDatasets = {} as const;
