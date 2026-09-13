export interface TodoItem {
  id: string;
  kind: "Task" | "Exam";
  title: string;
  courseCode: string;
  courseName: string;
  dueAt: string | null;
}
export interface CourseItem {
  id: string;
  code: string;
  name: string;
  className: string | null;
  period: string | null;
  faculty?: string;
  lecturer?: string;
  sks?: number;
  moduleCount?: number;
  color?: string;
  isCurrent?: boolean;
}

export interface PeriodItem {
  id: string;
  label: string;
  count: number;
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
    const sks = scalarNumber(attributes.sks);
    const moduleCount = scalarNumber(attributes.modules);
    const color = readString(attributes, ["hue", "color"]);
    const isCurrent = readBoolean(attributes, ["is_current", "current", "isCurrent"]);
    if (faculty) item.faculty = faculty;
    if (lecturer) item.lecturer = lecturer;
    if (sks !== null) item.sks = sks;
    if (moduleCount !== null) item.moduleCount = moduleCount;
    if (color) item.color = color;
    if (isCurrent !== null) item.isCurrent = isCurrent;
    return [item];
  });
}

/** Returns only the Periods represented by vendor-provided cached course data. */
export function toPeriodItems(courses: CourseItem[]): PeriodItem[] {
  const counts = new Map<string, number>();
  for (const course of courses) {
    if (!course.period) continue;
    counts.set(course.period, (counts.get(course.period) ?? 0) + 1);
  }
  return [...counts].map(([id, count]) => ({
    id,
    label: `Period ${id}`,
    count,
  }));
}

/** Uses an explicit vendor marker when present; a single cached Period is current by definition. */
export function toCurrentPeriodId(courses: CourseItem[]): string | null {
  const markedCurrent = courses.find((course) => course.isCurrent && course.period)?.period;
  if (markedCurrent) return markedCurrent;

  const periods = toPeriodItems(courses);
  return periods.length === 1 ? periods[0].id : null;
}

/** Applies the selected Period without inventing an unavailable one. */
export function scopeCoursesToPeriod(courses: CourseItem[], periodId: string | null): CourseItem[] {
  if (!periodId) return courses;
  return courses.filter((course) => course.period === periodId);
}

/** To Do has no Period field, so scope it through the selected Period's course codes. */
export function filterTodoItemsByCourses(items: TodoItem[], courses: CourseItem[]): TodoItem[] {
  const courseCodes = new Set(courses.map((course) => course.code).filter(Boolean));
  if (courseCodes.size === 0) return items;
  return items.filter((item) => !item.courseCode || courseCodes.has(item.courseCode));
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

function scalarNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    if (typeof record[key] === "boolean") return record[key];
  }
  return null;
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}
