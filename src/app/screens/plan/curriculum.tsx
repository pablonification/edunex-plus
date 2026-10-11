// Rencana studi tab — The curriculum map (#79): the program's required
// courses by recommended semester with where the Student stands on each
// (courses passed under an older code matched the way SIX places them), the
// required and elective SKS left, specializations and minors with progress,
// and each course's syllabus on SIX's public pages.
import type { ReactNode } from "react";
import { type CurriculumMap, curriculumMap, type MapCourse, type PackageProgress, type SlotStatus } from "../../../core/curriculum-map";
import { useOpenExternal } from "../../hooks";
import { useT } from "../../i18n";
import { usePlan, useStudentRecord } from "../../study-plan";
import { IconButton } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Bar, Card, EmptyState, SectionTitle, SourceTag } from "../../ui/display";
import { Icons } from "../../ui/icons";

export const ready = true;

/** A count for the Rencana studi sidebar entry, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

/** SIX's public course page (no sign-in): the syllabus. */
export const syllabusUrl = (courseId: string) => `https://six.itb.ac.id/pub/matakuliah/${courseId}`;

const STATUS: Record<SlotStatus, { tone: string; icon: ReactNode }> = {
  passed: { tone: "bg-success-bg text-success-fg", icon: <Icons.CheckCircle className="size-3" strokeWidth={2} /> },
  exempt: { tone: "bg-success-bg text-success-fg", icon: <Icons.Check className="size-3" strokeWidth={2} /> },
  "in-progress": { tone: "bg-info-bg text-info-fg", icon: <Icons.Clock className="size-3" strokeWidth={2} /> },
  planned: { tone: "bg-(--status-review-bg) text-(--status-review-fg)", icon: <Icons.Calendar className="size-3" strokeWidth={2} /> },
  failed: { tone: "bg-danger-bg text-danger-fg", icon: <Icons.AlertTriangle className="size-3" strokeWidth={2} /> },
  left: { tone: "bg-warning-bg text-warning-fg", icon: <Icons.Circle className="size-3" strokeWidth={2} /> },
  unlisted: { tone: "bg-neutral-bg text-neutral-fg", icon: <Icons.Circle className="size-3" strokeWidth={2} /> },
};

export function Tab() {
  const t = useT();
  const record = useStudentRecord();
  const state = usePlan(record);
  if (!record || !state || !record.curriculum) return <EmptyState icon={<Icons.Layers className="size-5" />} title={t("curriculum.empty")} />;
  const map = curriculumMap(record, state.plan);
  return (
    <div className="space-y-8">
      <Totals map={map} name={record.curriculum.name} />
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6">
        <div className="space-y-3">
          {map.semesters.map((semester) => (
            <Card key={semester.semester} className="overflow-hidden">
              <section aria-label={t("planner.semester", { n: semester.semester })}>
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <h3 className="text-body font-semibold">{t("planner.semester", { n: semester.semester })}</h3>
                  <span className="text-small font-semibold text-muted tabular-nums">{t("curriculum.sks", { sks: semester.required.reduce((sum, c) => sum + c.sks, 0) })}</span>
                </header>
                <ul>
                  {semester.required.map((course) => (
                    <CourseRow key={course.code} course={course} />
                  ))}
                </ul>
                {semester.others.length > 0 && (
                  <>
                    <p className="border-t border-line px-4 pt-2.5 pb-1 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("curriculum.others")}</p>
                    <ul>
                      {semester.others.map((course) => (
                        <CourseRow key={course.code} course={course} />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </Card>
          ))}
        </div>
        <aside className="space-y-4">
          {map.specializations.length > 0 && <Packages title={t("curriculum.specializations")} packages={map.specializations} />}
          {map.minors.length > 0 && <Packages title={t("curriculum.minors")} packages={map.minors} />}
        </aside>
      </div>
    </div>
  );
}

function Totals({ map, name }: { map: CurriculumMap; name: string }) {
  const t = useT();
  return (
    <Card className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-8 px-6 py-5">
      <div>
        <p className="flex items-center gap-2 text-small font-medium text-muted">
          {name} <SourceTag source="six" />
        </p>
        <p className="mt-1 text-[22px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">{t("curriculum.sks", { sks: map.requiredSks })}</p>
      </div>
      <div className="text-right">
        <p className="text-caption font-medium text-muted">{t("curriculum.requiredLeft")}</p>
        <p className="text-[16px] font-semibold tabular-nums">{t("curriculum.sks", { sks: map.requiredLeftSks })}</p>
      </div>
      {map.electiveNeed !== null && (
        <div className="text-right">
          <p className="text-caption font-medium text-muted">{t("curriculum.electives")}</p>
          <p className="text-[16px] font-semibold tabular-nums">{t("curriculum.sks", { sks: Math.max(0, map.electiveNeed - map.electivePassed - map.electiveInProgress) })}</p>
          <p className="text-caption text-faint">{t("curriculum.electivesDetail", { passed: map.electivePassed, now: map.electiveInProgress, need: map.electiveNeed })}</p>
        </div>
      )}
    </Card>
  );
}

function StatusChip({ status, grade }: { status: SlotStatus; grade: string | null }) {
  const t = useT();
  return (
    <span className={cx("inline-flex h-[20px] shrink-0 items-center gap-1 rounded-full px-2 text-micro font-semibold whitespace-nowrap", STATUS[status].tone)}>
      {STATUS[status].icon}
      {t(`curriculum.status.${status}`)}
      {grade && status !== "left" && <span className="tabular-nums">· {grade}</span>}
    </span>
  );
}

function CourseRow({ course }: { course: MapCourse }) {
  const t = useT();
  const open = useOpenExternal();
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)_auto_44px_28px] items-center gap-3 border-b border-line px-4 py-2 text-body last:border-b-0">
      <span className="font-semibold tabular-nums">{course.code}</span>
      <span className="min-w-0">
        <span className="block truncate">{course.name}</span>
        {course.via && <span className="block truncate text-caption text-muted">{t("curriculum.via", { code: course.via.code, name: course.via.name })}</span>}
      </span>
      <StatusChip status={course.status} grade={course.grade} />
      <span className="text-right text-muted tabular-nums">{course.sks}</span>
      {course.courseId ? (
        <IconButton label={t("curriculum.syllabusOf", { code: course.code })} size="sm" onClick={() => open(syllabusUrl(course.courseId!))}>
          <Icons.FileText className="size-3.5" />
        </IconButton>
      ) : (
        <span />
      )}
    </li>
  );
}

function Packages({ title, packages }: { title: string; packages: PackageProgress[] }) {
  const t = useT();
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-3">
        {packages.map((p) => (
          <Card key={`${p.program ?? ""}${p.name}`} className="px-4 py-3">
            <p className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-small font-semibold">{p.name}</span>
                {p.program && <span className="block truncate text-caption text-muted">{p.program}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {p.registered && <span className="rounded bg-info-bg px-1.5 text-micro leading-[18px] font-semibold text-info-fg">{t("curriculum.registered")}</span>}
                <span className="text-small font-semibold tabular-nums">{t("curriculum.packageSks", { have: p.have, need: p.sks })}</span>
              </span>
            </p>
            <Bar className="mt-2" value={p.sks ? p.have / p.sks : 0} color="var(--live)" label={`${p.name}: ${t("curriculum.packageSks", { have: p.have, need: p.sks })}`} />
            <ul className="mt-2 space-y-1">
              {p.courses.map((c) => (
                <li key={c.code} className="flex items-center gap-2 text-caption">
                  <span className="w-[56px] font-semibold tabular-nums">{c.code}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{c.name}</span>
                  <StatusChip status={c.status} grade={null} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
