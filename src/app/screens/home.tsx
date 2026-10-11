// Beranda. For now: who you are, this term, and your courses from EduNex.
// Today's classes, what's due and what changed join as their sources land.
import { edunexCourseUrl } from "../../core/links";
import type { Course } from "../../core/models";
import { useFormat, useNow, useT } from "../i18n";
import { firstName } from "../names";
import { useNav } from "../nav";
import { SourceNotice, useRefresh } from "../shell/source-status";
import { useCourseColors, useOpenExternal } from "../hooks";
import { useDataset, useStatus } from "../store";
import { Button } from "../ui/controls";
import { Card, CourseCode, EmptyState, SectionTitle, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { DueNext } from "./tasks";

export function Home() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const account = useDataset("edunex.account");
  const courses = useDataset("edunex.courses");
  const term = courses?.[0]?.term;

  return (
    <div className="mx-auto max-w-[1080px] px-10 pt-7 pb-20">
      <header>
        <p className="text-body font-medium text-muted">
          {f.dateLong(now)}
          {term ? ` · ${f.term(term)}` : ""}
        </p>
        <h1 className="mt-1 text-display font-semibold tracking-[-0.02em]">
          {f.greeting()}
          {account ? `, ${firstName(account.name)}` : ""}
        </h1>
      </header>

      <SourceNotice source="edunex" hasData={account !== undefined} />

      <DueNext />

      <section className="mt-9" aria-labelledby="home-courses">
        <SectionTitle count={courses?.length}>
          <span id="home-courses">{t("home.coursesThisTerm")}</span>
        </SectionTitle>
        <Courses courses={courses} />
      </section>
    </div>
  );
}

function Courses({ courses }: { courses: Course[] | undefined }) {
  const t = useT();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  const colors = useCourseColors(courses);

  if (!courses) {
    if (status.state === "connecting" || status.state === "live")
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
        {status.state !== "expired" && (
          <Button size="sm" busy={busy} onClick={() => void refresh("edunex")}>
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
          <CourseCard course={course} color={colors.get(course.code) ?? "#888"} />
        </li>
      ))}
    </ul>
  );
}

function CourseCard({ course, color }: { course: Course; color: string }) {
  const t = useT();
  const open = useOpenExternal();
  const { go } = useNav();
  return (
    <Card className="flex h-full flex-col p-4 transition-shadow duration-150 hover:shadow-lift">
      <button type="button" className="focus-ring -m-1 flex-1 rounded-lg p-1 text-left" onClick={() => go({ screen: "course", code: course.code })}>
        <CourseCode code={course.code} color={color} className="text-small" />
        <span className="mt-2 line-clamp-2 min-h-10 text-lead font-semibold tracking-[-0.01em]">{course.name}</span>
        {course.classNo && <span className="mt-1 block text-small text-muted">{t("course.class", { no: course.classNo })}</span>}
      </button>
      <div className="mt-3 border-t border-line pt-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          icon={<Icons.ArrowUpRight className="size-3.5" />}
          onClick={() => open(edunexCourseUrl(course.edunex.courseId))}
          aria-label={`${t("action.openInEdunex")}: ${course.code}`}
        >
          {t("action.openInEdunex")}
        </Button>
      </div>
    </Card>
  );
}
