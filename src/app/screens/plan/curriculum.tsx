// Rencana studi tab — The curriculum map (#79): the program's required
// courses by recommended semester with where the Student stands on each
// (courses passed under an older code matched the way SIX places them), in
// plain words that say what to do; "Sisa saja" hides what's done, with a
// summary of what's left that stays in view; the totals labelled and from the
// same SKS count as the planner; specializations and minors with progress;
// and each course's syllabus on SIX's public pages.
import { type ReactNode, useState } from "react";
import { type CurriculumMap, curriculumMap, type MapCourse, type PackageProgress, type SlotStatus } from "../../../core/curriculum-map";
import { type SksModel, sksModel } from "../../../core/planner";
import { useOpenExternal } from "../../hooks";
import { useT } from "../../i18n";
import { usePlan, useStudentRecord } from "../../study-plan";
import { IconButton, Switch } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Bar, Card, SectionTitle } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Tooltip } from "../../ui/overlays";
import { SixNeeded } from "./six-needed";

export const ready = true;

/** A count for the Rencana studi sidebar entry, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

/** SIX's public course page (no sign-in): the syllabus. */
export const syllabusUrl = (courseId: string) => `https://six.itb.ac.id/pub/matakuliah/${courseId}`;

/** Still to do: everything not passed or credited. */
const isLeft = (status: SlotStatus) => status !== "passed" && status !== "exempt";

export function Tab({ onCalendar }: { onCalendar?: () => void }) {
  const t = useT();
  const record = useStudentRecord();
  const state = usePlan(record);
  // Late in the studies, what's left is what matters: start there.
  const [onlyLeft, setOnlyLeft] = useState((record?.semesterNow ?? 0) >= 5);
  if (!record || !state || !record.curriculum)
    return (
      <SixNeeded
        icon={<Icons.Layers className="size-5" />}
        title={t("curriculum.needSix")}
        body={t("curriculum.needSixBody")}
        action={
          onCalendar && (
            <button type="button" onClick={onCalendar} className="focus-ring rounded-md px-2 py-1 text-small font-semibold text-accent-fg hover:underline">
              {t("plan.toCalendar")}
            </button>
          )
        }
      />
    );
  const map = curriculumMap(record, state.plan);
  const sks = sksModel(record, state.plan);
  const semesters = map.semesters
    .map((s) => ({
      ...s,
      required: onlyLeft ? s.required.filter((c) => isLeft(c.status)) : s.required,
      others: onlyLeft ? s.others.filter((c) => isLeft(c.status)) : s.others,
    }))
    .filter((s) => s.required.length + s.others.length > 0);
  const hidden = map.semesters.length - semesters.length;
  return (
    <div className="@container space-y-6">
      <Totals name={record.curriculum.name} sks={sks} />
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <LeftBar map={map} sks={sks} onlyLeft={onlyLeft} onToggle={setOnlyLeft} />
          {semesters.map((semester) => (
            <Card key={semester.semester} className="overflow-hidden">
              <section aria-label={t("planner.semester", { n: semester.semester })}>
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <h3 className="text-body font-semibold">{t("planner.semester", { n: semester.semester })}</h3>
                  {!onlyLeft && (
                    <span className="text-small font-medium text-muted tabular-nums">
                      {t("curriculum.sks", { sks: semester.required.reduce((sum, c) => sum + c.sks, 0) })}
                    </span>
                  )}
                </header>
                <ul>
                  {semester.required.map((course) => (
                    <CourseRow key={course.code} course={course} />
                  ))}
                </ul>
                {semester.others.length > 0 && (
                  <>
                    <p className="border-t border-line px-4 pt-2.5 pb-1 text-caption font-medium text-muted">{t("curriculum.others")}</p>
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
          {onlyLeft && semesters.length === 0 && <p className="rounded-xl bg-sunken px-4 py-6 text-center text-small text-muted">{t("curriculum.allDone")}</p>}
          {onlyLeft && hidden > 0 && semesters.length > 0 && <p className="text-caption text-faint">{t("curriculum.hiddenDone", { count: hidden })}</p>}
        </div>
        <aside className="space-y-6">
          {map.specializations.length > 0 && <Packages title={t("curriculum.specializations")} packages={map.specializations} />}
          {map.minors.length > 0 && <Packages title={t("curriculum.minors")} packages={map.minors} />}
        </aside>
      </div>
    </div>
  );
}

/** The curriculum's three numbers, each with its label: the total, required left, electives. */
function Totals({ name, sks }: { name: string; sks: SksModel }) {
  const t = useT();
  const figure = (label: string, value: ReactNode, hint?: ReactNode) => (
    <div className="min-w-0">
      <dt className="text-caption font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-title font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-caption text-muted tabular-nums">{hint}</dd>}
    </div>
  );
  const e = sks.electives;
  return (
    <Card className="px-6 py-4">
      <p className="text-small font-medium text-muted">{name}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 @2xl:grid-cols-3">
        {figure(
          t("curriculum.total"),
          t("curriculum.sks", { sks: sks.need }),
          sks.requiredNeed !== null && sks.electiveNeed !== null
            ? t("curriculum.totalSplit", { required: sks.requiredNeed, electives: sks.electiveNeed })
            : undefined,
        )}
        {figure(
          t("curriculum.requiredLeft"),
          sks.requiredLeft.count
            ? t("curriculum.requiredLeftValue", { count: sks.requiredLeft.count, sks: sks.requiredLeft.sks })
            : t("curriculum.requiredNone"),
          sks.requiredLeft.count > 0 && sks.requiredUnplanned.count === 0 ? t("curriculum.requiredLeftHint") : undefined,
        )}
        {sks.electiveNeed !== null &&
          figure(
            t("curriculum.electives"),
            <>
              {t("curriculum.electivesValue", { have: Math.min(e.have, sks.electiveNeed), need: sks.electiveNeed })}
              {e.extra > 0 && <span className="ml-1.5 text-small font-semibold text-success-fg">+{e.extra}</span>}
            </>,
            t("curriculum.electivesDetail", { passed: e.passed, now: e.inProgress, planned: e.planned }),
          )}
      </dl>
    </Card>
  );
}

/** "Sisa saja" and what's left, kept in view while scrolling. */
function LeftBar({ map, sks, onlyLeft, onToggle }: { map: CurriculumMap; sks: SksModel; onlyLeft: boolean; onToggle: (on: boolean) => void }) {
  const t = useT();
  const check = map.semesters.flatMap((s) => s.required).filter((c) => c.status === "unlisted").length;
  const parts = [
    sks.requiredLeft.count ? t("curriculum.left.required", { count: sks.requiredLeft.count, sks: sks.requiredLeft.sks }) : t("curriculum.left.requiredNone"),
    sks.electiveNeed === null ? null : sks.electives.short ? t("curriculum.left.electives", { sks: sks.electives.short }) : t("curriculum.left.electivesNone"),
    check ? t("curriculum.left.check", { count: check }) : null,
  ].filter((part): part is string => part !== null);
  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-canvas/90 px-1 py-2 backdrop-blur-sm">
      <p className="flex min-w-0 items-start gap-1.5 text-small text-muted" role="status">
        <span className="shrink-0 font-semibold text-fg">{t("curriculum.left")}:</span> <Meta>{parts}</Meta>
      </p>
      <label className="flex items-center gap-2 text-small font-medium">
        <Switch checked={onlyLeft} onCheckedChange={onToggle} label={t("curriculum.onlyLeft")} />
        {t("curriculum.onlyLeft")}
      </label>
    </div>
  );
}

/** Where a course stands, in plain words: quiet when done or not yet, colored only where it needs the Student. */
function Status({ status, grade }: { status: SlotStatus; grade: string | null }) {
  const t = useT();
  const label = t(`curriculum.status.${status}`);
  switch (status) {
    case "passed":
    case "exempt":
      return (
        <span className="inline-flex items-center gap-1 text-small text-muted whitespace-nowrap">
          <Icons.Check className="size-3.5 text-success-fg" weight="bold" />
          <Meta>
            {label}
            {grade && status === "passed" ? <span className="font-semibold text-fg tabular-nums">{grade}</span> : null}
          </Meta>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex h-[20px] items-center gap-1 rounded-full bg-danger-bg px-2 text-micro font-semibold whitespace-nowrap text-danger-fg">
          <Icons.AlertTriangle className="size-3" />
          {label}
        </span>
      );
    case "in-progress":
      return (
        <span className="inline-flex items-center gap-1 text-small font-medium whitespace-nowrap text-info-fg">
          <Icons.Clock className="size-3.5" />
          {label}
        </span>
      );
    case "planned":
      return (
        <span className="inline-flex items-center gap-1 text-small whitespace-nowrap text-muted">
          <Icons.Calendar className="size-3.5" />
          {label}
        </span>
      );
    case "unlisted":
      return (
        <span className="inline-flex items-center gap-1 text-small text-muted">
          <Icons.Info className="size-3.5 shrink-0" />
          {label}
        </span>
      );
    default:
      return <span className="text-small whitespace-nowrap text-faint">{label}</span>;
  }
}

function CourseRow({ course }: { course: MapCourse }) {
  const t = useT();
  const open = useOpenExternal();
  return (
    <li className="group grid grid-cols-[68px_minmax(0,1fr)_auto_28px_28px] items-center gap-3 border-b border-line px-4 py-2 text-body last:border-b-0">
      <span className="text-small font-semibold tabular-nums">{course.code}</span>
      <span className="min-w-0">
        <span className="block truncate">{course.name}</span>
        {course.via && <span className="block truncate text-caption text-muted">{t("curriculum.via", { code: course.via.code, name: course.via.name })}</span>}
      </span>
      <Status status={course.status} grade={course.grade} />
      <span className="text-right text-small text-muted tabular-nums">{course.sks}</span>
      {course.courseId ? (
        <Tooltip content={t("curriculum.syllabusOf", { code: course.code })}>
          <IconButton
            label={t("curriculum.syllabusOf", { code: course.code })}
            size="sm"
            className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => open(syllabusUrl(course.courseId!))}
          >
            <Icons.FileText className="size-3.5" />
          </IconButton>
        </Tooltip>
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
                {p.registered && (
                  <span className="rounded-[5px] bg-info-bg px-1.5 text-micro leading-[18px] font-semibold text-info-fg">{t("curriculum.registered")}</span>
                )}
                <span className="text-small font-semibold tabular-nums">{t("curriculum.packageSks", { have: p.have, need: p.sks })}</span>
              </span>
            </p>
            <Bar
              className="mt-2"
              value={p.sks ? p.have / p.sks : 0}
              color="var(--live)"
              label={`${p.name}: ${t("curriculum.packageSks", { have: p.have, need: p.sks })}`}
            />
            <ul className="mt-2 space-y-1">
              {p.courses.map((c) => (
                <li key={c.code} className="flex items-center gap-2 text-caption">
                  <span
                    className={cx(
                      "w-[56px] font-semibold tabular-nums",
                      isLeft(c.status) && c.status !== "in-progress" && c.status !== "planned" && "text-muted",
                    )}
                  >
                    {c.code}
                  </span>
                  <span className={cx("min-w-0 flex-1 truncate", isLeft(c.status) ? "text-muted" : "text-fg")}>{c.name}</span>
                  <PackageMark status={c.status} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** A package course: a check when done, a word when under way, nothing (just grey) when not taken. */
function PackageMark({ status }: { status: SlotStatus }) {
  const t = useT();
  if (status === "passed" || status === "exempt")
    return (
      <span className="shrink-0">
        <Icons.Check className="size-3.5 text-success-fg" weight="bold" />
        <span className="sr-only">{t(`curriculum.status.${status}`)}</span>
      </span>
    );
  if (status === "in-progress" || status === "planned" || status === "failed")
    return (
      <span
        className={cx("shrink-0", status === "in-progress" ? "font-medium text-info-fg" : status === "failed" ? "font-medium text-danger-fg" : "text-muted")}
      >
        {t(`curriculum.status.${status}`)}
      </span>
    );
  return <span className="sr-only">{t("curriculum.status.left")}</span>;
}
