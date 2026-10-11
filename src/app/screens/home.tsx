// Beranda. For now: who you are, this term, and your courses: SIX's list once
// SIX is connected (class, SKS, attendance), with EduNex's course pages.
// Today's classes, what's due and what changed join as their sources land.
import { edunexCourseUrl, sixStatusUrl } from "../../core/links";
import { type TermCourse, useTerm, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { useFormat, useNow, useT } from "../i18n";
import { firstName } from "../names";
import { useNav } from "../nav";
import { SourceNotice, useRefresh } from "../shell/source-status";
import { useDataset, useStatus } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Bar, Card, CourseCode, EmptyState, SectionTitle, Skeleton, SourceTag } from "../ui/display";
import { Icons } from "../ui/icons";
import { DueNext } from "./tasks";

export function Home() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const term = useTerm();
  const name = account?.name ?? student?.name;

  return (
    <div className="mx-auto max-w-[1080px] px-10 pt-7 pb-20">
      <header>
        <p className="text-body font-medium text-muted">
          {f.dateLong(now)}
          {term ? ` · ${f.term(term)}` : ""}
        </p>
        <h1 className="mt-1 text-display font-semibold tracking-[-0.02em]">
          {f.greeting()}
          {name ? `, ${firstName(name)}` : ""}
        </h1>
      </header>

      <SourceNotice source="edunex" hasData={account !== undefined} />
      <SourceNotice source="six" hasData={student !== undefined} />

      <DueNext />

      <section className="mt-9" aria-labelledby="home-courses">
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
