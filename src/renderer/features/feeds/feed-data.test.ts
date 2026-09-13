import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  filterAgendaItemsByCourse,
  filterExamsByCourse,
  filterExamsByCourses,
  filterTodoItemsByCourses,
  isViconMeeting,
  scopeCoursesToPeriod,
  toAgendaItems,
  toCourseItems,
  toCurrentPeriodId,
  toExamItems,
  toPeriodItems,
  toTodoItems,
  toTodoSections,
} from "./feed-data";
import { AgendaList, ExamsTable, TodoSections } from "./feed-panels";
import { readCachedFeed } from "./use-cached-feed";

const todoFixture = {
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
};

describe("cached feed view models", () => {
  it("maps the plain /todo response into Task and Exam rows", () => {
    expect(toTodoItems(todoFixture)).toEqual([
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

  it("reads a cached /todo snapshot through the preload seam and hides empty categories", async () => {
    const snapshot = {
      feed: "todo" as const,
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: { ...todoFixture, exams: [] },
    };
    const bridge = { getFeed: vi.fn(async () => snapshot) };

    const cached = await readCachedFeed("todo", bridge);

    expect(cached).toEqual(snapshot);
    expect(toTodoSections(cached?.data)).toEqual([
      {
        key: "tasks",
        label: "Tasks",
        items: [
          {
            id: "113986",
            kind: "Task",
            title: "Answer Tugas 01",
            courseCode: "II4091",
            courseName: "Final Project Proposal",
            dueAt: "2026-09-14T23:59:00.000Z",
          },
        ],
      },
    ]);
    expect(bridge.getFeed).toHaveBeenCalledWith("todo");
  });

  it("renders cached Tasks and Exams as free-tier tables with API deadlines", async () => {
    const snapshot = {
      feed: "todo" as const,
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: todoFixture,
    };
    const bridge = { getFeed: vi.fn(async () => snapshot) };
    const cached = await readCachedFeed("todo", bridge);
    const markup = renderToStaticMarkup(
      createElement(TodoSections, {
        sections: toTodoSections(cached?.data),
        onTaskSelect: vi.fn(),
      }),
    );

    expect(markup).toContain("<table");
    expect(markup).toContain(">Tasks<");
    expect(markup).toContain(">Exams<");
    expect(markup).toContain('aria-label="Open task Answer Tugas 01"');
    expect(markup).toContain('dateTime="2026-09-14T23:59:00.000Z"');
    expect(markup).toContain('dateTime="2026-09-10T02:00:00.000Z"');
    expect(markup).toContain("Quiz 01");
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

  it("maps the plain /exam/exams response into read-only rows with title, course and time", () => {
    const examsFixture = [
      {
        type: "exam",
        code: "II4091",
        course: "Final Project Proposal",
        name: "UTS — Final Project Proposal",
        time: "2026-10-13T02:00:00.000Z",
        id: 7001,
      },
      {
        type: "exam",
        code: "ME4066",
        course: "Climate Change",
        name: "UAS — Climate Change",
        time: "2026-12-01T02:00:00.000Z",
        id: 7002,
      },
    ];

    expect(toExamItems(examsFixture)).toEqual([
      {
        id: "7001",
        title: "UTS — Final Project Proposal",
        courseCode: "II4091",
        courseName: "Final Project Proposal",
        time: "2026-10-13T02:00:00.000Z",
      },
      {
        id: "7002",
        title: "UAS — Climate Change",
        courseCode: "ME4066",
        courseName: "Climate Change",
        time: "2026-12-01T02:00:00.000Z",
      },
    ]);

    // Wrapped envelopes decode to the same rows.
    expect(toExamItems({ exams: examsFixture })).toEqual(toExamItems(examsFixture));
    expect(toExamItems({ data: examsFixture })).toEqual(toExamItems(examsFixture));
  });

  it("reads a cached /exam/exams snapshot through the preload seam and scopes it", async () => {
    const snapshot = {
      feed: "exams" as const,
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: [
        {
          type: "exam",
          code: "II4091",
          course: "Final Project Proposal",
          name: "UTS — Final Project Proposal",
          time: "2026-10-13T02:00:00.000Z",
          id: 7001,
        },
      ],
    };
    const bridge = { getFeed: vi.fn(async () => snapshot) };

    const cached = await readCachedFeed("exams", bridge);

    expect(cached).toEqual(snapshot);
    expect(bridge.getFeed).toHaveBeenCalledWith("exams");
    const items = toExamItems(cached?.data);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "UTS — Final Project Proposal" });

    const courses = toCourseItems({
      data: [
        { id: "401", attributes: { code: "II4091", name: "Current", year: "2026-1" } },
        { id: "350", attributes: { code: "IF4050", name: "Older", year: "2025-2" } },
      ],
    });
    expect(
      filterExamsByCourses(items, scopeCoursesToPeriod(courses, "2025-2")),
    ).toEqual([]);
    expect(
      filterExamsByCourse(items, courses[0]).map((item) => item.title),
    ).toEqual(["UTS — Final Project Proposal"]);
  });

  it("renders cached exams as a read-only table with API times and no actions", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamsTable, {
        items: toExamItems([
          {
            type: "exam",
            code: "II4091",
            course: "Final Project Proposal",
            name: "UTS — Final Project Proposal",
            time: "2026-10-13T02:00:00.000Z",
            id: 7001,
          },
        ]),
        showCourse: true,
      }),
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("UTS — Final Project Proposal");
    expect(markup).toContain("II4091");
    expect(markup).toContain('dateTime="2026-10-13T02:00:00.000Z"');
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<a ");
  });
});

const agendaFixture = [
  {
    type: "offline",
    course_name: "Final Project Proposal",
    name: "Week 06 — Studio review",
    start_at: "2026-09-23T07:00:00.000Z",
    end_at: "2026-09-23T09:00:00.000Z",
    id: 502,
  },
  {
    type: "vicon",
    course_name: "Final Project Proposal",
    name: "Week 05 — Online guidance",
    start_at: "2026-09-16T07:00:00.000Z",
    end_at: "2026-09-16T09:00:00.000Z",
    id: 501,
  },
];

describe("course agenda view model", () => {
  it("maps the plain-array /course/agenda response and orders meetings chronologically", () => {
    expect(toAgendaItems(agendaFixture)).toEqual([
      {
        id: "501",
        title: "Week 05 — Online guidance",
        courseName: "Final Project Proposal",
        courseCode: "",
        type: "vicon",
        isVicon: true,
        startAt: "2026-09-16T07:00:00.000Z",
        endAt: "2026-09-16T09:00:00.000Z",
      },
      {
        id: "502",
        title: "Week 06 — Studio review",
        courseName: "Final Project Proposal",
        courseCode: "",
        type: "offline",
        isVicon: false,
        startAt: "2026-09-23T07:00:00.000Z",
        endAt: "2026-09-23T09:00:00.000Z",
      },
    ]);
  });

  it("tags only explicit Vicon meetings, case-insensitively", () => {
    expect(isViconMeeting("Vicon")).toBe(true);
    expect(isViconMeeting("vicon")).toBe(true);
    expect(isViconMeeting("offline")).toBe(false);
    expect(isViconMeeting({ type: "Online Vicon Session" })).toBe(true);
    expect(isViconMeeting({ type: "offline" })).toBe(false);
    expect(isViconMeeting({ type: "online" })).toBe(false);
    expect(isViconMeeting(null)).toBe(false);
  });

  it("narrows the agenda to one course hub's course", () => {
    const items = toAgendaItems([
      ...agendaFixture,
      {
        type: "vicon",
        course_name: "Climate Change",
        name: "Week 02 — Guest lecture",
        start_at: "2026-09-10T02:00:00.000Z",
        end_at: "2026-09-10T04:00:00.000Z",
        id: 601,
      },
    ]);
    const course = {
      id: "401",
      code: "II4091",
      name: "Final Project Proposal",
      className: "II4091-01",
      period: "2026-1",
    };

    expect(filterAgendaItemsByCourse(items, course).map((item) => item.id)).toEqual([
      "501",
      "502",
    ]);
  });

  it("reads a cached /course/agenda snapshot through the preload seam and tags Vicon rows", async () => {
    const snapshot = {
      feed: "agenda" as const,
      accountId: "190136",
      fetchedAt: "2026-09-13T12:00:00.000Z",
      data: agendaFixture,
    };
    const bridge = { getFeed: vi.fn(async () => snapshot) };

    const cached = await readCachedFeed("agenda", bridge);
    const items = toAgendaItems(cached?.data);

    expect(bridge.getFeed).toHaveBeenCalledWith("agenda");
    expect(items.filter((item) => item.isVicon).map((item) => item.title)).toEqual([
      "Week 05 — Online guidance",
    ]);

    const markup = renderToStaticMarkup(createElement(AgendaList, { items }));

    expect(markup).toContain(">Vicon<");
    expect(markup).toContain("Week 05 — Online guidance");
    expect(markup).toContain("Week 06 — Studio review");
    expect(markup).toContain('dateTime="2026-09-16T07:00:00.000Z"');
    // The offline meeting must not carry the Vicon tag: exactly one tag row.
    expect(markup.match(/>Vicon</g)).toHaveLength(1);
  });
});
