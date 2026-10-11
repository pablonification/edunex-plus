// A complete Task for tests that put Tasks on screen or in the engine without
// reading them from the pretend EduNex: the shared fields come from the test,
// the Task-page fields get plain defaults.
import type { Task } from "../../src/core/models";

type Shared = Pick<Task, "id" | "courseCode" | "courseId" | "title" | "status"> & Partial<Task>;

export function aTask(fields: Shared): Task {
  return {
    moduleId: null,
    opensAt: null,
    dueAt: null,
    score: null,
    module: null,
    kind: "task",
    instructions: "",
    files: [],
    fileRequired: false,
    lateAllowed: false,
    closed: false,
    answer: null,
    postedAt: null,
    editedAt: null,
    ...fields,
  };
}
