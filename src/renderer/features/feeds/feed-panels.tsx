import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import type { ReactNode } from "react";
import { useCachedFeed } from "./use-cached-feed";
import { toCourseItems, toTodoItems, type CourseItem, type TodoItem } from "./feed-data";

export function DashboardPanel() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <CoursesPanel />
      <TodoPanel />
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

export function TodoPanel() {
  const { snapshot, loading, error } = useCachedFeed("todo");
  const items = toTodoItems(snapshot?.data);

  return (
    <FeedSection
      eyebrow="Deadlines"
      title="To Do"
      count={items.length}
      snapshot={snapshot}
      loading={loading}
      error={error}
    >
      {items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {items.map((item) => <TodoRow key={`${item.kind}-${item.id}`} item={item} />)}
        </div>
      ) : (
        <EmptyFeed message="Nothing is pending in the latest snapshot." />
      )}
    </FeedSection>
  );
}

function FeedSection({
  eyebrow,
  title,
  count,
  snapshot,
  loading,
  error,
  children,
}: {
  eyebrow: string;
  title: string;
  count: number;
  snapshot: { fetchedAt: string } | null;
  loading: boolean;
  error: boolean;
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
            <Badge className="ml-2 align-middle" color="neutral">{count}</Badge>
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

function TodoRow({ item }: { item: TodoItem }) {
  return (
    <article className="flex min-w-0 items-start gap-3 rounded-lg bg-background-primary-default px-3.5 py-3 shadow-sm">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-accent-500/10 text-accent-600">
        <i className={item.kind === "Task" ? "ri-checkbox-line text-[15px]" : "ri-file-list-3-line text-[15px]"} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip color={item.kind === "Task" ? "blue" : "purple"} variant="caption">{item.kind}</Chip>
          {item.courseCode && <span className="text-caption-1-semibold text-text-tertiary">{item.courseCode}</span>}
        </div>
        <h3 className="mt-1 text-[13px] font-medium leading-5 text-text-primary">{item.title}</h3>
        {item.courseName && <p className="text-caption-1-regular text-text-secondary">{item.courseName}</p>}
      </div>
      <time className="shrink-0 pt-0.5 text-right text-caption-1-regular text-text-tertiary" dateTime={item.dueAt ?? undefined}>
        {item.dueAt ? formatTimestamp(item.dueAt) : "No deadline"}
      </time>
    </article>
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

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
