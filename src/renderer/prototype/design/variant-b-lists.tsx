// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): Today, All Tasks and
// Upcoming, plus the rows they share. Every row uses the same columns —
// time/date | mark | what | where/when — so a page reads as one timeline.
import { Fragment, type ReactNode } from "react";
import type { ClassSession, PresenceWindow, Task } from "./data";
import { Icons } from "./icons";
import { useVB } from "./variant-b-context";
import { isOpen, isSpecial, ms, tidy } from "./variant-b-model";
import { Page } from "./variant-b-shell";
import {
  Button,
  CalendarGlyph,
  ChecklistGlyph,
  Dot,
  EmptyRow,
  LogbookGlyph,
  More,
  Mark,
  Pill,
  STATUS_LABEL,
  Section,
  StarGlyph,
  StatusCircle,
  cx,
  hairline,
  ink,
  leadCol,
  rowBase,
} from "./variant-b-ui";

/* ── Rows ──────────────────────────────────────────────────────────────── */

export function TaskRow({
  task,
  lead,
  trail,
  withCourse = true,
}: {
  task: Task;
  lead?: ReactNode;
  trail?: ReactNode;
  withCourse?: boolean;
}) {
  const { p, m, nav } = useVB();
  const { t } = p;
  const settled = !isOpen(task.status);
  return (
    <button type="button" onClick={() => nav.task(task.id)} className={cx(rowBase, "items-start py-2")}>
      {lead !== undefined && (
        <span className={cx(leadCol, task.status === "overdue" ? ink.red : ink.secondary)}>{lead}</span>
      )}
      <Mark>
        <StatusCircle status={task.status} label={t(STATUS_LABEL[task.status])} />
      </Mark>
      <span className="min-w-0 flex-1">
        <span className={cx("block text-[14px] leading-5", settled ? ink.secondary : ink.primary)}>
          {tidy(task.title)}
        </span>
        {withCourse && (
          <span className={cx("mt-[3px] flex items-center gap-1.5 text-[12.5px] leading-4", ink.secondary)}>
            <Dot color={m.color(task.courseCode)} className="size-[7px]" />
            <span className="min-w-0">{m.courseName(task.courseCode, task.courseName)}</span>
            {task.files.length > 0 && (
              <span className="ml-1 flex items-center gap-0.5" aria-label={t("lecturer_files")}>
                <Icons.Paperclip className="size-3" />
                {task.files.length}
              </span>
            )}
          </span>
        )}
      </span>
      {trail != null && (
        <span
          className={cx(
            "shrink-0 pl-3 text-right text-[13px] leading-5 tabular-nums",
            task.status === "overdue" ? ink.red : ink.secondary,
          )}
        >
          {trail}
        </span>
      )}
    </button>
  );
}

export function ClassRow({
  session,
  lead,
  label,
  trail,
}: {
  session: ClassSession;
  lead: ReactNode;
  /** What to call the row; defaults to the course name. */
  label?: ReactNode;
  /** Right-hand column; defaults to the room. */
  trail?: ReactNode;
}) {
  const { p, m, nav } = useVB();
  const { t } = p;
  const phase = m.phase(session);
  const room = session.room.trim();
  return (
    <button
      type="button"
      onClick={() => nav.course(session.courseCode)}
      className={cx(rowBase, "items-center py-2", phase === "past" && "opacity-50")}
    >
      <span className={cx(leadCol, phase === "now" ? cx("font-semibold", ink.primary) : ink.secondary)}>{lead}</span>
      <Mark>
        <Dot color={m.color(session.courseCode)} />
      </Mark>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 text-[14px] leading-5">{label ?? m.courseName(session.courseCode, session.courseName)}</span>
        {isSpecial(session.activity) && <Pill tone="orange">{session.activity}</Pill>}
        {phase === "now" && <Pill tone="yellow">{t("now")}</Pill>}
      </span>
      <span className={cx("shrink-0 pl-3 text-right text-[13px] leading-5 tabular-nums", ink.secondary)}>
        {trail ?? (room || (m.online(session.courseCode) ? t("online_class") : <span aria-label={t("room")}>—</span>))}
      </span>
    </button>
  );
}

/** Two-line right column that lines up with a two-line row (title + course). */
export function Stack({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className="flex flex-col items-end">
      <span>{top}</span>
      <span className="mt-[3px] text-[12px] leading-4">{bottom}</span>
    </span>
  );
}

/** The open Presence window: view-only here — the action lives on EduNex. */
export function PresenceNow({ w, withCourse = true }: { w: PresenceWindow; withCourse?: boolean }) {
  const { p, m } = useVB();
  const { t, f, now } = p;
  const total = ms(w.closesAt) - ms(w.opensAt);
  const left = Math.max(0, ms(w.closesAt) - now.getTime());
  const remaining = total > 0 ? left / total : 0;
  return (
    <div
      className={cx(
        "rounded-[14px] px-4 pb-3.5 pt-3.5 ring-1 ring-inset",
        "bg-[#FFF8DA] ring-[#F5C400]/45 dark:bg-[#F5C400]/[0.075] dark:ring-[#F5C400]/[0.22]",
      )}
    >
      <div className="flex items-center gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F5C400] text-[#3B2E00] shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">
          <Icons.Hand className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-5">
            {withCourse ? m.courseName(w.courseCode, w.courseName) : t("presence_open")}
          </div>
          <div className={cx("mt-px text-[13px] leading-[18px]", ink.secondary)}>
            {withCourse && `${t("presence_open")} · `}
            {f.timeRange(w.opensAt, w.closesAt)}
            {w.topic.trim() && ` · ${w.topic.trim()}`}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cx("text-[11.5px] leading-4", ink.secondary)}>{t("closes_in")}</div>
          <div className="text-[17px] font-semibold leading-[22px] tracking-[-0.01em] tabular-nums">
            {f.countdown(w.closesAt)}
          </div>
        </div>
        <Button
          kind="secondary"
          className="ml-1.5"
          // Production: open the official Presence page on EduNex (shell.openExternal).
          onClick={() => undefined}
        >
          {t("open_in_edunex")}
          <Icons.ArrowUpRight className="size-3.5" strokeWidth={2} />
        </Button>
      </div>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[#F5C400]/25 dark:bg-[#F5C400]/15">
        <div
          className="h-full rounded-full bg-[#F5C400] motion-safe:transition-[width] motion-safe:duration-700"
          style={{ width: `${remaining * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Things' Upcoming day header: big date number, weekday, quiet distance on the right. */
function DayHeader({ iso, className = "mt-8" }: { iso: string; className?: string }) {
  const { p, m } = useVB();
  const { t, f } = p;
  const offset = f.dayOffset(iso);
  const name = offset === 0 ? t("today") : offset === 1 ? t("tomorrow") : f.weekday(iso);
  return (
    <div className={cx("flex items-baseline gap-2.5 border-t pt-2", hairline, className)}>
      <span className="text-[26px] font-bold leading-[30px] tracking-[-0.02em] tabular-nums">{m.dayNumber(iso)}</span>
      <span className={cx("text-[14px] font-semibold", ink.secondary)}>{name}</span>
      {offset > 1 && <span className={cx("ml-auto text-[12.5px]", ink.secondary)}>{f.fromNow(iso)}</span>}
    </div>
  );
}

function MonthHeader({ iso }: { iso: string }) {
  const { m } = useVB();
  return <h2 className="mt-12 text-[22px] font-bold leading-7 tracking-[-0.02em]">{m.month(iso)}</h2>;
}

/** A deadline among classes: flagged so it doesn't read as a lecture. */
function DueFlag() {
  const { p } = useVB();
  return (
    <span className="inline-flex items-center gap-1">
      <More.Flag className="size-3" />
      {p.t("due")}
    </span>
  );
}

/* ── Today ─────────────────────────────────────────────────────────────── */

export function TodayScreen() {
  const { p, m } = useVB();
  const { t, tr, f, now } = p;
  const classes = m.sessionsOn(0);
  return (
    <Page glyph={<StarGlyph className="size-[27px]" />} title={t("today")} subtitle={f.dateLong(now.toISOString())}>
      {m.presenceOpen && (
        <Section title={t("now")} className="mt-7">
          <div className="pt-2">
            <PresenceNow w={m.presenceOpen} />
          </div>
        </Section>
      )}

      <Section title={tr({ en: "Classes", id: "Kuliah" })} aside="SIX">
        {classes.length === 0 ? (
          <EmptyRow>{t("no_classes_today")}</EmptyRow>
        ) : (
          <ul>
            {classes.map((s) => (
              <li key={s.id}>
                <ClassRow session={s} lead={f.timeRange(s.start, s.end)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("due")} aside="EduNex">
        {m.dueToday.length === 0 ? (
          <EmptyRow icon={<StatusCircle status="submitted" label="" size={16} />}>{t("all_caught_up")}</EmptyRow>
        ) : (
          <ul>
            {m.dueToday.map((task) => {
              const due = task.dueAt as string;
              const late = task.status === "overdue";
              return (
                <li key={task.id}>
                  <TaskRow
                    task={task}
                    lead={late ? f.relativeDay(due) : f.time(due)}
                    trail={isOpen(task.status) ? f.fromNow(due) : t(STATUS_LABEL[task.status])}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {m.comingUp.length > 0 && (
        <Section title={tr({ en: "Coming up", id: "Akan datang" })}>
          <ul>
            {m.comingUp.map((item) => (
              <li key={`${item.kind}-${item.kind === "task" ? item.task.id : item.session.id}`}>
                {item.kind === "task" ? (
                  <TaskRow
                    task={item.task}
                    lead={f.relativeDay(item.iso)}
                    trail={<Stack top={f.time(item.iso)} bottom={f.fromNow(item.iso)} />}
                  />
                ) : (
                  <ClassRow
                    session={item.session}
                    lead={f.relativeDay(item.iso)}
                    trail={[f.time(item.session.start), item.session.room.trim()].filter(Boolean).join(" · ")}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

/* ── All Tasks (Things "Upcoming" look + a logbook) ─────────────────────── */

export function TasksScreen() {
  const { view } = useVB();
  return view === "upcoming" ? <UpcomingList /> : <AllTasks />;
}

function AllTasks() {
  const { p, m } = useVB();
  const { t, tr, f, now } = p;
  const dated = m.pending.filter((task) => task.dueAt !== null);
  const undated = m.pending.filter((task) => task.dueAt === null);
  const days = dated.reduce<{ key: string; iso: string; items: Task[] }[]>((acc, task) => {
    const key = f.dayKey(task.dueAt as string);
    const last = acc[acc.length - 1];
    if (last && last.key === key) last.items.push(task);
    else acc.push({ key, iso: task.dueAt as string, items: [task] });
    return acc;
  }, []);
  let month = m.monthKey(now.toISOString());
  const summary = tr({
    en: `${m.open.length} to hand in · ${m.logbook.length} submitted`,
    id: `${m.open.length} belum dikumpulkan · ${m.logbook.length} terkumpul`,
  });

  return (
    <Page glyph={<ChecklistGlyph className="size-[27px]" />} title={tr({ en: "All Tasks", id: "Semua tugas" })} subtitle={summary}>
      {m.overdue.length > 0 && (
        <section className="mt-8">
          <div className={cx("flex items-baseline gap-2.5 border-t pt-2", hairline)}>
            <span className={cx("text-[20px] font-bold leading-[32px] tracking-[-0.015em]", ink.red)}>
              {t("status_overdue")}
            </span>
          </div>
          <ul className="mt-1">
            {m.overdue.map((task) => (
              <li key={task.id}>
                <TaskRow task={task} trail={task.dueAt ? f.fromNow(task.dueAt) : null} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {m.open.length === 0 && (
        <div className="mt-8">
          <EmptyRow icon={<StatusCircle status="submitted" label="" size={16} />}>{t("all_caught_up")}</EmptyRow>
        </div>
      )}

      {days.map((day, i) => {
        const key = m.monthKey(day.iso);
        const newMonth = key !== month;
        month = key;
        return (
          <Fragment key={day.key}>
            {newMonth && <MonthHeader iso={day.iso} />}
            <section>
              <DayHeader iso={day.iso} className={newMonth ? "mt-4" : i === 0 && m.overdue.length === 0 ? "mt-7" : "mt-6"} />
              <ul className="mt-1">
                {day.items.map((task) => (
                  <li key={task.id}>
                    <TaskRow task={task} trail={f.time(task.dueAt as string)} />
                  </li>
                ))}
              </ul>
            </section>
          </Fragment>
        );
      })}

      {undated.length > 0 && (
        <Section title={tr({ en: "No due date", id: "Tanpa tenggat" })}>
          <ul>
            {undated.map((task) => (
              <li key={task.id}>
                <TaskRow task={task} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {m.logbook.length > 0 && (
        <section className="mt-16">
          <div className={cx("flex items-center gap-2.5 border-b pb-2", hairline)}>
            <LogbookGlyph className="size-[22px]" />
            <h2 className="flex-1 text-[20px] font-bold leading-7 tracking-[-0.015em]">{t("status_submitted")}</h2>
          </div>
          <ul className="mt-1">
            {m.logbook.map((task) => (
              <li key={task.id}>
                <TaskRow
                  task={task}
                  lead={<span className={ink.blue}>{f.dayMonth(task.submittedAt ?? (task.dueAt as string))}</span>}
                  trail={task.status === "in_review" ? t("status_in_review") : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {m.closed.length > 0 && (
        <Section title={t("status_closed")} className="mt-12">
          <ul>
            {m.closed.map((task) => (
              <li key={task.id}>
                <TaskRow task={task} lead={task.dueAt ? f.dayMonth(task.dueAt) : ""} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

/* ── Upcoming: SIX classes and EduNex deadlines, day by day ─────────────── */

function UpcomingList() {
  const { p, m } = useVB();
  const { tr, f, now } = p;
  let month = m.monthKey(now.toISOString());
  return (
    <Page glyph={<CalendarGlyph className="size-[27px]" />} title={tr({ en: "Upcoming", id: "Mendatang" })}>
      {m.agenda.map((day, i) => {
        const key = m.monthKey(day.iso);
        const newMonth = key !== month;
        month = key;
        return (
          <Fragment key={day.key}>
            {newMonth && <MonthHeader iso={day.iso} />}
            <section>
              <DayHeader iso={day.iso} className={newMonth ? "mt-4" : i === 0 ? "mt-7" : "mt-6"} />
              <ul className="mt-1">
                {day.items.map((item) => (
                  <li key={`${item.kind}-${item.kind === "task" ? item.task.id : item.session.id}`}>
                    {item.kind === "task" ? (
                      <TaskRow task={item.task} lead={f.time(item.iso)} trail={<DueFlag />} />
                    ) : (
                      <ClassRow session={item.session} lead={f.timeRange(item.session.start, item.session.end)} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </Fragment>
        );
      })}
    </Page>
  );
}
