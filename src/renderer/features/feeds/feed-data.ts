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
  sks?: number;
  moduleCount?: number;
  color?: string;
  isCurrent?: boolean;
  thumbnailUrl?: string;
}

export interface ExamItem {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  time: string | null;
}

export interface PeriodItem {
  id: string;
  label: string;
  count: number;
}

export interface AgendaItem {
  id: string;
  title: string;
  courseName: string;
  courseCode: string;
  /** Raw vendor meeting type (e.g. "vicon", "offline") when provided. */
  type: string | null;
  /** True when the meeting is an online-class (Vicon) session. */
  isVicon: boolean;
  startAt: string | null;
  endAt: string | null;
}

/**
 * Returns true for online-class (Vicon) meetings. The vendor tags them
 * through the agenda item's `type` — a case-insensitive "vicon" marker —
 * so detection keys off that explicit tag (plus an explicit boolean flag
 * when present) and never infers Vicon from a generic online/mode field.
 */
export function isViconMeeting(value: unknown): boolean {
  if (typeof value === "string") return /vicon/i.test(value);
  const record = asRecord(value);
  if (!record) return false;
  for (const key of ["type", "meeting_type", "meetingType"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && /vicon/i.test(candidate)) return true;
  }
  for (const key of ["is_vicon", "isVicon", "vicon"]) {
    if (record[key] === true) return true;
  }
  return false;
}

/**
 * Turns the plain-array `/course/agenda` response into the small shape the
 * renderer needs. Accepts the bare array as well as `data`/`agenda`/
 * `meetings`-wrapped variants; items are ordered chronologically with
 * undated meetings last.
 */
export function toAgendaItems(data: unknown): AgendaItem[] {
  const records = agendaRecords(data);
  const items = records.flatMap((record, index) => {
    const item: AgendaItem = {
      id: scalarString(record.id ?? record.agenda_id ?? record.meeting_id)
        ?? `agenda-${index}`,
      title: readString(record, ["name", "title", "topic", "meeting_name", "subject"])
        ?? "Untitled meeting",
      courseName: readString(record, ["course_name", "courses_name", "course", "courseName"])
        ?? "",
      courseCode: readString(record, ["course_code", "code", "courseCode"]) ?? "",
      type: readString(record, ["type", "meeting_type", "meetingType"]),
      isVicon: isViconMeeting(record),
      startAt: readString(record, ["start_at", "startAt", "start", "start_time", "time"]),
      endAt: readString(record, ["end_at", "endAt", "end", "end_time"]),
    };
    return [item];
  });
  return items.sort(compareAgendaItems);
}

/** Narrows agenda meetings to one course hub's course. */
export function filterAgendaItemsByCourse(items: AgendaItem[], course: CourseItem): AgendaItem[] {
  return items.filter((item) => {
    if (item.courseCode && course.code && item.courseCode === course.code) return true;
    if (item.courseName && course.name && item.courseName === course.name) return true;
    return false;
  });
}

function compareAgendaItems(a: AgendaItem, b: AgendaItem): number {
  const aTime = agendaTime(a.startAt);
  const bTime = agendaTime(b.startAt);
  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return aTime - bTime;
}

function agendaTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function agendaRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(asRecordValue);
  const root = asRecord(data);
  if (!root) return [];
  for (const key of ["data", "agenda", "meetings"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).flatMap(asRecordValue);
  }
  return [];
}

export type PresenceKind = "present" | "absent" | "excused" | "unknown";

export interface PresenceItem {
  id: string;
  courseCode: string;
  courseName: string;
  /** Meeting label (e.g. "Week 05", "Pertemuan 3") when the vendor provides one. */
  meeting: string;
  /** Attendance timestamp when the vendor provides one. */
  dateAt: string | null;
  /** Raw vendor status text when provided (e.g. "Hadir", "Alpa"). */
  status: string | null;
  /** Normalized attendance bucket derived from the raw status/flags. */
  kind: PresenceKind;
}

/**
 * Normalizes one attendance record's status. The vendor shape is only
 * partially captured (the endpoint is history-shaped per the sync spike),
 * so this keys off explicit Indonesian + English markers and boolean flags
 * (`is_present`, `present`, `attended`, `hadir`) and falls back to unknown
 * rather than guessing from unrelated fields.
 */
export function presenceKindOf(value: unknown): PresenceKind {
  const record = asRecord(value);
  if (record) {
    for (const key of ["is_present", "isPresent", "present", "attended", "hadir"]) {
      if (record[key] === true) return "present";
      if (record[key] === false) return "absent";
    }
    for (const key of ["status", "presence_status", "presenceStatus", "state", "attendance", "attendance_status", "attendanceStatus", "result", "keterangan"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return presenceKindFromStatus(candidate);
      }
    }
    return "unknown";
  }
  if (typeof value === "string") return presenceKindFromStatus(value);
  if (typeof value === "number") return value === 1 ? "present" : value === 0 ? "absent" : "unknown";
  return "unknown";
}

function presenceKindFromStatus(status: string): PresenceKind {
  const text = status.toLowerCase();
  if (/(alpa|absent|tidak|missing|alpha|unexcused)/.test(text)) return "absent";
  if (/(izin|sakit|excused|permit|leave|dispens)/.test(text)) return "excused";
  if (/(hadir|present|attend|done|valid|counted)/.test(text)) return "present";
  return "unknown";
}

/**
 * Turns the per-course `/course/presences/list` response into flat per-meeting
 * records. Accepts the bare array as well as `data`/`presences`-wrapped
 * variants; each course row contributes its nested `presences` (or
 * `meetings`/`records`) array. Items sort chronologically with undated
 * meetings last. Read-only: recording happens in EduNex itself.
 */
export function toPresenceItems(data: unknown): PresenceItem[] {
  const rows = presenceRows(data);
  const items = rows.flatMap((row, rowIndex) => {
    const courseCode = readString(row, ["course_code", "code", "courseCode"]) ?? "";
    const courseName = readString(row, ["courses_name", "course_name", "course", "courseName", "name"]) ?? "";
    const meetings = presenceMeetings(row);
    return meetings.flatMap((meeting, meetingIndex) => {
      const status = readString(meeting, [
        "status",
        "presence_status",
        "presenceStatus",
        "state",
        "attendance",
        "attendance_status",
        "attendanceStatus",
        "result",
        "keterangan",
      ]);
      const item: PresenceItem = {
        id: scalarString(meeting.id ?? meeting.presence_id ?? meeting.meeting_id)
          ?? `presence-${rowIndex}-${meetingIndex}`,
        courseCode,
        courseName,
        meeting: readString(meeting, [
          "name",
          "title",
          "meeting_name",
          "meetingName",
          "topic",
          "meeting",
          "week",
          "pertemuan",
          "description",
          "label",
        ]) ?? "Meeting",
        dateAt: readString(meeting, [
          "date",
          "time",
          "start_at",
          "startAt",
          "meeting_at",
          "presence_date",
          "attended_at",
          "created_at",
          "updated_at",
          "date_at",
        ]),
        status,
        kind: presenceKindOf(meeting),
      };
      return [item];
    });
  });
  return items.sort(comparePresenceItems);
}

/** Narrows flattened presence records to one course hub's course. */
export function filterPresenceItemsByCourse(items: PresenceItem[], course: CourseItem): PresenceItem[] {
  return items.filter((item) => {
    if (item.courseCode && course.code && item.courseCode === course.code) return true;
    if (item.courseName && course.name && item.courseName === course.name) return true;
    return false;
  });
}

function comparePresenceItems(a: PresenceItem, b: PresenceItem): number {
  const aTime = presenceTime(a.dateAt);
  const bTime = presenceTime(b.dateAt);
  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return aTime - bTime;
}

function presenceTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function presenceRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(asRecordValue);
  const root = asRecord(data);
  if (!root) return [];
  for (const key of ["data", "presences", "courses"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).flatMap(asRecordValue);
  }
  return [];
}

function presenceMeetings(row: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["presences", "meetings", "records", "items", "data", "attendance"]) {
    const value = row[key];
    if (Array.isArray(value)) return value.flatMap(asRecordValue);
  }
  return [];
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
  return todoSectionsFromItems(toTodoItems(data));
}

/** Groups already-normalized items when a dashboard has applied a Period scope. */
export function todoSectionsFromItems(items: TodoItem[]): TodoSection[] {
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
    if (!isActiveEnrolledCourse(attributes)) return [];
    const id = scalarString(resource.id) ?? scalarString(attributes.id) ?? `course-${index}`;
    const code = readString(attributes, ["code", "course_code"]) ?? "";
    const name = readString(attributes, ["name", "courses_name", "course_name", "title"])
      ?? "Untitled course";
    const year = scalarString(attributes.year) ?? scalarString(attributes.period_year);
    const semester = scalarString(attributes.semester) ?? scalarString(attributes.period_type);
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
    const faculty = readDisplayString(attributes, ["faculty", "faculty_name"]);
    const lecturer = readString(attributes, ["lecturer", "lecturer_name"]);
    const sks = scalarNumber(attributes.sks ?? attributes.credit);
    const moduleCount = scalarNumber(attributes.modules ?? attributes.total_modules);
    const color = readString(attributes, ["hue", "color"]);
    const isCurrent = readBoolean(attributes, ["is_current", "current", "isCurrent"]);
    const thumbnailUrl = readString(attributes, ["thumbnail", "thumbnail_url", "image", "image_url"]);
    if (faculty) item.faculty = faculty;
    if (lecturer) item.lecturer = lecturer;
    if (sks !== null) item.sks = sks;
    if (moduleCount !== null) item.moduleCount = moduleCount;
    if (color) item.color = color;
    if (isCurrent !== null) item.isCurrent = isCurrent;
    if (thumbnailUrl) item.thumbnailUrl = thumbnailUrl;
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

/**
 * Turns the plain `/exam/exams` response into the small shape the renderer
 * needs. Accepts a bare array or an object wrapping it (`exams` / `data`),
 * and JSON-API resources with `attributes`, so the view never depends on
 * which envelope the vendor sent.
 */
export function toExamItems(data: unknown): ExamItem[] {
  const resources = examResources(data);
  const items = resources.flatMap((resource, index) => {
    const attributes = asRecord(resource.attributes) ?? resource;
    const id =
      scalarString(resource.id) ?? scalarString(attributes.id) ?? `exam-${index}`;
    return [
      {
        id,
        title:
          readString(attributes, ["name", "title", "exam_name"]) ?? "Untitled exam",
        courseCode: readString(attributes, ["code", "course_code"]) ?? "",
        courseName:
          readString(attributes, ["course", "course_name", "courses_name"]) ?? "",
        time: readString(attributes, [
          "time",
          "start_at",
          "startAt",
          "exam_time",
          "date",
          "due_at",
          "deadline",
        ]),
      },
    ];
  });
  return sortExamsByTime(items);
}

/** Exams carry no Period field, so scope them through the Period's course codes. */
export function filterExamsByCourses(items: ExamItem[], courses: CourseItem[]): ExamItem[] {
  const courseCodes = new Set(courses.map((course) => course.code).filter(Boolean));
  if (courseCodes.size === 0) return items;
  return items.filter((item) => !item.courseCode || courseCodes.has(item.courseCode));
}

/** The course hub shows only the open course's scheduled exams. */
export function filterExamsByCourse(items: ExamItem[], course: CourseItem): ExamItem[] {
  if (!course.code) return items;
  return items.filter((item) => !item.courseCode || item.courseCode === course.code);
}

function examResources(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(asRecordValue);
  const root = asRecord(data);
  if (!root) return [];
  for (const key of ["exams", "data"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).flatMap(asRecordValue);
  }
  return [];
}

function sortExamsByTime(items: ExamItem[]): ExamItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.time ? Date.parse(a.time) : Number.NaN;
    const bTime = b.time ? Date.parse(b.time) : Number.NaN;
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);
    if (aValid && bValid) return (aTime as number) - (bTime as number);
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
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

function isActiveEnrolledCourse(record: Record<string, unknown>): boolean {
  // Legacy fixtures and already-normalized course objects may omit both
  // status fields. Preserve those at the renderer seam; real API responses
  // carry both fields and are filtered strictly by the main client first.
  if (!("is_active" in record) && !("is_enrolled" in record)) return true;
  return (
    "is_active" in record &&
    "is_enrolled" in record &&
    isEnabledCourseFlag(record.is_active) &&
    isEnabledCourseFlag(record.is_enrolled)
  );
}

function isEnabledCourseFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function readDisplayString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    const nested = asRecord(value);
    const name = nested?.name;
    if (typeof name === "string" && name.length > 0) return name;
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
