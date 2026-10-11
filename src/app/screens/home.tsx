// Beranda (#77): what needs the Student now from both systems, ranked and
// grouped now / soon / coming up, each with its one action and its sources;
// then today (SIX's classes with rooms, where attendance counts, online-class
// links, what's due today and tomorrow); then what changed in the last week;
// then this term's courses. The reasoning lives in src/core/needs.ts.
import { type ReactNode, useMemo } from "react";
import type { Alert, AlertKind } from "../../core/models";
import { type Band, type ClassFacts, type HomeWorld, type Need, needsYou, recentChanges, type TodayPlan, todayPlan } from "../../core/needs";
import { edunexCourseUrl, sixStatusUrl } from "../../core/links";
import { type TermCourse, useTerm, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { type Format, useFormat, useNow, useT } from "../i18n";
import { firstName } from "../names";
import { useNav } from "../nav";
import { SourceNotice, useRefresh, useSignIn } from "../shell/source-status";
import { useDataset, useSettings, useStatus } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Badge, Bar, Card, CourseCode, EmptyState, LiveDot, SectionTitle, Skeleton, SourceTag } from "../ui/display";
import { Icons } from "../ui/icons";
import { budgetLabel, STATE_TONE, useActionLabel } from "./presence";

const DAY = 86_400_000;

export function Home() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const term = useTerm();
  const name = account?.name ?? student?.name;
  const world = useHomeWorld(courses);

  return (
    <div className="mx-auto max-w-[1080px] px-10 pt-7 pb-20">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-body font-medium text-muted">
            {f.dateLong(now)}
            {term ? ` · ${f.term(term)}` : ""}
          </p>
          <h1 className="mt-1 text-display font-semibold tracking-[-0.02em]">
            {f.greeting()}
            {name ? `, ${firstName(name)}` : ""}
          </h1>
        </div>
        <ExamWeek />
      </header>

      <SourceNotice source="edunex" hasData={account !== undefined} />
      <SourceNotice source="six" hasData={student !== undefined} />

      {world && <NeedsYou world={world} courses={courses ?? []} />}

      {world && (
        <div className="mt-10 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-9">
          <Today world={world} courses={courses ?? []} />
          <Changes world={world} />
        </div>
      )}

      <section className="mt-11" aria-labelledby="home-courses">
        <SectionTitle
          count={courses?.length}
          aside={
            courses?.length ? (
              <span className="flex gap-1">
                {courses.some((course) => course.inSix) && <SourceTag source="six" />}
                {courses.some((course) => course.edunex) && <SourceTag source="edunex" />}
              </span>
            ) : undefined
          }
        >
          <span id="home-courses">{t("home.coursesThisTerm")}</span>
        </SectionTitle>
        <Courses courses={courses} nim={student?.nim} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- the datasets, as Beranda reasons with them

/**
 * Everything Beranda reasons from, once the term's courses are known. The
 * exact moment, not rounded down: a Task posted seconds ago is already open.
 * The window's clock ticks once a minute, so this is redone about as often.
 */
function useHomeWorld(courses: TermCourse[] | undefined): HomeWorld | undefined {
  const tasks = useDataset("edunex.tasks");
  const presence = useDataset("edunex.presence");
  const materials = useDataset("edunex.materials");
  const announcements = useDataset("edunex.announcements");
  const schedule = useDataset("six.schedule");
  const scheduleMonths = useDataset("six.scheduleMonths");
  const exams = useDataset("edunex.exams");
  const calendar = useDataset("itb.calendar");
  const term = useTerm();
  const { attendanceTarget } = useSettings();
  const now = useNow();
  return useMemo(() => {
    if (!courses) return undefined;
    return {
      now,
      target: attendanceTarget,
      term: term ?? null,
      courses: courses.map((course) => ({ code: course.code, six: course.attendance, edunexId: course.edunex?.courseId ?? null })),
      tasks: tasks ?? [],
      presence: presence ?? {},
      materials: materials ?? {},
      announcements: announcements ?? {},
      schedule: schedule ?? null,
      scheduleMonths,
      exams,
      calendar,
    };
  }, [courses, tasks, presence, materials, announcements, schedule, scheduleMonths, exams, calendar, term, attendanceTarget, now]);
}

const colorOf = (courses: readonly TermCourse[], code: string | null) => courses.find((course) => course.code === code)?.color ?? "var(--faint)";

/** UTS or UAS week starting within two weeks, from ITB's calendar. */
function ExamWeek() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const calendar = useDataset("itb.calendar");
  const next = calendar?.events.find((e) => (e.kind === "uts" || e.kind === "uas") && e.start > now && e.start - now <= 14 * DAY);
  if (!next) return null;
  return (
    <p className="flex items-center gap-2 rounded-lg bg-fill px-3 py-1.5 text-small font-medium">
      <SourceTag source="itb" />
      {t(next.kind === "uts" ? "home.utsStarts" : "home.uasStarts", { date: `${f.weekday(next.start)}, ${f.dayMonth(next.start)}` })}
    </p>
  );
}

// ---------------------------------------------------------------- needs you

const BANDS: Band[] = ["now", "soon", "later"];

function NeedsYou({ world, courses }: { world: HomeWorld; courses: readonly TermCourse[] }) {
  const t = useT();
  const tasks = useDataset("edunex.tasks");
  const needs = useMemo(() => needsYou(world), [world]);
  // Until EduNex's Tasks arrive, an empty list would claim more than the app knows.
  const edunex = useStatus("edunex");
  const loading = tasks === undefined && edunex.state !== "signed-out";
  return (
    <section className="mt-6" aria-labelledby="home-needs">
      <SectionTitle
        count={loading ? undefined : needs.length}
        aside={
          <span className="flex gap-1">
            <SourceTag source="edunex" />
            {world.schedule && <SourceTag source="six" />}
          </span>
        }
      >
        <span id="home-needs">{t("home.needs")}</span>
      </SectionTitle>
      {loading ? (
        <div aria-busy="true">
          <Card className="p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-3 h-3 w-2/3" />
          </Card>
        </div>
      ) : needs.length ? (
        <Card className="overflow-hidden">
          {BANDS.map((band) => ({ band, items: needs.filter((need) => need.band === band) }))
            .filter((group) => group.items.length > 0)
            .map((group, i) => (
              <div key={group.band} className={cx(i > 0 && "border-t border-line")} role="group" aria-labelledby={`home-band-${group.band}`}>
                <h3 id={`home-band-${group.band}`} className="px-4 pt-3 text-micro font-semibold tracking-[0.05em] text-faint uppercase">
                  {t(`home.band.${group.band}`)}
                </h3>
                <ol>
                  {group.items.map((need, j) => (
                    <NeedRow key={need.id} need={need} first={j === 0} color={colorOf(courses, need.course)} />
                  ))}
                </ol>
              </div>
            ))}
        </Card>
      ) : (
        <p className="rounded-xl bg-fill px-4 py-6 text-center text-body text-muted">{t("home.needs.none")}</p>
      )}
    </section>
  );
}

interface NeedView {
  icon: ReactNode;
  live: boolean;
  title: string;
  detail: string[];
  when: string | null;
  button: string;
}

function useNeedView(): (need: Need) => NeedView {
  const t = useT();
  const f = useFormat();
  const actionLabel = useActionLabel();
  const now = useNow();
  const { attendanceTarget } = useSettings();
  return (need) => {
    switch (need.kind) {
      case "presence": {
        const action = actionLabel({ action: { activity: need.activity, task: need.task, url: "" } });
        if (need.open)
          return {
            icon: <Icons.Hand className="size-4" />,
            live: true,
            title: t("home.need.presence", { course: need.course ?? "" }),
            detail: [
              action,
              need.activity === "assignment" ? need.session.note : null,
              need.class ? t("home.need.presence.class", { time: f.time(need.class.end), room: need.class.room ?? "–" }) : null,
              need.classMoved && need.class ? t("home.need.class.usual", { usual: movedFrom(f, need.classMoved, need.class.start) }) : null,
              need.countedIn === "six" ? t("presence.open.alsoSix") : null,
            ].filter((part): part is string => !!part),
            when: t("home.need.presence.closes", { time: f.time(need.session.closesAt) }),
            button: t("presence.openInEdunex"),
          };
        const date = f.relativeDay(need.session.opensAt);
        const time = f.timeRange(need.session.opensAt, need.session.closesAt);
        return {
          icon: <Icons.Hand className="size-4" />,
          live: false,
          title: need.task ? t("home.need.presenceAhead.assignment", { task: need.task.title, date, time }) : t("home.need.presenceAhead", { course: need.course ?? "", date, time }),
          // With a Task, the title already says what to do.
          detail: need.task ? [t("home.need.presenceAhead.assignmentDetail")] : [action, t("home.need.presenceAhead.detail")],
          when: f.fromNow(need.session.opensAt),
          button: need.task ? t("home.action.openTask") : t("presence.openInEdunex"),
        };
      }
      case "class": {
        const { session } = need;
        const course = session.courseCode;
        const title = need.live
          ? t("home.need.class.live", { course })
          : need.band === "now"
            ? t("home.need.class.soon", { course, time: f.time(session.start) })
            : need.state === "none"
              ? t("home.need.class.dontMiss", { course })
              : need.moved?.usualStart != null
                ? t("home.need.class.moved", { course, time: f.time(session.start) })
                : t("home.need.class.movedRoom", { course, room: session.room ?? "–" });
        return {
          icon: need.moved ? <Icons.CalendarClock className="size-4" /> : <Icons.MapPin className="size-4" />,
          live: need.live,
          title,
          detail: [
            `${f.timeRange(session.start, session.end)}${session.room ? ` · ${session.room}` : ""}`,
            need.moved ? t("home.need.class.usual", { usual: movedFrom(f, need.moved, session.start) }) : null,
            need.countedIn !== "unknown" ? t(`home.countedIn.${need.countedIn}`) : null,
            need.health && need.state !== "unknown" ? budgetLabel(t, need.health, attendanceTarget) : null,
          ].filter((part): part is string => !!part),
          when: need.live ? t("home.today.now") : f.fromNow(session.start),
          button: need.action.kind === "open" ? t("home.action.join") : need.action.route.screen === "course" ? t("home.action.openCourse") : t("home.action.seeAttendance"),
        };
      }
      case "task": {
        const { task } = need;
        const due = task.dueAt !== null ? f.dueLabel(task.dueAt) : "";
        const reason =
          need.reason === "edited"
            ? t("home.need.task.edited", { when: f.fromNow(task.editedAt!) })
            : need.reason === "overdue"
              ? t("home.need.task.overdue", { when: due })
              : need.reason === "short"
                ? t("home.need.task.short", { duration: f.countdown(now + (task.dueAt! - task.opensAt!)), when: due })
                : t("home.need.task.due", { when: due });
        return {
          icon: need.reason === "edited" ? <Icons.PenLine className="size-4" /> : need.reason === "overdue" ? <Icons.AlertTriangle className="size-4" /> : <Icons.ListChecks className="size-4" />,
          live: false,
          title: task.title,
          detail: [reason, need.draft ? t("home.need.task.draft") : null].filter((part): part is string => !!part),
          when: task.dueAt !== null && need.reason !== "edited" ? f.fromNow(task.dueAt) : null,
          button: t("home.action.openTask"),
        };
      }
      case "attendance": {
        const { health } = need;
        const vars = { attended: health.attended ?? 0, held: health.held ?? 0, target: attendanceTarget, best: Math.round((health.best ?? 0) * 100), course: need.course ?? "" };
        return {
          icon: <Icons.AlertTriangle className="size-4" />,
          live: false,
          title: t(health.state === "out" ? "home.need.attendance.out" : "home.need.attendance.none", vars),
          detail: [t(health.state === "out" ? "alert.attendance.out.body" : "alert.attendance.none.body", vars)],
          when: null,
          button: t("home.action.seeAttendance"),
        };
      }
      case "exam": {
        const { exam, sitting } = need;
        const offset = f.dayOffset(sitting.start);
        const day = offset === 0 || offset === 1 ? f.relativeDay(sitting.start).toLowerCase() : f.relativeDay(sitting.start);
        const time = sitting.end !== null ? f.timeRange(sitting.start, sitting.end) : f.time(sitting.start);
        return {
          icon: <Icons.GraduationCap className="size-4" />,
          live: sitting.start <= now && now < (sitting.end ?? sitting.start),
          title: t("home.need.exam", { kind: t(`exam.kind.${exam.kind}`), course: need.course ?? "", day, time }),
          detail: [
            sitting.source === "six" ? (sitting.room ? t("home.need.exam.room", { room: sitting.room }) : t("exam.noRoom")) : t("exam.onEdunex"),
            need.disagree ? t("exam.disagree") : null,
          ].filter((part): part is string => !!part),
          when: f.fromNow(sitting.start),
          button: t("exam.prepare"),
        };
      }
      case "meeting": {
        const { meeting } = need;
        const offset = f.dayOffset(meeting.start);
        const day = offset === 0 || offset === 1 ? f.relativeDay(meeting.start).toLowerCase() : f.relativeDay(meeting.start);
        return {
          icon: <Icons.CalendarClock className="size-4" />,
          live: meeting.start <= now && now < meeting.end,
          title: t(meeting.online ? "home.need.meeting.online" : "home.need.meeting", { course: need.course ?? "", day, time: f.timeRange(meeting.start, meeting.end) }),
          detail: [t("home.need.meeting.detail", { number: meeting.number })],
          when: f.fromNow(meeting.start),
          button: need.action.kind === "open" ? t("home.action.join") : t("home.action.openCourse"),
        };
      }
    }
  };
}

function Courses({ courses, nim }: { courses: TermCourse[] | undefined; nim: string | undefined }) {
  const t = useT();
  const statuses = [useStatus("edunex"), useStatus("six")];
  const { refresh, busy } = useRefresh();

  if (!courses) {
    if (statuses.some((status) => status.state === "connecting" || status.state === "live"))
      return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-12" />
            </Card>
          ))}
        </div>
      );
    return (
      <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("home.coursesUnavailable")}>
        {statuses.some((status) => status.state !== "expired" && status.state !== "signed-out") && (
          <Button size="sm" busy={busy} onClick={() => void refresh()}>
            {t("action.tryAgain")}
          </Button>
        )}
      </EmptyState>
    );
  }
  if (courses.length === 0) return <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("home.noCourses")} />;
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
      {courses.map((course) => (
        <li key={course.code}>
          <CourseCard course={course} nim={nim} />
        </li>
      ))}
    </ul>
  );
}

function CourseCard({ course, nim }: { course: TermCourse; nim: string | undefined }) {
  const t = useT();
  const open = useOpenExternal();
  const { go } = useNav();
  const facts = [course.classNo && t("course.class", { no: course.classNo }), course.sks !== null && t("course.sks", { count: course.sks })].filter(Boolean).join(" · ");
  const head = (
    <>
      <CourseCode code={course.code} color={course.color} className="text-small" />
      <span className="mt-2 line-clamp-2 block min-h-[2lh] text-lead font-semibold tracking-[-0.01em]">{course.name}</span>
      {facts && <span className="mt-1 block text-small text-muted">{facts}</span>}
    </>
  );
  return (
    <Card className={cx("flex h-full flex-col p-4", course.edunex && "transition-shadow duration-150 hover:shadow-lift")}>
      {/* A course on EduNex opens its course page; one only in SIX has none. */}
      {course.edunex ? (
        <button type="button" className="focus-ring -m-1 rounded-lg p-1 text-left" onClick={() => go({ screen: "course", code: course.code })}>
          {head}
        </button>
      ) : (
        <div>{head}</div>
      )}
      {course.inSix && <Attendance course={course} />}
      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
          {course.edunex ? (
            <OpenButton label={t("action.openInEdunex")} code={course.code} onClick={() => open(edunexCourseUrl(course.edunex!.courseId))} />
          ) : (
            <>
              {nim && <OpenButton label={t("action.openInSix")} code={course.code} onClick={() => open(sixStatusUrl(nim))} />}
              <span className="text-caption text-faint">{t("course.notOnEdunex")}</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function OpenButton({ label, code, onClick }: { label: string; code: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={onClick} aria-label={`${label}: ${code}`}>
      {label}
    </Button>
  );
}

/** SIX's exact count ("4/6") and its share, rounded down so it never looks better than it is. */
function Attendance({ course }: { course: TermCourse }) {
  const t = useT();
  const count = course.attendance;
  return (
    <div className="mt-3 flex items-center gap-2 text-small">
      <span className="text-muted">{t("course.attendance")}</span>
      <SourceTag source="six" />
      {count && count.held > 0 ? (
        <>
          <Bar
            className="ml-auto w-12"
            value={count.attended / count.held}
            color={course.color}
            label={t("course.attendanceCount", { attended: count.attended, count: count.held })}
          />
          <span className="text-muted tabular-nums">
            {count.attended}/{count.held}
          </span>
          <span className="min-w-9 text-right font-semibold tabular-nums">{Math.floor((count.attended * 100) / count.held)}%</span>
        </>
      ) : (
        <span className="ml-auto text-faint">{t("course.noMeetingsYet")}</span>
      )}
    </div>
  );
}

/** "08:00–09:30", with the weekday when the usual slot is on another day ("Kamis 08:00–09:30"), or the usual room, for a class that moved. */
function movedFrom(f: Format, moved: NonNullable<ClassFacts["moved"]>, at: number): string {
  if (moved.usualStart === null || moved.usualEnd === null) return moved.usualRoom ?? "";
  const time = f.timeRange(moved.usualStart, moved.usualEnd);
  return f.dayOffset(moved.usualStart) === f.dayOffset(at) ? time : `${f.weekday(moved.usualStart)} ${time}`;
}

function NeedRow({ need, first, color }: { need: Need; first: boolean; color: string }) {
  const view = useNeedView()(need);
  const { go } = useNav();
  const open = useOpenExternal();
  const act = () => (need.action.kind === "go" ? go(need.action.route) : open(need.action.url));
  const urgent = need.band === "now";
  return (
    <li className={cx("flex items-start gap-4 px-4 py-3.5", !first && "border-t border-line")}>
      <span className={cx("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", urgent ? "bg-danger-bg text-danger-fg" : need.band === "soon" ? "bg-warning-bg text-warning-fg" : "bg-fill text-muted")}>
        {view.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-body font-semibold">
          {view.live && <LiveDot />}
          <span className="min-w-0">{view.title}</span>
        </p>
        {view.detail.length > 0 && <p className="mt-0.5 text-small text-muted">{view.detail.join(" · ")}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-caption text-faint">
          {need.course && <CourseCode code={need.course} color={color} className="mr-1 text-muted" />}
          {need.sources.map((source) => (
            <SourceTag key={source} source={source} />
          ))}
          {view.when && <span className="ml-1 tabular-nums">{view.when}</span>}
        </p>
      </div>
      <Button
        variant={urgent ? "primary" : "secondary"}
        size="sm"
        className="mt-0.5"
        icon={need.action.kind === "open" ? <Icons.ArrowUpRight className="size-3.5" /> : undefined}
        onClick={act}
        aria-label={`${view.button}: ${view.title}`}
      >
        {view.button}
      </Button>
    </li>
  );
}

// ---------------------------------------------------------------- today

/** Before SIX's timetable: where today's classes come from, and a way in while signed out. */
function NoSixToday() {
  const t = useT();
  const signedOut = useStatus("six").state === "signed-out";
  const { signIn, busy } = useSignIn();
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-muted">
      {t("home.today.noSix")}
      {signedOut && (
        <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
          {t("home.today.signInSix")}
        </Button>
      )}
    </p>
  );
}

function Today({ world, courses }: { world: HomeWorld; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const plan = useMemo(() => todayPlan(world), [world]);
  return (
    <section aria-labelledby="home-today">
      <SectionTitle
        aside={
          <span className="flex items-center gap-2">
            {plan.next && <span className="text-small font-medium text-muted tabular-nums">{t("home.today.next", { time: f.countdown(plan.next.start) })}</span>}
            {world.schedule && <SourceTag source="six" />}
          </span>
        }
      >
        <span id="home-today">{t("home.today")}</span>
      </SectionTitle>
      {!world.schedule ? (
        <NoSixToday />
      ) : plan.classes.length || plan.announced.length ? (
        <ol className="overflow-hidden rounded-xl border border-edge bg-surface">
          {plan.classes.map((item, i) => (
            <ClassRow key={item.session.id} item={item} first={i === 0} course={courses.find((c) => c.code === item.session.courseCode)} />
          ))}
          {plan.announced.map(({ code, meeting }, i) => (
            <li key={`${code}:${meeting.start}`} className={cx("flex items-center gap-3 px-4 py-2.5 text-small", (plan.classes.length > 0 || i > 0) && "border-t border-line")}>
              <span className="w-[92px] shrink-0 font-medium tabular-nums">
                {f.dayOffset(meeting.start) === 1 && <span className="block text-caption text-faint">{t("time.tomorrow")}</span>}
                {f.timeRange(meeting.start, meeting.end)}
              </span>
              <button type="button" className="focus-ring min-w-0 flex-1 truncate rounded text-left" onClick={() => go({ screen: "course", code, tab: "meetings" })}>
                <CourseCode code={code} color={colorOf(courses, code)} />{" "}
                <span className="text-muted">{t(meeting.online ? "home.today.meetingOnline" : "home.today.meeting", { number: meeting.number })}</span>
              </button>
              <Badge tone="warning">{t("home.today.notInSix")}</Badge>
              <JoinButton link={meeting.link} code={code} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-body text-muted">{t("home.today.none")}</p>
      )}
      <DueSoon plan={plan} courses={courses} />
    </section>
  );
}

function ClassRow({ item, first, course }: { item: ClassFacts; first: boolean; course: TermCourse | undefined }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const { attendanceTarget } = useSettings();
  const { session } = item;
  const past = session.end <= now;
  const exam = /\b(UTS|UAS)\b/i.test(session.activity);
  return (
    <li className={cx("grid grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3", !first && "border-t border-line")}>
      <span className={cx("pt-0.5 tabular-nums", past && "opacity-50")}>
        <span className="block text-body font-semibold">{f.time(session.start)}</span>
        <span className={cx("block text-caption", item.moved?.usualStart != null ? "font-semibold text-warning-fg" : "text-faint")}>{f.time(session.end)}</span>
      </span>
      <span className={cx("flex min-w-0 gap-3", past && "opacity-50")}>
        <span aria-hidden className="mt-0.5 h-10 w-[3px] shrink-0 rounded-full" style={{ background: course?.color ?? "var(--faint)" }} />
        <span className="min-w-0">
          {course?.edunex ? (
            <button type="button" className="focus-ring block max-w-full truncate rounded text-left text-body font-medium" onClick={() => go({ screen: "course", code: session.courseCode })}>
              {course.name}
            </button>
          ) : (
            <span className="block truncate text-body font-medium">{course?.name ?? session.courseName}</span>
          )}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small text-muted">
            <span className="font-semibold">{session.courseCode}</span>
            {session.room && (
              <span className="inline-flex items-center gap-1">
                <Icons.MapPin className="size-3" />
                {session.room}
              </span>
            )}
            {(exam || session.activity !== "Kuliah") && <span className={cx("font-semibold", exam && "text-danger-fg")}>{session.activity}</span>}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption">
            {item.countedIn !== "unknown" && (
              <span className="inline-flex items-center gap-1 font-medium text-muted">
                <Icons.Hand className="size-3" />
                {t(`home.countedIn.${item.countedIn}`)}
              </span>
            )}
            {item.health && item.state !== "unknown" && <span className={cx("font-semibold", STATE_TONE[item.state])}>{budgetLabel(t, item.health, attendanceTarget)}</span>}
            {item.moved && (
              <span className="font-semibold text-warning-fg">
                {item.moved.usualStart !== null ? t("home.today.changed", { usual: movedFrom(f, item.moved, session.start) }) : t("home.today.roomChanged", { room: item.moved.usualRoom ?? "" })}
              </span>
            )}
          </span>
        </span>
      </span>
      <span className="flex flex-col items-end gap-1.5 pt-0.5 text-caption font-medium whitespace-nowrap">
        {item.live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2 py-0.5 text-success-fg">
            <LiveDot className="scale-75" />
            {t("home.today.now")}
          </span>
        ) : past ? (
          <span className="text-faint">{t("home.today.done")}</span>
        ) : (
          <span className="text-muted">{f.fromNow(session.start)}</span>
        )}
        {!past && <JoinButton link={item.link} code={session.courseCode} />}
      </span>
    </li>
  );
}

function JoinButton({ link, code }: { link: string | null; code: string }) {
  const t = useT();
  const open = useOpenExternal();
  if (!link) return null;
  return (
    <Button size="sm" icon={<Icons.Video className="size-3.5" />} onClick={() => open(link)} aria-label={t("home.today.joinLabel", { course: code })}>
      {t("home.today.join")}
    </Button>
  );
}

/** What's due today and tomorrow, from the true Task list. */
function DueSoon({ plan, courses }: { plan: TodayPlan; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  return (
    <div className="mt-6" aria-labelledby="home-due">
      <h3 id="home-due" className="mb-2 text-small font-semibold text-muted">
        {t("home.today.due")}
      </h3>
      {plan.due.length ? (
        <ol className="-mx-2">
          {plan.due.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => go({ screen: "task", taskId: task.id })}
                className="focus-ring flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-hover"
              >
                <CourseCode code={task.courseCode} color={colorOf(courses, task.courseCode)} className="text-small" />
                <span className="min-w-0 flex-1 truncate text-body font-medium">{task.title}</span>
                <span className="text-caption whitespace-nowrap text-muted tabular-nums">{f.dueLabel(task.dueAt!)}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-small text-faint">{t("home.today.nothingDue")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- what changed

const CHANGE_ICON: Partial<Record<AlertKind, typeof Icons.Home>> = {
  newTask: Icons.ListChecks,
  newMaterial: Icons.FileText,
  taskEdited: Icons.PenLine,
  scheduleChanged: Icons.CalendarClock,
  meeting: Icons.CalendarClock,
  exam: Icons.GraduationCap,
  grade: Icons.Star,
  krs: Icons.ShieldCheck,
};
const IMPORTANT: ReadonlySet<string> = new Set(["alert.taskEdited.afterSubmit", "alert.materialToday", "home.change.moved", "home.change.meeting"]);
const SHOWN = 8;

function Changes({ world }: { world: HomeWorld }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const history = useDataset("app.alerts");
  const changes = useMemo(() => recentChanges(world, history?.items ?? []).slice(0, SHOWN), [world, history]);
  const days = groupByDay(changes, f);
  return (
    <section aria-labelledby="home-changes">
      <SectionTitle>
        <span id="home-changes">{t("home.changes")}</span>
      </SectionTitle>
      {changes.length === 0 ? (
        <p className="text-body text-muted">{t("home.changes.none")}</p>
      ) : (
        days.map(({ label, items }) => (
          <div key={label} className="mb-3">
            <h3 className="mb-1 text-caption font-semibold text-faint">{label}</h3>
            <ol className="-mx-2">
              {items.map((item) => {
                const Icon = CHANGE_ICON[item.kind] ?? Icons.Bell;
                const important = IMPORTANT.has(item.title.key);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.target)}
                      className="focus-ring flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-hover"
                    >
                      <span className={cx("mt-0.5", important ? "text-warning-fg" : "text-faint")}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium">{t(item.title.key, item.title.vars)}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
                          <SourceTag source={item.source} />
                          {item.body && <span className="truncate">{t(item.body.key, item.body.vars)}</span>}
                        </span>
                      </span>
                      <span className="text-caption whitespace-nowrap text-faint tabular-nums">{f.time(item.at)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}

function groupByDay(items: readonly Alert[], f: Format): { label: string; items: Alert[] }[] {
  const days: { label: string; items: Alert[] }[] = [];
  for (const item of items) {
    const label = f.relativeDay(item.at);
    const last = days.at(-1);
    if (last?.label === label) last.items.push(item);
    else days.push({ label, items: [item] });
  }
  return days;
}

