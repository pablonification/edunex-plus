// PROTOTYPE (#83) — throwaway. Floating bar for flipping between design
// variants (← / → keys too), screens, Task status previews, theme and language.
// Not part of any design being evaluated; never rendered in production builds.
import { useEffect } from "react";
import { TASK_STATUSES } from "./data";
import { Icons } from "./icons";
import { SCREENS, setParams, type Params } from "./params";

const SCREEN_LABELS: Record<string, string> = {
  features: "Feature map",
  signin: "Sign-in + first scan",
  today: "Today",
  tasks: "Tasks",
  task: "Task page",
  exam: "Exam prep",
  course: "Course",
  schedule: "Schedule",
  presence: "Presence",
  grades: "Grades",
  academic: "Study plan",
};

export function PrototypeSwitcher({
  params,
  variants,
}: {
  params: Params;
  variants: { key: string; name: string }[];
}) {
  const index = Math.max(0, variants.findIndex((v) => v.key === params.variant));
  const current = variants[index];
  const cycle = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length];
    setParams({ variant: next.key });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  const pill =
    "flex h-7 items-center gap-1 rounded-full px-2.5 text-white/80 transition hover:bg-white/10 hover:text-white";
  const select =
    "h-7 appearance-none rounded-full bg-white/10 px-3 text-white outline-none hover:bg-white/15";

  return (
    <div
      data-prototype-switcher
      className="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-950/92 px-1.5 py-1.5 font-sans text-[12px] font-medium text-white shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur"
    >
      <button className={pill} onClick={() => cycle(-1)} aria-label="Previous variant">
        <Icons.ChevronLeft className="size-3.5" strokeWidth={2.25} />
      </button>
      <span className="min-w-[132px] text-center tabular-nums">
        {current.key} · {current.name}
      </span>
      <button className={pill} onClick={() => cycle(1)} aria-label="Next variant">
        <Icons.ChevronRight className="size-3.5" strokeWidth={2.25} />
      </button>
      <span className="mx-1 h-4 w-px bg-white/15" />
      <select
        className={select}
        value={params.screen}
        onChange={(e) => setParams({ screen: e.target.value as Params["screen"] })}
      >
        {SCREENS.map((s) => (
          <option key={s} value={s}>
            {SCREEN_LABELS[s]}
          </option>
        ))}
      </select>
      {params.screen === "task" && (
        <select
          className={select}
          value={params.status ?? ""}
          onChange={(e) => setParams({ status: (e.target.value || null) as Params["status"] })}
        >
          <option value="">Real status</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      )}
      <span className="mx-1 h-4 w-px bg-white/15" />
      <button
        className={pill}
        onClick={() => setParams({ theme: params.theme === "dark" ? "light" : "dark" })}
        aria-label="Toggle theme"
      >
        {params.theme === "dark" ? <Icons.Moon className="size-3.5" /> : <Icons.Sun className="size-3.5" />}
      </button>
      <button
        className={pill}
        onClick={() => setParams({ lang: params.lang === "id" ? "en" : "id" })}
        aria-label="Toggle language"
      >
        {params.lang === "id" ? "ID" : "EN"}
      </button>
    </div>
  );
}
