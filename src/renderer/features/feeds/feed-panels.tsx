import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import type { ReactNode } from "react";
import { useCachedFeed } from "./use-cached-feed";
import {
  formatTimestamp,
  isTaskItem,
  toCourseItems,
  toTodoSections,
  type CourseItem,
  type TaskItem,
  type TodoItem,
  type TodoSection,
} from "./feed-data";

export interface TodoSelectionHandler {
  (task: TaskItem): void;
}

export function DashboardPanel({ onTaskSelect }: { onTaskSelect?: TodoSelectionHandler } = {}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <CoursesPanel />
      <TodoPanel onTaskSelect={onTaskSelect} />
    </div>
  );
}

export function CoursesPanel() {
  const { snapshot, loading, error } = useCachedFeed("courses");
  const courses = toCourseItems(snapshot?.data);

  return (
    <FeedSection
      eyebrow="Current Period"
      title="Courses"
      count={courses.length}
      snapshot={snapshot}
      loading={loading}
      error={error}
    >
      {courses.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {courses.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      ) : (
        <EmptyFeed message="No courses are available in the latest snapshot." />
      )}
    </FeedSection>
  );
}

export function TodoPanel({ onTaskSelect }: { onTaskSelect?: TodoSelectionHandler } = {}) {
  const { snapshot, loading, error } = useCachedFeed("todo");
  const sections = toTodoSections(snapshot?.data);
  const itemCount = sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <FeedSection
      eyebrow="Deadlines"
      title="To Do"
      count={itemCount}
      hideZeroCount
      snapshot={snapshot}
      loading={loading}
      error={error}
    >
      {itemCount > 0 ? (
        <TodoSections sections={sections} onTaskSelect={onTaskSelect} />
      ) : (
        <EmptyFeed message="Nothing is pending in the latest snapshot." />
      )}
    </FeedSection>
  );
}

export interface TodoSectionsProps {
  sections: TodoSection[];
  onTaskSelect?: TodoSelectionHandler;
}

/** The free-tier To Do tables; the Pro Task List block is intentionally not used. */
export function TodoSections({ sections, onTaskSelect }: TodoSectionsProps) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`todo-${section.key}-heading`}>
          <div className="flex items-center gap-2 px-1">
            <h3
              id={`todo-${section.key}-heading`}
              className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary"
            >
              {section.label}
            </h3>
            <Badge color="neutral">{section.items.length}</Badge>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg bg-background-primary-default shadow-sm">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">Pending {section.label}</caption>
              <thead className="border-b border-black/[0.06] text-caption-1-semibold text-text-tertiary">
                <tr>
                  <th className="w-[58%] px-3.5 py-2 font-semibold" scope="col">Item</th>
                  <th className="w-[22%] px-3.5 py-2 font-semibold" scope="col">Course</th>
                  <th className="w-[20%] px-3.5 py-2 text-right font-semibold" scope="col">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {section.items.map((item) => (
                  <TodoRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onTaskSelect={onTaskSelect}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function FeedSection({
  eyebrow,
  title,
  count,
  snapshot,
  loading,
  error,
  hideZeroCount = false,
  children,
}: {
  eyebrow: string;
  title: string;
  count: number;
  snapshot: { fetchedAt: string } | null;
  loading: boolean;
  error: boolean;
  hideZeroCount?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-text-primary">
            {title}
            {(!hideZeroCount || count > 0) && (
              <Badge className="ml-2 align-middle" color="neutral">{count}</Badge>
            )}
          </h2>
        </div>
        <span className="shrink-0 text-caption-1-regular text-text-tertiary">
          {snapshot ? `Cached ${formatTimestamp(snapshot.fetchedAt)}` : "No snapshot yet"}
        </span>
      </div>
      <div className="mt-3 rounded-xl bg-background-secondary-default/80 p-2">
        {loading ? <FeedLoading /> : error ? <FeedError /> : children}
      </div>
    </section>
  );
}

function CourseCard({ course }: { course: CourseItem }) {
  return (
    <article className="min-w-0 rounded-lg bg-background-primary-default p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Chip color="soft" variant="caption">{course.code || "Course"}</Chip>
        {course.period && <span className="text-caption-1-regular text-text-tertiary">{course.period}</span>}
      </div>
      <h3 className="mt-3 text-[14px] font-semibold leading-5 text-text-primary">{course.name}</h3>
      {course.className && <p className="mt-1 text-[12px] text-text-secondary">{course.className}</p>}
      {(course.faculty || course.lecturer) && (
        <p className="mt-3 truncate text-caption-1-regular text-text-tertiary">
          {[course.faculty, course.lecturer].filter(Boolean).join(" · ")}
        </p>
      )}
    </article>
  );
}

function TodoRow({
  item,
  onTaskSelect,
}: {
  item: TodoItem;
  onTaskSelect?: TodoSelectionHandler;
}) {
  const task = isTaskItem(item) ? item : null;
  const content = (
    <div className="grid min-w-0 grid-cols-[minmax(0,58%)_minmax(0,22%)_minmax(0,20%)] items-center gap-0 px-3.5 py-3">
      <div className="min-w-0 pr-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-500/10 text-accent-600">
            <i
              className={task ? "ri-checkbox-line text-[15px]" : "ri-file-list-3-line text-[15px]"}
              aria-hidden
            />
          </span>
          <Chip color={task ? "blue" : "purple"} variant="caption">
            {item.kind}
          </Chip>
        </div>
        <h4 className="mt-1 truncate text-[13px] font-medium leading-5 text-text-primary">
          {item.title}
        </h4>
      </div>
      <div className="min-w-0 pr-3">
        <span className="block truncate text-caption-1-semibold text-text-tertiary">
          {item.courseCode || "—"}
        </span>
        {item.courseName && (
          <span className="block truncate text-caption-1-regular text-text-secondary">
            {item.courseName}
          </span>
        )}
      </div>
      <time
        className="shrink-0 text-right text-caption-1-regular text-text-tertiary"
        dateTime={item.dueAt ?? undefined}
      >
        {item.dueAt ? formatTimestamp(item.dueAt) : "No deadline"}
      </time>
    </div>
  );

  return (
    <tr className="align-top transition-colors hover:bg-background-primary-hover">
      <td className="p-0" colSpan={3}>
        {task && onTaskSelect ? (
          <button
            type="button"
            className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring"
            aria-label={`Open task ${item.title}`}
            onClick={() => onTaskSelect(task)}
          >
            {content}
          </button>
        ) : (
          content
        )}
      </td>
    </tr>
  );
}

function FeedLoading() {
  return <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">Loading latest snapshot…</p>;
}

function FeedError() {
  return <p className="px-2 py-8 text-center text-[13px] text-text-secondary">The cached feed could not be read.</p>;
}

function EmptyFeed({ message }: { message: string }) {
  return <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">{message}</p>;
}
