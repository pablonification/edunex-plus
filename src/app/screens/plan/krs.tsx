// Rencana studi tab — KRS: this term's study plan and its approval (#80).
// The plan's steps with their times (and the change round), what the current
// step asks of the Student and ITB's next window for it, the courses with
// class, SKS and the advisor's approval, and classes that overlap on SIX's
// timetable (SIX accepts those and never says so). View only.
import { type KrsStage, type KrsStep, krsNeedsStudent, krsOverlaps, krsStage, krsTimeline, nextKrsWindow, type Overlap, rupiah } from "../../../core/academic";
import type { ClassSession, DatasetName, KrsPlan } from "../../../core/models";
import { useTermCourses } from "../../courses";
import { useFormat, useNow, useT } from "../../i18n";
import { useNav } from "../../nav";
import { useDataset } from "../../store";
import { cx } from "../../ui/cx";
import { Bar, Card, CourseCode, EmptyState, SectionTitle, SourceTag } from "../../ui/display";
import { Icons } from "../../ui/icons";

export const ready = true;

// SIX's timetable is registered by the SIX ticket (#76); read by name until then.
const SIX_SCHEDULE = "six.schedule" as DatasetName;

function useSchedule(): ClassSession[] {
  return (useDataset(SIX_SCHEDULE) as ClassSession[] | undefined) ?? [];
}

/** A KRS step to take now, plus every pair of overlapping classes still to come. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  const plan = useDataset("six.krs");
  const calendar = useDataset("itb.calendar");
  const schedule = useSchedule();
  const now = useNow();
  if (!plan) return null;
  const value =
    (krsNeedsStudent(plan, calendar, now) ? 1 : 0) +
    krsOverlaps(
      plan.courses.map((c) => c.code),
      schedule,
      now,
    ).filter((o) => o.upcoming).length;
  return value > 0 ? { value, tone: "warning" } : null;
}

const STAGE_TONE: Record<KrsStage, { box: string; icon: typeof Icons.Clock }> = {
  send: { box: "bg-warning-bg text-warning-fg", icon: Icons.AlertTriangle },
  advisor: { box: "bg-fill text-muted", icon: Icons.Clock },
  ukt: { box: "bg-warning-bg text-warning-fg", icon: Icons.Wallet },
  official: { box: "bg-info-bg text-info-fg", icon: Icons.Clock },
  done: { box: "bg-success-bg text-success-fg", icon: Icons.ShieldCheck },
};

export function Tab() {
  const t = useT();
  const plan = useDataset("six.krs");
  if (!plan) return <EmptyState icon={<Icons.ClipboardCheck className="size-5" />} title={t("krs.empty")} />;
  const { plan: steps, change } = krsTimeline(plan);
  return (
    <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-8">
      <section>
        <Stage plan={plan} />
        <Timeline title={t("krs.round.plan")} steps={steps} />
        {change && <Timeline title={t("krs.round.change")} steps={change} />}
      </section>
      <Courses plan={plan} />
    </div>
  );
}

function Stage({ plan }: { plan: KrsPlan }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const calendar = useDataset("itb.calendar");
  const stage = krsStage(plan);
  const { box, icon: Icon } = STAGE_TONE[stage];
  const window = nextKrsWindow(plan, calendar, now);
  const day = (iso: string) => f.dayMonth(Date.parse(`${iso}T12:00:00+07:00`));
  return (
    <div>
      <div className="flex items-start gap-3 rounded-xl border border-edge bg-surface px-4 py-3.5">
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", box)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-lead font-semibold">{t(`krs.stage.${stage}`)}</p>
          <p className="text-small text-muted">{t(`krs.stage.${stage}.hint`)}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
            <SourceTag source="six" />
            <span>{f.term(plan.term)}</span>
            {plan.advisor && <span>· {t("krs.advisor", { name: plan.advisor })}</span>}
          </p>
        </div>
      </div>
      {window && (
        <p className={cx("mt-3 flex items-center gap-2 text-small", window.open ? "font-medium text-fg" : "text-muted")}>
          <Icons.CalendarClock className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {window.open
              ? t(`krs.window.${window.kind}.open`, { date: day(window.event.lastDay) })
              : t(`krs.window.${window.kind}.next`, { range: `${day(window.event.firstDay)} – ${day(window.event.lastDay)}` })}
          </span>
          <SourceTag source="itb" />
        </p>
      )}
    </div>
  );
}

function Timeline({ title, steps }: { title: string; steps: KrsStep[] }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-caption font-semibold tracking-[0.04em] text-muted uppercase">{title}</h3>
      <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
        {steps.map((step) => (
          <li key={step.key} className="relative">
            <span
              aria-hidden
              className={cx(
                "absolute top-0.5 -left-[27px] grid size-[13px] place-items-center rounded-full ring-4 ring-canvas",
                step.done ? "bg-live text-white" : "border border-track bg-surface",
              )}
            >
              {step.done && <Icons.Check className="size-2.5" strokeWidth={3.5} />}
            </span>
            <p className={cx("text-body font-medium", !step.done && "text-muted")}>{t(`krs.step.${step.key}`)}</p>
            <p className="text-caption text-muted tabular-nums">
              {step.key === "ukt"
                ? step.done
                  ? step.amount != null
                    ? rupiah(step.amount)
                    : t("bills.status.paid")
                  : t("krs.step.uktUnpaid")
                : step.at !== null
                  ? `${f.weekdayShort(step.at)}, ${f.dayMonth(step.at)} · ${f.time(step.at)}`
                  : t("krs.step.notYet")}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Courses({ plan }: { plan: KrsPlan }) {
  const t = useT();
  const now = useNow();
  const { go } = useNav();
  const term = useTermCourses();
  const schedule = useSchedule();
  const overlaps = krsOverlaps(
    plan.courses.map((c) => c.code),
    schedule,
    now,
  );
  const over = plan.maxSks !== null && plan.sks > plan.maxSks;
  return (
    <section className="min-w-0">
      {overlaps.length > 0 && (
        <ul className="mb-5 space-y-2">
          {overlaps.map((overlap) => (
            <OverlapNote key={overlap.codes.join()} overlap={overlap} />
          ))}
        </ul>
      )}
      <SectionTitle
        aside={
          <span className={cx("text-small font-medium tabular-nums", over ? "text-danger-fg" : "text-muted")}>
            {plan.maxSks !== null ? t("krs.sksOfMax", { sks: plan.sks, max: plan.maxSks }) : t("krs.sks", { sks: plan.sks })}
          </span>
        }
      >
        {t("krs.courses")}
      </SectionTitle>
      {plan.maxSks !== null && (
        <>
          <Bar className="mb-3" value={plan.sks / plan.maxSks} color={over ? "var(--danger-fg)" : "var(--live)"} label={t("krs.sksOfMax", { sks: plan.sks, max: plan.maxSks })} />
          {over && <p className="mb-3 text-small font-medium text-danger-fg">{t("krs.overMax", { max: plan.maxSks })}</p>}
        </>
      )}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {plan.courses.map((course) => {
            const known = term?.find((c) => c.code === course.code);
            const row = (
              <>
                <CourseCode code={course.code} color={known?.color ?? "var(--faint)"} className="text-small" />
                <span className="truncate text-body">{course.name}</span>
                <span className="text-small text-muted tabular-nums">{t("krs.class", { classNo: course.classNo })}</span>
                <span className="text-right text-small font-medium tabular-nums">{t("krs.sks", { sks: course.sks })}</span>
                <span className={cx("inline-flex items-center justify-end gap-1 text-caption font-semibold", course.approved ? "text-success-fg" : "text-warning-fg")}>
                  {course.approved ? <Icons.CheckCircle className="size-3.5" /> : <Icons.Clock className="size-3.5" />}
                  {course.approved ? t("krs.approved") : t("krs.notApproved")}
                </span>
              </>
            );
            const grid = "grid w-full grid-cols-[92px_minmax(0,1fr)_72px_56px_120px] items-center gap-3 px-4 py-3 text-left";
            return (
              <li key={course.code}>
                {known ? (
                  <button
                    type="button"
                    onClick={() => go({ screen: "course", code: course.code })}
                    className={cx(grid, "focus-ring transition-colors duration-150 hover:bg-hover")}
                  >
                    {row}
                  </button>
                ) : (
                  <div className={grid}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

function OverlapNote({ overlap }: { overlap: Overlap }) {
  const t = useT();
  const f = useFormat();
  const when = `${f.weekdayShort(overlap.start)} ${f.dayMonth(overlap.start)}, ${f.timeRange(overlap.start, overlap.end)}`;
  const vars = { a: overlap.codes[0], b: overlap.codes[1], when, count: overlap.count };
  return (
    <li className={cx("flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-small leading-[1.5]", overlap.upcoming ? "bg-danger-bg text-danger-fg" : "bg-fill text-muted")}>
      <Icons.Overlap className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1">{t(overlap.upcoming ? "krs.overlap" : "krs.overlap.past", vars)}</span>
      <SourceTag source="six" />
    </li>
  );
}
