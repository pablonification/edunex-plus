export interface TodoItem {
  id: string;
  kind: "Task" | "Exam";
  title: string;
  courseCode: string;
  courseName: string;
  dueAt: string | null;
}

export type TaskItem = Omit<TodoItem, "kind"> & { kind: "Task" };

export function isTaskItem(item: TodoItem): item is TaskItem {
  return item.kind === "Task";
}

export interface TodoSection {
  key: "tasks" | "exams";
  label: "Tasks" | "Exams";
  items: TodoItem[];
}

export interface CourseItem {
  id: string;
  code: string;
  name: string;
  className: string | null;
  period: string | null;
  faculty?: string;
  lecturer?: string;
}

/** Turns the plain `/todo` response into the small shape the renderer needs. */
export function toTodoItems(data: unknown): TodoItem[] {
  const root = asRecord(data);
  if (!root) return [];

  const groups: Array<{ key: "tasks" | "exams"; kind: TodoItem["kind"] }> = [
    { key: "tasks", kind: "Task" },
    { key: "exams", kind: "Exam" },
  ];

  return groups.flatMap(({ key, kind }) => {
    const values = root[key];
    if (!Array.isArray(values)) return [];
    return values.flatMap((value, index) => {
      const item = asRecord(value);
      if (!item) return [];

      return [
        {
          id: scalarString(item.id) ?? `${key}-${index}`,
          kind,
          title: readString(item, ["name", "title"]) ?? `Untitled ${kind}`,
          courseCode: readString(item, ["code", "course_code"]) ?? "",
          courseName: readString(item, ["course", "course_name"]) ?? "",
          dueAt: readString(item, ["time", "due_at", "deadline"]),
        },
      ];
    });
  });
}

/**
 * Groups the aggregated feed into the two user-facing To Do categories.
 * Empty categories are omitted so the screen never presents a misleading
 * zero-row table for a feed that does not contain that kind of work.
 */
export function toTodoSections(data: unknown): TodoSection[] {
  const items = toTodoItems(data);
  const sections: TodoSection[] = [
    {
      key: "tasks",
      label: "Tasks",
      items: items.filter(isTaskItem),
    },
    {
      key: "exams",
      label: "Exams",
      items: items.filter((item) => item.kind === "Exam"),
    },
  ];
  return sections.filter((section) => section.items.length > 0);
}

/** Formats an API timestamp in the student's local date and time. */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Handles the JSON-API course response captured from EduNex, while accepting
 * the plain-array/object variant documented for the endpoint as well.
 */
export function toCourseItems(data: unknown): CourseItem[] {
  const resources = courseResources(data);
  return resources.flatMap((resource, index) => {
    const attributes = asRecord(resource.attributes) ?? resource;
    const id = scalarString(resource.id) ?? scalarString(attributes.id) ?? `course-${index}`;
    const code = readString(attributes, ["code", "course_code"]) ?? "";
    const name = readString(attributes, ["name", "courses_name", "course_name", "title"])
      ?? "Untitled course";
    const year = scalarString(attributes.year);
    const semester = scalarString(attributes.semester);
    const period = year && semester && !year.endsWith(`-${semester}`)
      ? `${year}-${semester}`
      : year;
    const item: CourseItem = {
      id,
      code,
      name,
      className: readString(attributes, ["class_name", "class"]),
      period,
    };
    const faculty = readString(attributes, ["faculty", "faculty_name"]);
    const lecturer = readString(attributes, ["lecturer", "lecturer_name"]);
    if (faculty) item.faculty = faculty;
    if (lecturer) item.lecturer = lecturer;
    return [item];
  });
}

function courseResources(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(asRecordValue);
  const root = asRecord(data);
  if (!root) return [];
  for (const key of ["data", "courses"]) {
    if (Array.isArray(root[key])) return root[key].flatMap(asRecordValue);
  }
  return [];
}

function asRecordValue(value: unknown): Record<string, unknown>[] {
  const record = asRecord(value);
  return record ? [record] : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function scalarString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}
