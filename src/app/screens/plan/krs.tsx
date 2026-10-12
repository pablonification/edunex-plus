// Rencana studi tab — KRS: this term's study plan and its approval (#80).
// The plan's steps with their times (and the change round), what the current
// step asks of the Student and ITB's next window for it, the courses with
// class, SKS and the advisor's approval, and classes that overlap on SIX's
// timetable (SIX accepts those and never says so). View only.
import { type KrsStage, type KrsStep, krsNeedsStudent, krsOverlaps, krsStage, krsTimeline, nextKrsWindow, type Overlap, rupiah } from "../../../core/academic";
import type { ClassSession, KrsPlan } from "../../../core/models";
import { useTermCourses } from "../../courses";
import { useFormat, useNow, useT } from "../../i18n";
import { useNav } from "../../nav";
import { useDataset } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Bar, Card, CourseCode } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Row, Section } from "../../ui/layout";
import { useTermYears } from "./projection";
import { SixNeeded } from "./six-needed";

export const ready = true;

function useSchedule(): ClassSession[] {
  return useDataset("six.schedule") ?? [];
}

/** A KRS step to take now, plus every pair of overlapping classes still to come. */
/**
 * Amber only for a step the Student must take today (send the KRS). A clash
 * still to come counts in a neutral badge: worth a question to the lecturer,
 * not a deadline.
 */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  const plan = useDataset("six.krs");
  const calendar = useDataset("itb.calendar");
  const schedule = useSchedule();
  const now = useNow();
  if (!plan) return null;
  if (krsNeedsStudent(plan, calendar, now)) return { value: 1, tone: "warning" };
  const value = krsOverlaps(
    plan.courses.map((c) => c.code),
    schedule,
    now,
  ).filter((o) => o.upcoming).length;
  return value > 0 ? { value, tone: "neutral" } : null;
}

/** The stage's icon color, drawn bare before its title the way a Notice draws its icon. */
const STAGE_TONE: Record<KrsStage | "clash", { tone: string; icon: typeof Icons.Clock }> = {
  send: { tone: "text-warning-fg", icon: Icons.AlertTriangle },
  advisor: { tone: "text-muted", icon: Icons.Clock },
  ukt: { tone: "text-warning-fg", icon: Icons.Wallet },
  official: { tone: "text-info-fg", icon: Icons.Clock },
  done: { tone: "text-success-fg", icon: Icons.ShieldCheck },
  clash: { tone: "text-warning-fg", icon: Icons.Overlap },
};

export function Tab(_: { onCalendar?: () => void }) {
  const t = useT();
  const plan = useDataset("six.krs");
  const schedule = useSchedule();
  const now = useNow();
  if (!plan) return <SixNeeded icon={<Icons.ClipboardCheck className="size-5" />} title={t("krs.needSix")} body={t("krs.needSixBody")} />;
  const { plan: steps, change } = krsTimeline(plan);
  const overlaps = krsOverlaps(
    plan.courses.map((c) => c.code),
    schedule,
    now,
  );
  return (
    <div className="@container space-y-8">
      <Stage plan={plan} overlaps={overlaps.filter((o) => o.upcoming)} />
      <div className="grid grid-cols-1 items-start gap-8 @4xl:grid-cols-[minmax(0,1fr)_300px]">
        <Courses plan={plan} overlaps={overlaps} />
        <section>
          <Timeline title={t("krs.round.plan")} steps={steps} />
          {change && <Timeline title={t("krs.round.change")} steps={change} />}
        </section>
      </div>
    </div>
  );
}

/**
 * The plan's one honest status, and the next step. An official KRS with a
 * clash still to come is not "nothing to do": it says so in amber, what to
 * do about it, and where to see it.
 */
function Stage({ plan, overlaps }: { plan: KrsPlan; overlaps: Overlap[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const nav = useNav();
  const termYears = useTermYears();
  const calendar = useDataset("itb.calendar");
  const stage = krsStage(plan);
  const clash = overlaps.length > 0 && (stage === "done" || stage === "official");
  const { tone, icon: Icon } = STAGE_TONE[clash ? "clash" : stage];
  const window = nextKrsWindow(plan, calendar, now);
  const day = (iso: string) => f.dayMonth(Date.parse(`${iso}T12:00:00+07:00`));
  const first = overlaps[0];
  const when = first ? `${f.weekdayShort(first.start)} ${f.dayMonth(first.start)}, ${f.timeRange(first.start, first.end)}` : "";
  return (
    <Card variant="raised" className="px-5 py-4">
      <div className="flex items-start gap-2.5">
        <Icon className={cx("mt-[3px] size-4 shrink-0", tone)} weight="bold" />
        <div className="min-w-0 flex-1">
          <p className={cx("text-title font-semibold", clash && "text-warning-fg")}>
            {clash ? t(stage === "done" ? "krs.stage.clash" : "krs.stage.clashApproved", { count: overlaps.length }) : t(`krs.stage.${stage}`)}
          </p>
          {clash && first ? (
            <>
              <p className="mt-0.5 text-body">{t("krs.overlap", { a: first.codes[0], b: first.codes[1], when, count: first.count })}</p>
              <p className="mt-1 text-small text-muted">
                {window?.kind === "urs"
                  ? t("krs.clash.nextUrs", { a: first.codes[0], b: first.codes[1], range: `${day(window.event.firstDay)}–${day(window.event.lastDay)}` })
                  : t("krs.clash.next", { a: first.codes[0], b: first.codes[1] })}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-small text-muted">{t(`krs.stage.${stage}.hint`)}</p>
          )}
          <p className="mt-2 text-caption text-muted">
            <Meta>
              {termYears(plan.term)}
              {plan.advisor ? t("krs.advisor", { name: plan.advisor }) : ""}
            </Meta>
          </p>
        </div>
        {clash && (
          <Button variant="secondary" onClick={() => nav.go({ screen: "schedule" })}>
            {t("krs.toSchedule")}
            <Icons.ChevronRight className="size-4" />
          </Button>
        )}
      </div>
      {window && (
        <p className={cx("mt-3 flex items-center gap-2 border-t border-line pt-3 text-small", window.open ? "font-medium text-fg" : "text-muted")}>
          <Icons.CalendarClock className="size-3.5 shrink-0" />
          {window.open
            ? t(`krs.window.${window.kind}.open`, { date: day(window.event.lastDay) })
            : t(`krs.window.${window.kind}.next`, { range: `${day(window.event.firstDay)} – ${day(window.event.lastDay)}` })}
        </p>
      )}
    </Card>
  );
}

function Timeline({ title, steps }: { title: string; steps: KrsStep[] }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="mb-7 last:mb-0">
      <h3 className="mb-3 text-small font-semibold">{title}</h3>
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
              {step.done && <Icons.Check className="size-2.5" weight="bold" />}
            </span>
            <p className={cx("text-body font-medium", !step.done && "text-muted")}>{t(`krs.step.${step.key}`)}</p>
            <Meta className="text-caption text-muted tabular-nums">
              {step.key === "ukt"
                ? step.done
                  ? step.amount != null
                    ? rupiah(step.amount)
                    : t("bills.status.paid")
                  : t("krs.step.uktUnpaid")
                : step.at !== null
                  ? [`${f.weekdayShort(step.at)}, ${f.dayMonth(step.at)}`, f.time(step.at)]
                  : t("krs.step.notYet")}
            </Meta>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Courses({ plan, overlaps }: { plan: KrsPlan; overlaps: Overlap[] }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const term = useTermCourses();
  const over = plan.maxSks !== null && plan.sks > plan.maxSks;
  // Say once what every row shares; chips only where a row differs.
  const classes = new Set(plan.courses.map((c) => c.classNo));
  const sameClass = classes.size === 1 ? [...classes][0] : null;
  const allApproved = plan.courses.every((c) => c.approved);
  const clashWith = (code: string) => overlaps.filter((o) => o.upcoming && o.codes.includes(code)).map((o) => o.codes.find((c) => c !== code)!);
  const past = overlaps.filter((o) => !o.upcoming);
  return (
    <Section
      id="krs-courses"
      title={t("krs.courses")}
      action={
        <span className={cx("text-small font-medium tabular-nums", over ? "text-danger-fg" : "text-muted")}>
          {plan.maxSks !== null ? t("krs.sksOfMax", { sks: plan.sks, max: plan.maxSks }) : t("krs.sks", { sks: plan.sks })}
        </span>
      }
      className="min-w-0"
    >
      {plan.maxSks !== null && (
        <>
          <Bar
            className="mb-3"
            value={plan.sks / plan.maxSks}
            color={over ? "var(--danger-fg)" : "var(--meter-success)"}
            label={t("krs.sksOfMax", { sks: plan.sks, max: plan.maxSks })}
          />
          {over && <p className="mb-3 text-small font-medium text-danger-fg">{t("krs.overMax", { max: plan.maxSks })}</p>}
        </>
      )}
      <List label={t("krs.courses")}>
        {plan.courses.map((course, i) => {
          const known = term?.find((c) => c.code === course.code);
          const clashes = clashWith(course.code);
          return (
            <Row
              key={course.code}
              index={i}
              leading={<CourseCode code={course.code} color={known?.color ?? "var(--faint)"} className="w-[76px] text-small" />}
              title={course.name}
              meta={
                clashes.length || !sameClass ? (
                  <Meta>
                    {sameClass ? "" : t("krs.class", { classNo: course.classNo })}
                    {clashes.length ? (
                      <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
                        <Icons.Overlap className="size-3" />
                        {t("krs.clashWith", { code: clashes.join(", ") })}
                      </span>
                    ) : (
                      ""
                    )}
                  </Meta>
                ) : undefined
              }
              trailing={
                <span className="flex items-center gap-3">
                  {!course.approved && (
                    <span className="inline-flex items-center gap-1 text-caption font-semibold text-warning-fg">
                      <Icons.Clock className="size-3.5" />
                      {t("krs.notApproved")}
                    </span>
                  )}
                  <span className="w-[52px] text-right text-small font-medium tabular-nums">{t("krs.sks", { sks: course.sks })}</span>
                </span>
              }
              onClick={known ? () => go({ screen: "course", code: course.code }) : undefined}
            />
          );
        })}
      </List>
      <p className="mt-2 text-caption text-faint">
        <Meta>
          {sameClass ? t("krs.sameClass", { classNo: sameClass }) : ""}
          {allApproved ? t("krs.allApproved") : ""}
          {t("krs.from")}
        </Meta>
      </p>
      {past.map((overlap) => (
        <p key={overlap.codes.join()} className="mt-2 flex items-start gap-2 text-small text-muted">
          <Icons.Overlap className="mt-0.5 size-3.5 shrink-0" />
          {t("krs.overlap.past", {
            a: overlap.codes[0],
            b: overlap.codes[1],
            when: `${f.weekdayShort(overlap.start)} ${f.dayMonth(overlap.start)}, ${f.timeRange(overlap.start, overlap.end)}`,
            count: overlap.count,
          })}
        </p>
      ))}
    </Section>
  );
}
