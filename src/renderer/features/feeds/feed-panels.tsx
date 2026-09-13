import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  filterAgendaItemsByCourse,
  filterTodoItemsByCourses,
  formatTimestamp,
  isTaskItem,
  scopeCoursesToPeriod,
  toAgendaItems,
  toCourseItems,
  toCurrentPeriodId,
  toPeriodItems,
  toTodoItems,
  todoSectionsFromItems,
  type AgendaItem,
  type CourseItem,
  type PeriodItem,
  type TaskItem,
  type TodoItem,
  type TodoSection,
} from "./feed-data";
import { useCachedFeed, type CachedFeedState } from "./use-cached-feed";

export interface TodoSelectionHandler {
  (task: TaskItem): void;
}

/** The signed-in home base: cached courses define the available Period scope. */
export function DashboardPanel({ onTaskSelect }: { onTaskSelect?: TodoSelectionHandler } = {}) {
  const coursesState = useCachedFeed("courses");
  const todoState = useCachedFeed("todo");
  const { periods, periodId, scopedCourses, onPeriodChange } = useCoursePeriodScope(coursesState);
  const todoItems = useMemo(() => toTodoItems(todoState.snapshot?.data), [todoState.snapshot?.data]);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const scopedTodoItems = useMemo(
    () => filterTodoItemsByCourses(todoItems, scopedCourses),
    [scopedCourses, todoItems],
  );
  const openCourse = scopedCourses.find((course) => course.id === openCourseId) ?? null;

  if (openCourse) {
    return (
      <CourseHub
        course={openCourse}
        periods={periods}
        selectedPeriodId={periodId}
        onPeriodChange={(nextPeriodId) => {
          onPeriodChange(nextPeriodId);
          setOpenCourseId(null);
        }}
        onBack={() => setOpenCourseId(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary">
            Course workspace
          </p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-text-primary">
            Your Period at a glance
          </h2>
          <p className="mt-1 max-w-[46rem] text-[13px] leading-5 text-text-secondary">
            Open a course to see its learning space. The latest saved view stays available offline.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background-secondary-default px-2.5 py-1.5 text-caption-1-regular text-text-tertiary">
          <i className="ri-database-2-line text-[14px]" aria-hidden />
          Local snapshot
        </span>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <CourseCollectionPanel
          courses={scopedCourses}
          periods={periods}
          selectedPeriodId={periodId}
          onPeriodChange={onPeriodChange}
          onCourseOpen={(course) => setOpenCourseId(course.id)}
          feedState={coursesState}
        />
        <TodoFeedSection
          items={scopedTodoItems}
          feedState={todoState}
          onTaskSelect={onTaskSelect}
        />
      </div>
    </div>
  );
}

/** Standalone course feed for callers that only need the course list. */
export function CoursesPanel() {
  const feedState = useCachedFeed("courses");
  const { periods, periodId, scopedCourses, onPeriodChange } = useCoursePeriodScope(feedState);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const openCourse = scopedCourses.find((course) => course.id === openCourseId) ?? null;

  if (openCourse) {
    return (
      <CourseHub
        course={openCourse}
        periods={periods}
        selectedPeriodId={periodId}
        onPeriodChange={(nextPeriodId) => {
          onPeriodChange(nextPeriodId);
          setOpenCourseId(null);
        }}
        onBack={() => setOpenCourseId(null)}
      />
    );
  }

  return (
    <CourseCollectionPanel
      courses={scopedCourses}
      periods={periods}
      selectedPeriodId={periodId}
      onPeriodChange={onPeriodChange}
      onCourseOpen={(course) => setOpenCourseId(course.id)}
      feedState={feedState}
    />
  );
}

/** Standalone To Do feed for the existing To Do navigation item. */
export function TodoPanel({ onTaskSelect }: { onTaskSelect?: TodoSelectionHandler } = {}) {
  const feedState = useCachedFeed("todo");
  const items = useMemo(() => toTodoItems(feedState.snapshot?.data), [feedState.snapshot?.data]);
  return (
    <TodoFeedSection
      items={items}
      feedState={feedState}
      onTaskSelect={onTaskSelect}
    />
  );
}

/** Standalone agenda feed for the Agenda navigation item. */
export function AgendaPanel() {
  const feedState = useCachedFeed("agenda");
  const items = useMemo(
    () => toAgendaItems(feedState.snapshot?.data),
    [feedState.snapshot?.data],
  );
  return <AgendaFeedSection items={items} feedState={feedState} />;
}

/** The course hub's agenda section: this course's meetings from the cache. */
function CourseAgendaSection({ course }: { course: CourseItem }) {
  const feedState = useCachedFeed("agenda");
  const items = useMemo(() => {
    const all = toAgendaItems(feedState.snapshot?.data);
    return filterAgendaItemsByCourse(all, course);
  }, [feedState.snapshot?.data, course]);

  if (feedState.loading) {
    return (
      <article className="rounded-xl bg-background-secondary-default p-4">
        <AgendaSectionHeading title="Agenda" count={null} />
        <p className="mt-3 px-1 py-4 text-center text-[13px] text-text-tertiary">
          Loading latest snapshot…
        </p>
      </article>
    );
  }

  if (feedState.error) {
    return (
      <article className="rounded-xl bg-background-secondary-default p-4">
        <AgendaSectionHeading title="Agenda" count={null} />
        <p className="mt-3 px-1 py-4 text-center text-[13px] text-text-secondary">
          The cached feed could not be read.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-xl bg-background-secondary-default p-4">
      <AgendaSectionHeading title="Agenda" count={items.length} />
      {items.length > 0 ? (
        <div className="mt-3">
          <AgendaList items={items} hideCourse />
        </div>
      ) : (
        <p className="mt-3 px-1 py-4 text-center text-[13px] text-text-tertiary">
          {feedState.snapshot
            ? "No meetings for this course in the latest snapshot."
            : "No agenda snapshot yet."}
        </p>
      )}
    </article>
  );
}

function AgendaFeedSection({
  items,
  feedState,
}: {
  items: AgendaItem[];
  feedState: CachedFeedState;
}) {
  return (
    <FeedSection
      eyebrow="Schedule"
      title="Agenda"
      count={items.length}
      snapshot={feedState.snapshot}
      loading={feedState.loading}
      error={feedState.error}
    >
      {items.length > 0 ? (
        <AgendaList items={items} />
      ) : (
        <EmptyFeed message="No meetings in the latest snapshot." />
      )}
    </FeedSection>
  );
}

export interface AgendaListProps {
  items: AgendaItem[];
  /** The course hub already names the course, so rows skip repeating it. */
  hideCourse?: boolean;
}

/**
 * The free-tier agenda list. The Pro Calendar block is intentionally not
 * used (BoardUI decision): meetings render chronologically with Vicon
 * sessions tagged so virtual sessions stand out at a glance.
 */
export function AgendaList({ items, hideCourse = false }: AgendaListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex min-w-0 items-start gap-3 rounded-lg bg-background-primary-default p-3.5 shadow-sm"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-500/10 text-accent-600"
            aria-hidden
          >
            <i
              className={item.isVicon ? "ri-video-on-line text-[16px]" : "ri-presentation-line text-[16px]"}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {item.isVicon && (
                <Chip color="cyan" variant="caption">
                  <i className="ri-video-on-line mr-1 text-[12px]" aria-hidden />
                  Vicon
                </Chip>
              )}
              {!hideCourse && item.courseName && (
                <span className="truncate text-caption-1-semibold text-text-tertiary">
                  {item.courseCode ? `${item.courseCode} · ` : ""}{item.courseName}
                </span>
              )}
            </div>
            <h4 className="mt-1 line-clamp-2 text-[14px] font-semibold leading-5 text-text-primary">
              {item.title}
            </h4>
            {item.startAt ? (
              <p className="mt-1 text-caption-1-regular text-text-secondary">
                <time dateTime={item.startAt}>{formatTimestamp(item.startAt)}</time>
                {item.endAt && item.endAt !== item.startAt && (
                  <>
                    {" – "}
                    <time dateTime={item.endAt}>{formatTimestamp(item.endAt)}</time>
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1 text-caption-1-regular text-text-tertiary">Time to be announced</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AgendaSectionHeading({ title, count }: { title: string; count: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="grid size-8 place-items-center rounded-lg bg-background-primary-default text-text-secondary shadow-sm">
        <i className="ri-calendar-line text-[16px]" aria-hidden />
      </span>
      {count !== null && <Badge color="neutral">{count}</Badge>}
      <h4 className="mr-auto text-[14px] font-semibold text-text-primary">{title}</h4>
    </div>
  );
}

function CourseCollectionPanel({
  courses,
  periods,
  selectedPeriodId,
  onPeriodChange,
  onCourseOpen,
  feedState,
}: {
  courses: CourseItem[];
  periods: PeriodItem[];
  selectedPeriodId: string | null;
  onPeriodChange: (periodId: string) => void;
  onCourseOpen: (course: CourseItem) => void;
  feedState: CachedFeedState;
}) {
  return (
    <FeedSection
      eyebrow={
        periods.length > 1 && !selectedPeriodId
          ? "Available Periods"
          : selectedPeriodId && periods.length > 1
            ? "Selected Period"
            : "Current Period"
      }
      title="Courses"
      count={courses.length}
      snapshot={feedState.snapshot}
      loading={feedState.loading}
      error={feedState.error}
      headerAction={
        <PeriodSwitcher
          periods={periods}
          selectedPeriodId={selectedPeriodId}
          onChange={onPeriodChange}
        />
      }
    >
      {courses.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} onOpen={onCourseOpen} />
          ))}
        </div>
      ) : (
        <EmptyFeed message="No courses are available in the latest snapshot." />
      )}
    </FeedSection>
  );
}

function TodoFeedSection({
  items,
  feedState,
  onTaskSelect,
}: {
  items: TodoItem[];
  feedState: CachedFeedState;
  onTaskSelect?: TodoSelectionHandler;
}) {
  const sections = useMemo(() => todoSectionsFromItems(items), [items]);
  const itemCount = sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <FeedSection
      eyebrow="Deadlines"
      title="To Do"
      count={itemCount}
      hideZeroCount
      snapshot={feedState.snapshot}
      loading={feedState.loading}
      error={feedState.error}
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
  headerAction,
  hideZeroCount = false,
  children,
}: {
  eyebrow: string;
  title: string;
  count: number;
  snapshot: { fetchedAt: string } | null;
  loading: boolean;
  error: boolean;
  headerAction?: ReactNode;
  hideZeroCount?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-1">
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
        <div className="flex flex-wrap items-center justify-end gap-3">
          {headerAction}
          <span className="shrink-0 text-caption-1-regular text-text-tertiary">
            {snapshot ? `Cached ${formatTimestamp(snapshot.fetchedAt)}` : "No snapshot yet"}
          </span>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-background-secondary-default/80 p-2">
        {loading ? <FeedLoading /> : error ? <FeedError /> : children}
      </div>
    </section>
  );
}

function PeriodSwitcher({
  periods,
  selectedPeriodId,
  onChange,
}: {
  periods: PeriodItem[];
  selectedPeriodId: string | null;
  onChange: (periodId: string) => void;
}) {
  if (periods.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-caption-1-medium text-text-secondary">
        <i className="ri-calendar-2-line text-[14px]" aria-hidden />
        Current Period
      </span>
    );
  }

  return (
    <SegmentedControl
      options={periods.map((period) => ({
        value: period.id,
        label: period.label,
        badge: period.count,
      }))}
      value={selectedPeriodId}
      onChange={onChange}
      ariaLabel="Available Periods"
    />
  );
}

function CourseCard({ course, onOpen }: { course: CourseItem; onOpen: (course: CourseItem) => void }) {
  const tint = courseAccent(course);
  const courseInitials = courseMark(course);
  const staffSummary = [course.faculty, course.lecturer].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(course)}
      aria-label={`Open ${course.code ? `${course.code} — ` : ""}${course.name}`}
      className="group relative min-w-0 overflow-hidden rounded-lg bg-background-primary-default p-3.5 text-left shadow-sm outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-background-primary-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-border-focus-ring active:scale-[0.995]"
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: tint }}
        aria-hidden
      />
      <span className="flex min-w-0 items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-lg text-[13px] font-semibold text-text-secondary"
          style={{ backgroundColor: tint }}
          aria-hidden
        >
          {courseInitials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-caption-1-semibold text-text-secondary">
              {course.code || "Course"}
            </span>
            {course.moduleCount !== undefined && (
              <span className="shrink-0 text-[11px] text-text-tertiary">
                {course.moduleCount} modules
              </span>
            )}
          </span>
          <span className="mt-1 block line-clamp-2 text-[14px] font-semibold leading-5 text-text-primary">
            {course.name}
          </span>
          {course.className && (
            <span className="mt-1 block truncate text-[12px] text-text-secondary">
              {course.className}
            </span>
          )}
        </span>
        <i
          className="ri-arrow-right-up-line mt-0.5 shrink-0 text-[16px] text-text-tertiary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </span>
      {(staffSummary || course.sks !== undefined || course.period) && (
        <span className="mt-3 flex min-w-0 items-center gap-2 border-t border-black/[0.06] pt-2.5 text-caption-1-regular text-text-tertiary">
          <span className="min-w-0 flex-1 truncate">{staffSummary || "Course details"}</span>
          {course.sks !== undefined && <span className="shrink-0">{course.sks} SKS</span>}
        </span>
      )}
    </button>
  );
}

function CourseHub({
  course,
  periods,
  selectedPeriodId,
  onPeriodChange,
  onBack,
}: {
  course: CourseItem;
  periods: PeriodItem[];
  selectedPeriodId: string | null;
  onPeriodChange: (periodId: string) => void;
  onBack: () => void;
}) {
  const tint = courseAccent(course);
  const details = [course.className, course.faculty, course.lecturer].filter(Boolean);

  return (
    <section className="space-y-6" aria-label={`${course.name} course hub`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-text-secondary outline-none transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <i className="ri-arrow-left-line text-[16px]" aria-hidden />
          All courses
        </button>
        <PeriodSwitcher
          periods={periods}
          selectedPeriodId={selectedPeriodId}
          onChange={onPeriodChange}
        />
      </div>

      <div className="relative isolate overflow-hidden rounded-2xl bg-background-secondary-default">
        <span
          className="absolute -right-12 -top-16 size-52 rounded-full opacity-70 blur-3xl"
          style={{ backgroundColor: tint }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start gap-4 p-5 sm:p-6">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-xl text-[15px] font-semibold text-text-secondary shadow-sm"
            style={{ backgroundColor: tint }}
            aria-hidden
          >
            {courseMark(course)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary">
              Course hub
            </p>
            <h2 className="mt-1 max-w-2xl text-[24px] font-semibold leading-8 tracking-tight text-text-primary">
              {course.name}
            </h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              {course.code || "Course"}
              {course.period ? ` · ${course.period}` : ""}
            </p>
          </div>
        </div>
        {details.length > 0 || course.sks !== undefined || course.moduleCount !== undefined ? (
          <div className="relative flex flex-wrap gap-1.5 border-t border-black/[0.06] px-5 py-3 sm:px-6">
            {details.map((detail) => (
              <Chip key={detail} color="soft" variant="caption">
                {detail}
              </Chip>
            ))}
            {course.sks !== undefined && (
              <Chip color="soft" variant="caption">{course.sks} SKS</Chip>
            )}
            {course.moduleCount !== undefined && (
              <Chip color="soft" variant="caption">{course.moduleCount} modules</Chip>
            )}
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h3 className="text-[16px] font-semibold text-text-primary">Course sections</h3>
            <p className="mt-1 text-[13px] text-text-secondary">
              The course space is ready for the next content slices.
            </p>
          </div>
          <span className="text-caption-1-regular text-text-tertiary">Read-only preview</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <CourseAgendaSection course={course} />
          <HubPlaceholder
            icon="ri-file-list-3-line"
            title="Exams"
            description="Your scheduled exams will be listed here."
          />
          <HubPlaceholder
            icon="ri-folder-3-line"
            title="Materials"
            description="Course files and downloads will live here."
          />
          <HubPlaceholder
            icon="ri-hand-heart-line"
            title="Presence"
            description="Presence records and open windows will appear here."
          />
        </div>
      </div>
    </section>
  );
}

function HubPlaceholder({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl bg-background-secondary-default p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-background-primary-default text-text-secondary shadow-sm">
          <i className={`${icon} text-[16px]`} aria-hidden />
        </span>
        <Chip color="soft" variant="caption">Coming soon</Chip>
      </div>
      <h4 className="mt-4 text-[14px] font-semibold text-text-primary">{title}</h4>
      <p className="mt-1 max-w-[30rem] text-[13px] leading-5 text-text-secondary">{description}</p>
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
  return (
    <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">
      Loading latest snapshot…
    </p>
  );
}

function FeedError() {
  return (
    <p className="px-2 py-8 text-center text-[13px] text-text-secondary">
      The cached feed could not be read.
    </p>
  );
}

function EmptyFeed({ message }: { message: string }) {
  return <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">{message}</p>;
}

function useCoursePeriodScope(feedState: CachedFeedState) {
  const courses = useMemo(
    () => toCourseItems(feedState.snapshot?.data),
    [feedState.snapshot?.data],
  );
  const periods = useMemo(() => toPeriodItems(courses), [courses]);
  const currentPeriodId = useMemo(() => toCurrentPeriodId(courses), [courses]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const periodId = getEffectivePeriodId(periods, selectedPeriodId, currentPeriodId);
  const scopedCourses = useMemo(
    () => scopeCoursesToPeriod(courses, periodId),
    [courses, periodId],
  );

  useEffect(() => {
    setSelectedPeriodId((selected) => getEffectivePeriodId(periods, selected, currentPeriodId));
  }, [currentPeriodId, periods]);

  return {
    periods,
    periodId,
    scopedCourses,
    onPeriodChange: (nextPeriodId: string) => setSelectedPeriodId(nextPeriodId),
  };
}

function getEffectivePeriodId(
  periods: PeriodItem[],
  selectedPeriodId: string | null,
  currentPeriodId: string | null,
): string | null {
  if (selectedPeriodId && periods.some((period) => period.id === selectedPeriodId)) {
    return selectedPeriodId;
  }
  if (currentPeriodId && periods.some((period) => period.id === currentPeriodId)) {
    return currentPeriodId;
  }
  // A single Period is the normal `/course/courses` response. If a cached
  // fixture ever contains more than one without a current marker, leave the
  // choice to the student instead of guessing that response order means it.
  return periods.length === 1 ? periods[0].id : null;
}

function courseAccent(course: CourseItem): string {
  return course.color && /^#[0-9a-f]{6}$/i.test(course.color) ? course.color : "#e4ebf8";
}

function courseMark(course: CourseItem): string {
  return (course.code || course.name).slice(0, 2).toUpperCase();
}
