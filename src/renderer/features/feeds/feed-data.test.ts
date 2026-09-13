import { describe, expect, it } from "vitest";
import { toCourseItems, toTodoItems } from "./feed-data";

describe("cached feed view models", () => {
  it("maps the plain /todo response into Task and Exam rows", () => {
    expect(
      toTodoItems({
        tasks: [
          {
            type: "task",
            code: "II4091",
            course: "Final Project Proposal",
            name: "Answer Tugas 01",
            time: "2026-09-14T23:59:00.000Z",
            id: 113986,
            taskable_id: 450219,
          },
        ],
        exams: [
          {
            type: "exam",
            code: "ME4066",
            course: "Climate Change",
            name: "Quiz 01",
            time: "2026-09-10T02:00:00.000Z",
            id: 9001,
          },
        ],
        questions: [],
        modules: [],
      }),
    ).toEqual([
      {
        id: "113986",
        kind: "Task",
        title: "Answer Tugas 01",
        courseCode: "II4091",
        courseName: "Final Project Proposal",
        dueAt: "2026-09-14T23:59:00.000Z",
      },
      {
        id: "9001",
        kind: "Exam",
        title: "Quiz 01",
        courseCode: "ME4066",
        courseName: "Climate Change",
        dueAt: "2026-09-10T02:00:00.000Z",
      },
    ]);
  });

  it("maps the JSON-API /course/courses response into course cards", () => {
    expect(
      toCourseItems({
        meta: { page: { limit: 9, offset: 0 } },
        data: [
          {
            type: "course",
            id: "401",
            attributes: {
              code: "II4091",
              name: "Final Project Proposal",
              class_name: "II4091-01",
              semester: 1,
              year: "2026-1",
              faculty: "STEI",
              lecturer: "Dr. Example",
            },
          },
        ],
      }),
    ).toEqual([
      {
        id: "401",
        code: "II4091",
        name: "Final Project Proposal",
        className: "II4091-01",
        period: "2026-1",
        faculty: "STEI",
        lecturer: "Dr. Example",
      },
    ]);
  });
});
