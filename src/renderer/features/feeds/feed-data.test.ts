import { describe, expect, it } from "vitest";
import {
  filterTodoItemsByCourses,
  scopeCoursesToPeriod,
  toCourseItems,
  toCurrentPeriodId,
  toPeriodItems,
  toTodoItems,
} from "./feed-data";

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

  it("keeps the useful fields from a real course payload and derives offered Periods", () => {
    const courses = toCourseItems({
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
            modules: 16,
            sks: 3,
            hue: "#DCE4F5",
            is_current: true,
          },
        },
        {
          type: "course",
          id: "402",
          attributes: {
            code: "ME4066",
            name: "Climate Change",
            class_name: "ME4066-03",
            semester: 1,
            year: "2026-1",
            modules: 4,
            sks: 2,
            hue: "#FBE3CD",
          },
        },
        {
          type: "course",
          id: "350",
          attributes: {
            code: "IF4050",
            name: "Older Period Course",
            class_name: "IF4050-01",
            semester: 2,
            year: "2025-2",
          },
        },
      ],
    });

    expect(courses[0]).toMatchObject({
      sks: 3,
      moduleCount: 16,
      color: "#DCE4F5",
      isCurrent: true,
    });
    expect(toCurrentPeriodId(courses)).toBe("2026-1");
    expect(toPeriodItems(courses)).toEqual([
      { id: "2026-1", label: "Period 2026-1", count: 2 },
      { id: "2025-2", label: "Period 2025-2", count: 1 },
    ]);
  });

  it("scopes courses and To Do items to the selected offered Period", () => {
    const courses = toCourseItems({
      data: [
        {
          id: "401",
          attributes: {
            code: "II4091",
            name: "Current course",
            year: "2026-1",
            is_current: true,
          },
        },
        {
          id: "350",
          attributes: { code: "IF4050", name: "Older course", year: "2025-2" },
        },
      ],
    });
    const todo = toTodoItems({
      tasks: [
        { id: 1, code: "II4091", name: "Current task" },
        { id: 2, code: "IF4050", name: "Older task" },
      ],
      exams: [],
    });

    const selectedCourses = scopeCoursesToPeriod(courses, "2025-2");

    expect(selectedCourses.map((course) => course.code)).toEqual(["IF4050"]);
    expect(filterTodoItemsByCourses(todo, selectedCourses).map((item) => item.title)).toEqual([
      "Older task",
    ]);
  });
});
