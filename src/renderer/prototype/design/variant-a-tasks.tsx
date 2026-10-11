// PROTOTYPE (#83) — throwaway. Variant A "Calendar": Tasks as a calm agenda —
// grouped by due day with calendar date tiles, submitted work folded away.
import { useMemo, useState } from "react";
import type { Task } from "./data";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import {
  accentText,
  byDue,
  courseColor,
  courseMap,
  courseName,
  focusRing,
  hairline,
  ink,
  isDone,
  STATUS_INK,
  STATUS_LABEL,
  STATUS_SOFT,
  StatusGlyph,
  Swatch,
} from "./variant-a-kit";

/** Beyond this many days, deadlines fold into "Later". */
const DATED_DAYS = 14;

type Group =
  | { id: string; kind: "overdue"; tasks: Task[] }
  | { id: string; kind: "day"; iso: string; tasks: Task[] }
  | { id: string; kind: "later"; tasks: Task[] };

export function TasksScreen(props: VariantProps) {
  const { data, f, t, tr } = props;
  const [showDone, setShowDone] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const { groups, open, done, closed } = useMemo(() => {
    const open = data.tasks.filter((task) => !isDone(task.status) && task.status !== "closed").sort(byDue);
    const done = data.tasks.filter((task) => isDone(task.status)).sort((a, b) => byDue(b, a));
    const closed = data.tasks.filter((task) => task.status === "closed").sort((a, b) => byDue(b, a));
    const groups: Group[] = [];
    const overdue = open.filter((task) => task.status === "overdue");
    if (overdue.length) groups.push({ id: "overdue", kind: "overdue", tasks: overdue });
    const later: Task[] = [];
    for (const task of open) {
      if (task.status === "overdue") continue;
      if (!task.dueAt || f.dayOffset(task.dueAt) > DATED_DAYS) {
        later.push(task);
        continue;
      }
      const id = f.dayKey(task.dueAt);
      const g = groups.find((x) => x.id === id);
      if (g) g.tasks.push(task);
      else groups.push({ id, kind: "day", iso: task.dueAt, tasks: [task] });
    }
    if (later.length) groups.push({ id: "later", kind: "later", tasks: later });
    return { groups, open, done, closed };
  }, [data, f]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2.5 px-6 [-webkit-app-region:drag]">
        <h1 className="text-[15px] font-semibold tracking-[-0.012em]">{t("tasks")}</h1>
        <span className={`text-[13px] tabular-nums ${ink[3]}`}>
          {open.length} {tr({ en: "open", id: "aktif" })}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-8 pt-3 pb-20">
          {groups.length === 0 && (
            <p className={`flex items-center gap-2 py-10 text-[13.5px] ${ink[2]}`}>
              <Icons.CheckCircle className="size-4" />
              {t("all_caught_up")}
            </p>
          )}

          {groups.map((g, i) => (
            <section key={g.id} className={`flex gap-6 py-3 ${i > 0 ? `border-t ${hairline}` : ""}`} aria-label={groupLabel(g, props)}>
              <DateTile group={g} {...props} />
              <ul className="min-w-0 flex-1 space-y-px">
                {g.tasks.map((task) => (
                  <TaskRow key={task.id} {...props} task={task} withDate={g.kind !== "day"} />
                ))}
              </ul>
            </section>
          ))}

          {done.length > 0 && (
            <Folded
              label={t("status_submitted")}
              count={done.length}
              open={showDone}
              onToggle={() => setShowDone((v) => !v)}
              {...props}
              tasks={done}
            />
          )}
          {closed.length > 0 && (
            <Folded
              label={t("status_closed")}
              count={closed.length}
              open={showClosed}
              onToggle={() => setShowClosed((v) => !v)}
              {...props}
              tasks={closed}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function groupLabel(g: Group, { f, t }: VariantProps): string {
  if (g.kind === "overdue") return t("status_overdue");
  if (g.kind === "later") return t("later");
  return f.dateLong(g.iso);
}

function DateTile({ group, lang, f, t }: VariantProps & { group: Group }) {
  if (group.kind !== "day") {
    const overdue = group.kind === "overdue";
    return (
      <div className="w-[68px] shrink-0 pt-[9px]">
        <p className={`text-[13px] font-semibold ${overdue ? STATUS_INK.overdue : ink[1]}`}>
          {overdue ? t("status_overdue") : t("later")}
        </p>
      </div>
    );
  }
  const offset = f.dayOffset(group.iso);
  const month = new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "short", timeZone: "Asia/Jakarta" })
    .format(new Date(group.iso))
    .replace(".", "");
  const day = Number(f.dayKey(group.iso).slice(8));
  const label = offset === 0 ? t("today") : offset === 1 ? t("tomorrow") : f.weekdayShort(group.iso);
  const isToday = offset === 0;
  return (
    <div className="w-[68px] shrink-0 pt-1.5">
      <p className={`text-[11.5px] font-semibold ${isToday ? accentText : ink[3]}`}>{label}</p>
      <p className={`mt-0.5 text-[26px] leading-[28px] font-semibold tracking-[-0.02em] tabular-nums ${isToday ? accentText : ink[1]}`}>
        {day}
      </p>
      <p className={`mt-0.5 text-[11.5px] ${ink[3]}`}>{month}</p>
    </div>
  );
}

function TaskRow({ task, withDate, data, f, t, go }: VariantProps & { task: Task; withDate: boolean }) {
  const courses = courseMap(data);
  const color = courseColor(courses, task.courseCode);
  const done = isDone(task.status);
  const due = task.dueAt;
  const day = (iso: string) => `${f.weekdayShort(iso)} ${f.dayMonth(iso)}`;
  const [line1, line2] = (() => {
    if (done) {
      return [
        task.submittedAt ? `${t("submitted_on")} ${day(task.submittedAt)}` : t(STATUS_LABEL[task.status]),
        due ? `${t("due")} ${day(due)}` : "",
      ];
    }
    if (!due) return ["", ""];
    return [withDate ? `${day(due)}, ${f.time(due)}` : f.time(due), f.fromNow(due)];
  })();
  const flagged = task.status === "draft" || task.status === "overdue" || task.status === "in_review" || task.status === "closed";
  return (
    <li>
      <button
        type="button"
        onClick={() => go("task", { task: task.id })}
        className={`group grid w-full grid-cols-[16px_minmax(0,1fr)_auto_14px] items-start gap-x-3 rounded-[10px] px-3 py-[9px] text-left transition-colors duration-150 hover:bg-black/[0.035] dark:hover:bg-white/[0.045] ${focusRing}`}
      >
        <StatusGlyph status={task.status} className="mt-px size-4" />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-[13.5px] leading-[18px] ${done ? ink[2] : ink[1]}`} title={task.title}>
              {task.title}
            </span>
            {flagged && (
              <span className={`shrink-0 rounded-full px-1.5 text-[10.5px] leading-[16px] font-semibold ${STATUS_SOFT[task.status]} ${STATUS_INK[task.status]}`}>
                {t(STATUS_LABEL[task.status])}
              </span>
            )}
          </span>
          <span className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] leading-[16px] ${ink[3]}`}>
            <Swatch color={color} className="size-2" />
            <span className={`shrink-0 font-medium tabular-nums ${ink[2]}`}>{task.courseCode}</span>
            <span className="truncate">{courseName(courses, task.courseCode, task.courseName)}</span>
          </span>
        </span>
        <span className="pl-4 text-right tabular-nums">
          <span className={`block text-[12.5px] leading-[18px] ${done ? ink[2] : "font-medium"}`}>{line1}</span>
          <span className={`block text-[12px] leading-[16px] ${task.status === "overdue" ? STATUS_INK.overdue : ink[3]}`}>{line2}</span>
        </span>
        <span title={task.fileRequired ? t("file_required") : undefined} className={`mt-0.5 ${ink[3]}`}>
          {task.fileRequired && (
            <>
              <Icons.Paperclip className="size-3.5" />
              <span className="sr-only">{t("file_required")}</span>
            </>
          )}
        </span>
      </button>
    </li>
  );
}

function Folded({
  label,
  count,
  open,
  onToggle,
  tasks,
  ...props
}: VariantProps & { label: string; count: number; open: boolean; onToggle: () => void; tasks: Task[] }) {
  return (
    <section className={`border-t py-2 ${hairline}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-[8px] py-2 pr-3 pl-1 text-[13px] font-medium ${ink[2]} transition-colors duration-150 hover:text-[#1D1D1F] dark:hover:text-white ${focusRing}`}
      >
        <Icons.ChevronRight className={`size-3.5 transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`} strokeWidth={2.25} />
        {label}
        <span className={`tabular-nums ${ink[3]}`}>{count}</span>
      </button>
      {open && (
        <ul className="ml-[92px] space-y-px pb-2 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:starting:opacity-0">
          {tasks.map((task) => (
            <TaskRow key={task.id} {...props} task={task} withDate />
          ))}
        </ul>
      )}
    </section>
  );
}
