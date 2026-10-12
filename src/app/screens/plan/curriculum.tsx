// Rencana studi tab — The curriculum map (#79): the program's required
// courses by recommended semester with where the Student stands on each
// (courses passed under an older code matched the way SIX places them), in
// plain words that say what to do; "Sisa saja" hides what's done, with a
// summary of what's left that stays in view; the totals labelled and from the
// same SKS count as the planner; specializations and minors with progress;
// each course's syllabus on SIX's public pages; and the Student's own
// corrections where SIX's record doesn't match their curriculum, each one
// marked and reversible.
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { curriculumMap, type MapCourse, type PackageProgress, type SlotStatus, type StandIn, standIns } from "../../../core/curriculum-map";
import type { CurriculumFix } from "../../../core/models";
import { hasWhatIfs, type SksModel, type StudentRecord, sksModel } from "../../../core/planner";
import { useOpenExternal } from "../../hooks";
import { useT } from "../../i18n";
import { useCurriculumFix, usePlan, useStudentRecord } from "../../study-plan";
import { IconButton, Switch } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Bar, Card, SectionTitle } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Menu, type MenuItem } from "../../ui/menu";
import { Dialog, Tooltip, toast } from "../../ui/overlays";
import { Tag } from "./planner";
import { SixNeeded } from "./six-needed";

export const ready = true;

/** A count for the Rencana studi sidebar entry, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

/** SIX's public course page (no sign-in): the syllabus. */
export const syllabusUrl = (courseId: string) => `https://six.itb.ac.id/pub/matakuliah/${courseId}`;

/** Still to do: everything not passed, credited, or off the Student's list (SIX doesn't ask it of them, or they said so). */
const isLeft = (status: SlotStatus) => !["passed", "exempt", "unlisted", "not-mine", "done"].includes(status);

/**
 * With "Sisa saja" on, a course the Student corrects is no longer left, and
 * its row goes once the correction is saved: focus moves to the next row's
 * ⋯ (or the switch, after the last row) instead of falling to the page.
 */
function useFocusAfterCorrection(rows: MapCourse[]) {
  const pending = useRef<{ code: string; at: number; next: string | null } | null>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const toggle = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    const wait = pending.current;
    if (!wait) return;
    const row = rows.find((c) => c.code === wait.code);
    // Still listed: not saved yet (keep waiting), or saved and still left (its ⋯ keeps focus).
    if (row) {
      if (row.fix?.at === wait.at) pending.current = null;
      return;
    }
    pending.current = null;
    const next = wait.next === null ? null : rowEls.current.get(wait.next)?.querySelector<HTMLElement>("[aria-haspopup=menu]");
    (next ?? toggle.current?.querySelector<HTMLElement>("[role=switch]"))?.focus();
  });
  return {
    corrected(course: MapCourse, at: number) {
      const index = rows.findIndex((c) => c.code === course.code);
      pending.current = { code: course.code, at, next: rows[index + 1]?.code ?? null };
    },
    row: (code: string) => (el: HTMLElement | null) => {
      if (el) rowEls.current.set(code, el);
      else rowEls.current.delete(code);
    },
    toggle,
  };
}

export function Tab({ onCalendar }: { onCalendar?: () => void }) {
  const t = useT();
  const state = usePlan(useStudentRecord());
  // With this term's what-ifs, like the planner: the two tabs never disagree.
  const record = state?.record;
  const setFix = useCurriculumFix();
  const [onlyLeft, setOnlyLeft] = useState(false);
  const [picking, setPicking] = useState<MapCourse | null>(null);
  const map = record?.curriculum && state ? curriculumMap(record, state.plan) : null;
  const semesters = (map?.semesters ?? [])
    .map((s) => ({
      ...s,
      required: onlyLeft ? s.required.filter((c) => isLeft(c.status)) : s.required,
      others: onlyLeft ? s.others.filter((c) => isLeft(c.status)) : s.others,
    }))
    .filter((s) => s.required.length + s.others.length > 0);
  const focus = useFocusAfterCorrection(semesters.flatMap((s) => s.required));
  if (!record || !state || !record.curriculum || !map)
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
  const sks = sksModel(record, state.plan);
  const hidden = map.semesters.length - semesters.length;
  const correct = (course: MapCourse, fix: CurriculumFix | null, message: string) => {
    const before = course.fix;
    if (onlyLeft && fix) focus.corrected(course, fix.at);
    setFix(course.code, fix);
    toast(message, "neutral", { label: t("planner.undo"), onClick: () => setFix(course.code, before) });
  };
  const menuOf = (course: MapCourse): MenuItem[] => {
    const at = Date.now();
    const items: MenuItem[] = [];
    if (course.fix?.kind !== "not-mine")
      items.push({
        label: t("curriculum.fix.not-mine"),
        hint: t("curriculum.fix.not-mineHint"),
        icon: <Icons.Minus className="size-4" />,
        onSelect: () => correct(course, { kind: "not-mine", at }, t("curriculum.fixDone.not-mine", { code: course.code })),
      });
    items.push({
      label: t("curriculum.fix.counted-as"),
      hint: t("curriculum.fix.counted-asHint"),
      icon: <Icons.Route className="size-4" />,
      onSelect: () => setPicking(course),
    });
    if (course.fix?.kind !== "done")
      items.push({
        label: t("curriculum.fix.done"),
        hint: t("curriculum.fix.doneHint"),
        icon: <Icons.Check className="size-4" />,
        onSelect: () => correct(course, { kind: "done", at }, t("curriculum.fixDone.done", { code: course.code })),
      });
    if (course.fix)
      items.push({
        label: t("curriculum.fix.restore"),
        hint: t("curriculum.fix.restoreHint"),
        icon: <Icons.History className="size-4" />,
        onSelect: () => correct(course, null, t("curriculum.fixDone.restore", { code: course.code })),
      });
    return items;
  };
  return (
    <div className="@container space-y-6">
      <Totals
        whatIf={hasWhatIfs(state.plan, record)}
        name={record.curriculum.name}
        year={record.curriculum.year}
        startedOn={map.startedOn}
        unlisted={map.semesters.flatMap((s) => s.required).filter((c) => c.status === "unlisted").length}
        sks={sks}
      />
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <LeftBar sks={sks} onlyLeft={onlyLeft} onToggle={setOnlyLeft} toggleRef={focus.toggle} />
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
                    <CourseRow key={course.code} ref={focus.row(course.code)} course={course} menu={menuOf(course)} />
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
      {picking && (
        <PickStandIn
          record={record}
          course={picking}
          onPick={(from) => {
            setPicking(null);
            correct(picking, { kind: "counted-as", code: from, at: Date.now() }, t("curriculum.fixDone.counted-as", { from, code: picking.code }));
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

/** The curriculum's three numbers, each with its label: the total, required left, electives. */
function Totals({
  whatIf,
  name,
  year,
  startedOn,
  unlisted,
  sks,
}: {
  /** This semester holds what-ifs: every count here includes them. */
  whatIf: boolean;
  name: string;
  year: number;
  startedOn: number | null;
  unlisted: number;
  sks: SksModel;
}) {
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
      {(startedOn !== null || unlisted > 0) && (
        <p className="mt-0.5 max-w-[72ch] text-caption text-muted">
          {[startedOn !== null && t("curriculum.startedOn", { from: startedOn, to: year }), unlisted > 0 && t("curriculum.unlistedNote", { count: unlisted })]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
      {whatIf && (
        <p className="mt-0.5 flex items-center gap-1 text-caption font-medium text-info-fg">
          <Icons.Info className="size-3 shrink-0" weight="bold" />
          {t("curriculum.withWhatIfs")}
        </p>
      )}
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
function LeftBar({
  sks,
  onlyLeft,
  onToggle,
  toggleRef,
}: {
  sks: SksModel;
  onlyLeft: boolean;
  onToggle: (on: boolean) => void;
  toggleRef: Ref<HTMLLabelElement>;
}) {
  const t = useT();
  const parts = [
    sks.requiredLeft.count ? t("curriculum.left.required", { count: sks.requiredLeft.count, sks: sks.requiredLeft.sks }) : t("curriculum.left.requiredNone"),
    sks.electiveNeed === null ? null : sks.electives.short ? t("curriculum.left.electives", { sks: sks.electives.short }) : t("curriculum.left.electivesNone"),
  ].filter((part): part is string => part !== null);
  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-canvas/90 px-1 py-2 backdrop-blur-sm">
      <p className="flex min-w-0 items-start gap-1.5 text-small text-muted" role="status">
        <span className="shrink-0 font-semibold text-fg">{t("curriculum.left")}:</span> <Meta>{parts}</Meta>
      </p>
      <label ref={toggleRef} className="flex items-center gap-2 text-small font-medium">
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
    case "done":
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
        <Tooltip content={t("curriculum.unlistedWhy")}>
          <span className="inline-flex items-center gap-1 text-small whitespace-nowrap text-muted">
            <Icons.Info className="size-3.5 shrink-0" />
            {label}
          </span>
        </Tooltip>
      );
    case "not-mine":
      return (
        <span className="inline-flex items-center gap-1 text-small text-faint">
          <Icons.Minus className="size-3.5 shrink-0" />
          {label}
        </span>
      );
    default:
      return <span className="text-small whitespace-nowrap text-faint">{label}</span>;
  }
}

/** Shown on hover or keyboard focus, so a list of 45 rows stays calm; kept while its menu is open. */
const ON_HOVER = "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100";

function CourseRow({ course, menu, ref }: { course: MapCourse; menu?: MenuItem[]; ref?: Ref<HTMLLIElement> }) {
  const t = useT();
  const open = useOpenExternal();
  const crossed = course.status === "not-mine";
  return (
    <li
      ref={ref}
      className="group grid grid-cols-[68px_minmax(0,1fr)_auto_28px_28px_28px] items-center gap-3 border-b border-line px-4 py-2 text-body last:border-b-0"
    >
      <span className={cx("text-small font-semibold tabular-nums", crossed && "text-muted")}>{course.code}</span>
      <span className="min-w-0">
        <span className={cx("block truncate", crossed && "text-muted")}>{course.name}</span>
        {(course.via || course.fix) && (
          <Meta className="text-caption text-muted">
            {course.via && <span className="truncate">{t("curriculum.via", { code: course.via.code, name: course.via.name })}</span>}
            {course.fix && <span className="inline-flex items-center gap-1 whitespace-nowrap">{t("curriculum.fixed")}</span>}
            {course.sixLeft && <span>{t("curriculum.sixStillLeft")}</span>}
          </Meta>
        )}
      </span>
      {course.whatIf === "added" ? (
        // Tried this semester, not on SIX's KRS: never "This semester" as if it were.
        <Tag tone="what-if">{t("planner.whatIfTag")}</Tag>
      ) : course.whatIf === "left-out" ? (
        <span className="text-small whitespace-nowrap text-info-fg">{t("planner.droppedTag")}</span>
      ) : (
        <Status status={course.status} grade={course.grade} />
      )}
      <span className="text-right text-small text-muted tabular-nums">{course.sks}</span>
      {course.courseId ? (
        <Tooltip content={t("curriculum.syllabusOf", { code: course.code })}>
          <IconButton
            label={t("curriculum.syllabusOf", { code: course.code })}
            size="sm"
            className={ON_HOVER}
            onClick={() => open(syllabusUrl(course.courseId!))}
          >
            <Icons.FileText className="size-3.5" />
          </IconButton>
        </Tooltip>
      ) : (
        <span />
      )}
      {menu ? (
        // The rows most likely to need a correction keep theirs in view.
        <Menu
          label={t("curriculum.fix.menu", { code: course.code })}
          items={menu}
          trigger={{ className: course.status === "unlisted" || course.fix ? undefined : ON_HOVER }}
        />
      ) : (
        <span />
      )}
    </li>
  );
}

/** "Counted as…": the passed courses that could stand in for a required one, SIX's own suggestion first. */
function PickStandIn({ record, course, onPick, onClose }: { record: StudentRecord; course: MapCourse; onPick: (code: string) => void; onClose: () => void }) {
  const t = useT();
  const all = standIns(record, course.code);
  const semester = record.required.get(course.code)?.semester;
  const suggested = all.filter((c) => c.suggested);
  const rest = all.filter((c) => !c.suggested);
  const group = (title: string, list: StandIn[]) =>
    list.length > 0 && (
      <section className="mt-4 first:mt-0">
        <h3 className="px-1 pb-1 text-caption font-medium text-muted">{title}</h3>
        <ul>
          {list.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => onPick(c.code)}
                className="focus-ring grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors duration-150 hover:bg-hover"
              >
                <span className="text-small font-semibold tabular-nums">{c.code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-body">{c.name}</span>
                  {c.fills && <span className="block truncate text-caption text-muted">{t("curriculum.pick.fills", { code: c.fills })}</span>}
                </span>
                <Meta align="end" className="text-small text-muted tabular-nums">
                  {c.grade}
                  {`${c.sks} SKS`}
                </Meta>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("curriculum.pick.title", { code: course.code, name: course.name })}>
      <p className="mb-4 text-small text-muted">{t("curriculum.pick.body")}</p>
      {all.length === 0 && <p className="py-6 text-center text-small text-muted">{t("curriculum.pick.none")}</p>}
      {semester !== undefined && group(t("curriculum.pick.suggested", { n: semester }), suggested)}
      {group(t("curriculum.pick.others"), rest)}
    </Dialog>
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
              <span className="min-w-0 flex-1">
                <span className="block text-small font-semibold">{p.name}</span>
                {(p.program || p.registered) && (
                  <Meta className="text-caption text-muted">
                    {p.program && <span className="truncate">{p.program}</span>}
                    {p.registered && (
                      <span className={p.notContinuing ? undefined : "font-medium text-info-fg"}>
                        {t(p.notContinuing ? "curriculum.notContinuing" : "curriculum.registered")}
                      </span>
                    )}
                  </Meta>
                )}
              </span>
              <span className="shrink-0 text-small font-semibold tabular-nums">{t("curriculum.packageSks", { have: p.have, need: p.sks })}</span>
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
                  <PackageMark status={c.status} whatIf={c.whatIf} />
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
function PackageMark({ status, whatIf }: { status: SlotStatus; whatIf: MapCourse["whatIf"] }) {
  const t = useT();
  if (whatIf) return <span className="shrink-0 font-medium text-info-fg">{t(whatIf === "added" ? "planner.whatIfTag" : "planner.droppedTag")}</span>;
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
