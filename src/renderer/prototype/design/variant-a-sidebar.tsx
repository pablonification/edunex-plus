// PROTOTYPE (#83) — throwaway. Variant A "Calendar": the sidebar — mini month
// (today + days with classes / open deadlines), navigation, courses, sync.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { DAY, Ex, focusRing, hairline, ink, isDone, keyIso, keyOf, Swatch } from "./variant-a-kit";

export interface DayNav {
  /** The day the Today timeline shows (WIB day key). */
  day: string;
  onDay: (key: string) => void;
}

export function Sidebar(props: VariantProps & DayNav) {
  const { data, now, f, t, tr, screen, go, course, day, onDay } = props;
  const todayKey = keyOf(now.getTime());
  const [syncing, setSyncing] = useState(false);
  const openTasks = data.tasks.filter((task) => !isDone(task.status) && task.status !== "closed");

  const marks = useMemo(() => {
    const map = new Map<string, { classes: boolean; due: boolean }>();
    const mark = (key: string, kind: "classes" | "due") => {
      const m = map.get(key) ?? { classes: false, due: false };
      m[kind] = true;
      map.set(key, m);
    };
    for (const s of data.sessions) mark(f.dayKey(s.start), "classes");
    for (const task of data.tasks) {
      if (task.dueAt && !isDone(task.status) && task.status !== "closed") mark(f.dayKey(task.dueAt), "due");
    }
    return map;
  }, [data, f]);

  const item = (active: boolean) =>
    `group flex h-[30px] w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] transition-colors duration-150 ease-out ${focusRing} ${
      active
        ? "bg-black/[0.07] font-medium text-[#1D1D1F] dark:bg-white/[0.09] dark:text-white"
        : "text-[#3A3A40] hover:bg-black/[0.04] dark:text-[#D4D4D8] dark:hover:bg-white/[0.05]"
    }`;
  const iconInk = (active: boolean) => (active ? "text-[#2468E0] dark:text-[#6AA6FF]" : ink[3]);

  const sources = [
    { name: "EduNex", at: data.sources.edunex.updatedAt },
    { name: "SIX", at: data.sources.six.updatedAt },
  ];
  const oldest = sources.reduce((a, b) => (a.at < b.at ? a : b)).at;

  return (
    <aside
      className={`relative flex w-[232px] shrink-0 flex-col border-r bg-[#F7F7F8] dark:bg-[#1B1B1D] ${hairline}`}
      aria-label={tr({ en: "Sidebar", id: "Bilah samping" })}
    >
      {/* Title-bar band: the traffic lights sit here. */}
      <div className="h-[52px] shrink-0 [-webkit-app-region:drag]" />

      <MiniMonth
        {...props}
        todayKey={todayKey}
        selected={screen === "today" ? day : null}
        marks={marks}
        onPick={(key) => {
          onDay(key);
          if (screen !== "today") go("today");
        }}
      />

      <nav className="mt-4 space-y-px px-2.5" aria-label={tr({ en: "Main", id: "Utama" })}>
        <button className={item(screen === "today")} onClick={() => go("today")} aria-current={screen === "today" ? "page" : undefined}>
          <Ex.CalendarDays className={`size-4 ${iconInk(screen === "today")}`} />
          <span className="flex-1">{t("today")}</span>
          <span className={`text-[11.5px] tabular-nums ${ink[3]}`}>{f.weekdayShort(now.toISOString())} {Number(todayKey.slice(8))}</span>
        </button>
        <button
          className={item(screen === "tasks" || screen === "task")}
          onClick={() => go("tasks")}
          aria-current={screen === "tasks" ? "page" : undefined}
        >
          <Icons.ListChecks className={`size-4 ${iconInk(screen === "tasks" || screen === "task")}`} />
          <span className="flex-1">{t("tasks")}</span>
          {openTasks.length > 0 && <span className={`text-[11.5px] tabular-nums ${ink[3]}`}>{openTasks.length}</span>}
        </button>
      </nav>

      <div className="mt-5 px-2.5">
        <h2 className={`px-2.5 pb-1 text-[11.5px] font-semibold ${ink[3]}`}>{t("courses")}</h2>
        <ul className="space-y-px">
          {data.courses.map((c) => {
            const active = screen === "course" && course.code === c.code;
            return (
              <li key={c.code}>
                <button
                  className={item(active)}
                  onClick={() => go("course", { course: c.code })}
                  title={c.name}
                  aria-current={active ? "page" : undefined}
                >
                  <Swatch color={c.color} className="size-[11px]" />
                  <span className="shrink-0 font-medium tabular-nums">{c.code}</span>
                  <span className={`min-w-0 flex-1 truncate text-[12.5px] font-normal ${ink[3]}`}>{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className={`mt-auto flex items-center gap-2 border-t py-2.5 pr-2.5 pl-4 ${hairline}`}>
        <div
          className="min-w-0 flex-1"
          title={sources.map((s) => `${s.name}: ${t("synced")} ${f.dueLabel(s.at)}`).join("\n")}
        >
          <p className={`flex items-center gap-2.5 text-[11.5px] leading-[16px] font-medium ${ink[2]}`}>
            {sources.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#1FA971]" aria-hidden />
                {s.name}
              </span>
            ))}
          </p>
          <p className={`text-[11px] leading-[15px] whitespace-nowrap tabular-nums ${ink[3]}`}>
            {t("synced")} {f.time(oldest)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSyncing(true);
            window.setTimeout(() => setSyncing(false), 1200);
          }}
          aria-label={tr({ en: "Sync now", id: "Sinkronkan sekarang" })}
          title={tr({ en: "Sync now", id: "Sinkronkan sekarang" })}
          className={`grid size-7 place-items-center rounded-[7px] ${ink[3]} transition-colors duration-150 hover:bg-black/[0.05] hover:text-[#1D1D1F] dark:hover:bg-white/[0.07] dark:hover:text-white ${focusRing}`}
        >
          <Icons.RefreshCw className={`size-3.5 ${syncing ? "motion-safe:animate-spin" : ""}`} strokeWidth={2} />
        </button>
      </footer>
    </aside>
  );
}

// ---------------------------------------------------------------- mini month

function MiniMonth({
  lang,
  f,
  tr,
  todayKey,
  selected,
  marks,
  onPick,
}: VariantProps & {
  todayKey: string;
  selected: string | null;
  marks: Map<string, { classes: boolean; due: boolean }>;
  onPick: (key: string) => void;
}) {
  const [month, setMonth] = useState((selected ?? todayKey).slice(0, 7));
  // Follow the timeline when it moves into another month.
  useEffect(() => {
    if (selected) setMonth(selected.slice(0, 7));
  }, [selected]);

  const [y, m] = month.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7; // weeks start on Monday
  const cells = Array.from({ length: 42 }, (_, i) => new Date(first + (i - lead) * DAY).toISOString().slice(0, 10));
  const locale = lang === "id" ? "id-ID" : "en-GB";
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(Date.UTC(2024, 0, 1 + i)),
  );
  const shift = (step: number) => {
    const d = new Date(Date.UTC(y, m - 1 + step, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <section className="px-3" aria-label={title}>
      <div className="flex items-center justify-between pl-2 pr-0.5">
        <h2 className="text-[13px] font-semibold capitalize tracking-[-0.005em]">{title}</h2>
        <div className="flex">
          <MonthButton label={tr({ en: "Previous month", id: "Bulan sebelumnya" })} onClick={() => shift(-1)}>
            <Icons.ChevronLeft className="size-3.5" strokeWidth={2} />
          </MonthButton>
          <MonthButton label={tr({ en: "Next month", id: "Bulan berikutnya" })} onClick={() => shift(1)}>
            <Icons.ChevronRight className="size-3.5" strokeWidth={2} />
          </MonthButton>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-7" role="grid">
        {weekdays.map((w, i) => (
          <span key={i} className={`pb-1 text-center text-[10.5px] font-medium ${ink[3]}`} aria-hidden>
            {w}
          </span>
        ))}
        {cells.map((key) => {
          const inMonth = key.slice(0, 7) === month;
          const isToday = key === todayKey;
          const isSelected = key === selected;
          const mark = marks.get(key);
          const weekend = (() => {
            const d = new Date(`${key}T00:00:00Z`).getUTCDay();
            return d === 0 || d === 6;
          })();
          const numberInk = isToday
            ? "bg-[#2468E0] font-semibold text-white"
            : isSelected
              ? "bg-black/[0.08] font-semibold text-[#1D1D1F] dark:bg-white/[0.14] dark:text-white"
              : inMonth
                ? `${weekend ? ink[2] : "text-[#1D1D1F] dark:text-[#E8E8EA]"} group-hover:bg-black/[0.05] dark:group-hover:bg-white/[0.07]`
                : `${ink[3]} opacity-80 group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.05]`;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              onClick={() => onPick(key)}
              aria-label={f.dateLong(keyIso(key))}
              aria-current={isToday ? "date" : undefined}
              aria-selected={isSelected}
              className={`group flex h-[29px] flex-col items-center rounded-[7px] pt-[2px] ${focusRing}`}
            >
              <span className={`grid size-[22px] place-items-center rounded-full text-[11.5px] tabular-nums transition-colors duration-150 ${numberInk}`}>
                {Number(key.slice(8))}
              </span>
              <span className="mt-px flex h-[3px] gap-[2px]" aria-hidden>
                {mark?.classes && <span className={`size-[3px] rounded-full ${inMonth ? "bg-[#9A9AA0] dark:bg-[#77777D]" : "bg-[#C4C4C8] dark:bg-[#4A4A4F]"}`} />}
                {mark?.due && <span className="size-[3px] rounded-full bg-[#E5484D] dark:bg-[#FF6369]" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-6 place-items-center rounded-[6px] ${ink[3]} transition-colors duration-150 hover:bg-black/[0.05] hover:text-[#1D1D1F] dark:hover:bg-white/[0.07] dark:hover:text-white ${focusRing}`}
    >
      {children}
    </button>
  );
}
