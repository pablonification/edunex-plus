// PROTOTYPE (#83) — throwaway. Variant C — "Spaces" (Arc-inspired).
// Every course is a space with its own color; the window frame takes the
// active space's tint and the content sits in one inset rounded panel.
// Home is a bento of what matters now. Shell lives here; screens live in
// variant-c-*.tsx.
import { useEffect, useMemo, type ReactNode } from "react";
import { TrafficLights } from "./chrome";
import { Icons } from "./icons";
import type { Course } from "./data";
import type { VariantModule, VariantProps } from "./variant-props";
import {
  FOCUS,
  HOME_TINT,
  INK,
  VcStyles,
  WASH_STRONG,
  buildModel,
  cx,
  heroGradient,
  initials,
  splitCode,
  withColor,
  type Model,
} from "./variant-c-ui";
import { TodayScreen } from "./variant-c-today";
import { BoardScreen, TaskSheet } from "./variant-c-tasks";
import { CourseScreen } from "./variant-c-course";
import { SignInScreen } from "./variant-c-signin";

type Active = { kind: "home" } | { kind: "tasks" } | { kind: "course"; code: string };

function Spaces(p: VariantProps) {
  const m = useMemo(() => buildModel(p.data, p.now, p.f), [p.data, p.now, p.f]);

  if (p.screen === "signin") return <SignInScreen p={p} />;

  const active: Active =
    p.screen === "course"
      ? { kind: "course", code: p.course.code }
      : p.screen === "today"
        ? { kind: "home" }
        : { kind: "tasks" };
  const tint = active.kind === "course" ? p.course.color : HOME_TINT;

  return (
    <div
      className="vc-root relative h-screen w-screen overflow-hidden text-zinc-900 antialiased dark:text-zinc-50"
      style={{ ["--space" as string]: tint }}
    >
      <VcStyles />
      {/* Frame: the space's tint, with a soft glow from the top-left like Arc. */}
      <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--space)_11%,#EBECF0)] transition-colors duration-300 ease-out dark:bg-[color-mix(in_oklab,var(--space)_9%,#0B0C0F)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-90 transition-opacity duration-300 dark:opacity-100"
        style={{
          background:
            "radial-gradient(520px 420px at 0% 0%, color-mix(in oklab, var(--space) 20%, transparent), transparent 70%), radial-gradient(640px 360px at 100% 100%, color-mix(in oklab, var(--space) 10%, transparent), transparent 70%)",
        }}
      />
      <TrafficLights />
      <div className="vc-drag absolute inset-x-0 top-0 h-[52px]" aria-hidden />
      <Rail p={p} m={m} active={active} />
      <TopBar p={p} m={m} />
      <main className="absolute top-[52px] right-2 bottom-2 left-[72px] z-10 overflow-hidden rounded-[18px] bg-[color-mix(in_oklab,var(--space)_3%,#F6F6F8)] shadow-[0_1px_3px_rgba(15,20,35,0.07),0_16px_44px_-22px_rgba(15,20,35,0.3)] ring-1 ring-zinc-900/[0.07] dark:bg-[color-mix(in_oklab,var(--space)_4%,#111317)] dark:shadow-[0_18px_48px_-20px_rgba(0,0,0,0.8)] dark:ring-white/[0.07]">
        <Screen p={p} m={m} />
      </main>
    </div>
  );
}

function Screen({ p, m }: { p: VariantProps; m: Model }) {
  switch (p.screen) {
    case "today":
      return <TodayScreen p={p} m={m} />;
    case "tasks":
      return <BoardScreen p={p} m={m} />;
    case "task":
      return (
        <>
          <BoardScreen p={p} m={m} inert />
          <TaskSheet key={`${p.task.id}-${p.task.status}`} p={p} m={m} />
        </>
      );
    case "course":
      return <CourseScreen key={p.course.code} p={p} m={m} />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------- rail */

function Rail({ p, m, active }: { p: VariantProps; m: Model; active: Active }) {
  const { t, tr, go, data } = p;
  const liveCode = m.openPresence?.courseCode;
  return (
    <nav
      aria-label={tr({ en: "Spaces", id: "Ruang" })}
      className="absolute top-[52px] bottom-0 left-0 z-20 flex w-[72px] flex-col items-center pt-2 pb-3"
    >
      <RailButton
        label={tr({ en: "Home", id: "Beranda" })}
        active={active.kind === "home"}
        onClick={() => go("today")}
        icon={<Icons.Home className="size-[19px]" strokeWidth={1.9} />}
      />
      <RailButton
        label={t("tasks")}
        active={active.kind === "tasks"}
        onClick={() => go("tasks")}
        badge={m.openTasks.length}
        icon={<Icons.ListChecks className="size-[19px]" strokeWidth={1.9} />}
      />
      <div className="my-2.5 h-px w-7 shrink-0 bg-zinc-900/10 dark:bg-white/10" aria-hidden />
      <ul className="flex flex-col items-center gap-2.5">
        {m.courses.map((c) => (
          <li key={c.code}>
            <SpaceTile
              course={c}
              active={active.kind === "course" && active.code === c.code}
              live={c.code === liveCode}
              liveLabel={t("presence_open")}
              onClick={() => go("course", { course: c.code })}
            />
          </li>
        ))}
      </ul>
      <div className="flex-1" />
      <button
        type="button"
        aria-label={`${data.student.name} · ${t("synced")}`}
        className={cx(
          "group relative grid size-9 place-items-center rounded-full text-[12px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(47,107,240,0.6)] transition duration-200 ease-out motion-safe:hover:scale-[1.04]",
          FOCUS,
        )}
        style={{ backgroundImage: "linear-gradient(140deg, #5B8CFF 0%, #2F6BF0 45%, #7C5CFC 100%)" }}
      >
        <span className="vc-display">{initials(data.student.name)}</span>
        <span
          className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-[#2DBE60] ring-[2.5px] ring-[color-mix(in_oklab,var(--space)_11%,#EBECF0)] dark:bg-[#30D158] dark:ring-[color-mix(in_oklab,var(--space)_9%,#0B0C0F)]"
          aria-hidden
        />
        <Tooltip>
          {data.student.name}
          <span className="block text-[11px] font-normal text-white/65">
            EduNex · SIX — {t("synced")} {p.f.time(data.sources.six.updatedAt)}
          </span>
        </Tooltip>
      </button>
    </nav>
  );
}

function RailButton({
  label,
  active,
  onClick,
  icon,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx("group flex w-[64px] flex-col items-center gap-[3px] rounded-[12px] pt-1 pb-1.5", FOCUS)}
    >
      <span
        className={cx(
          "relative grid size-10 place-items-center rounded-[13px] transition duration-200 ease-out",
          active
            ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,20,35,0.08),0_6px_14px_-6px_rgba(15,20,35,0.25)] ring-1 ring-zinc-900/[0.06] dark:bg-white/[0.12] dark:text-white dark:ring-white/10"
            : "text-zinc-600 group-hover:bg-zinc-900/[0.06] group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:bg-white/[0.07] dark:group-hover:text-white",
        )}
      >
        {icon}
        {badge ? (
          <span className="vc-num absolute -top-1 -right-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-zinc-900 px-1 text-[10px] font-bold text-white ring-2 ring-[color-mix(in_oklab,var(--space)_11%,#EBECF0)] dark:bg-white dark:text-zinc-900 dark:ring-[color-mix(in_oklab,var(--space)_9%,#0B0C0F)]">
            {badge}
          </span>
        ) : null}
      </span>
      <span
        className={cx(
          "max-w-full truncate text-[10.5px] font-semibold tracking-[0.01em]",
          active ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function SpaceTile({
  course,
  active,
  live,
  liveLabel,
  onClick,
}: {
  course: Course;
  active: boolean;
  live: boolean;
  liveLabel: string;
  onClick: () => void;
}) {
  const [letters, digits] = splitCode(course.code);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={`${course.code} · ${course.name}${live ? ` · ${liveLabel}` : ""}`}
      style={withColor(course.color)}
      className={cx("group relative block rounded-[14px]", FOCUS)}
    >
      {/* Arc-like edge marker for the active space */}
      <span
        aria-hidden
        className={cx(
          "absolute top-1/2 -left-[14px] w-[4px] -translate-y-1/2 rounded-r-full bg-(--c) transition-all duration-200 ease-out",
          active ? "h-6 opacity-100" : "h-2 opacity-0 group-hover:opacity-60",
        )}
      />
      <span
        className={cx(
          "flex size-11 flex-col items-center justify-center rounded-[14px] leading-none transition duration-200 ease-out motion-safe:group-active:scale-95",
          active
            ? "text-white shadow-[0_8px_18px_-8px_var(--c)] ring-1 ring-black/10 ring-inset"
            : cx(WASH_STRONG, INK, "group-hover:bg-[color-mix(in_oklab,var(--c)_26%,transparent)] motion-safe:group-hover:-translate-y-px dark:group-hover:bg-[color-mix(in_oklab,var(--c)_36%,transparent)]"),
        )}
        style={active ? { backgroundImage: heroGradient(150) } : undefined}
      >
        <span className="vc-display text-[13.5px] font-bold">{letters}</span>
        <span className="vc-num mt-[3px] text-[9.5px] font-semibold opacity-80">{digits}</span>
      </span>
      {live && (
        <span className="absolute -top-1 -right-1 grid size-3.5 place-items-center" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-[#2DBE60] motion-safe:animate-[vc-breathe_2.4s_ease-out_infinite]" />
          <span className="relative size-3 rounded-full bg-[#2DBE60] ring-[2.5px] ring-[color-mix(in_oklab,var(--space)_11%,#EBECF0)] dark:bg-[#30D158] dark:ring-[color-mix(in_oklab,var(--space)_9%,#0B0C0F)]" />
        </span>
      )}
      <Tooltip>
        <span className="vc-num text-white/65">{course.code}</span> {course.name}
        {live && <span className="mt-0.5 block text-[11px] font-semibold text-[#7EE2A0]">● {liveLabel}</span>}
      </Tooltip>
    </button>
  );
}

function Tooltip({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute top-1/2 left-[calc(100%+14px)] z-50 w-max max-w-[260px] -translate-y-1/2 rounded-[10px] bg-zinc-900/95 px-2.5 py-1.5 text-left text-[12px] leading-snug font-medium text-white opacity-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] transition duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:translate-x-[-4px] motion-safe:group-hover:translate-x-0 dark:bg-zinc-800 dark:ring-1 dark:ring-white/10"
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- top bar */

function TopBar({ p, m }: { p: VariantProps; m: Model }) {
  const { t, tr, f, data } = p;
  const synced = f.time(data.sources.edunex.updatedAt);

  // ⌘K focuses search (the palette itself is out of scope for the prototype).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("vc-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="pointer-events-none absolute top-0 right-2 left-[72px] z-20 grid h-[52px] grid-cols-[1fr_minmax(240px,420px)_1fr] items-center gap-4">
      <div />
      <button
        id="vc-search"
        type="button"
        aria-keyshortcuts="Meta+K"
        className={cx(
          "vc-no-drag pointer-events-auto flex h-8 w-full items-center gap-2 rounded-[10px] bg-white/65 px-2.5 text-[13px] text-zinc-500 shadow-[0_1px_2px_rgba(15,20,35,0.05)] ring-1 ring-zinc-900/[0.07] backdrop-blur-md transition duration-150 ease-out hover:bg-white/90 hover:text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-400 dark:ring-white/[0.08] dark:hover:bg-white/[0.09] dark:hover:text-zinc-300",
          FOCUS,
        )}
      >
        <Icons.Search className="size-[15px] shrink-0" strokeWidth={2} />
        <span className="min-w-0 flex-1 truncate text-left">
          {tr({ en: "Search tasks, courses, files", id: "Cari tugas, mata kuliah, berkas" })}
        </span>
        <kbd className="shrink-0 rounded-[6px] bg-zinc-900/[0.05] px-1.5 py-[1px] font-sans text-[11px] font-semibold text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400">
          ⌘K
        </kbd>
      </button>
      <div className="flex items-center justify-end gap-1">
        <div
          className="vc-no-drag pointer-events-auto flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium text-zinc-600 dark:text-zinc-400"
          title={tr({
            en: `EduNex and SIX synced at ${synced}`,
            id: `EduNex dan SIX tersinkron pukul ${synced}`,
          })}
        >
          <span className="relative grid size-2 place-items-center" aria-hidden>
            <span className="size-2 rounded-full bg-[#2DBE60] dark:bg-[#30D158]" />
          </span>
          <span>EduNex · SIX</span>
          <span className="vc-num text-zinc-500 dark:text-zinc-500">{synced}</span>
          <span className="sr-only">{t("synced")}</span>
        </div>
        <button
          type="button"
          aria-label={`${tr({ en: "Notifications", id: "Notifikasi" })} (${m.unreadCount})`}
          className={cx(
            "vc-no-drag pointer-events-auto relative grid size-8 place-items-center rounded-[10px] text-zinc-600 transition duration-150 ease-out hover:bg-zinc-900/[0.06] hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-white",
            FOCUS,
          )}
        >
          <Icons.Bell className="size-[18px]" strokeWidth={1.9} />
          {m.unreadCount > 0 && (
            <span className="vc-num absolute -top-0.5 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#FF3B30] px-1 text-[10px] leading-none font-bold text-white ring-2 ring-[color-mix(in_oklab,var(--space)_11%,#EBECF0)] dark:bg-[#FF453A] dark:ring-[color-mix(in_oklab,var(--space)_9%,#0B0C0F)]">
              {m.unreadCount > 99 ? "99+" : m.unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export const VariantC: VariantModule = { key: "C", name: "Spaces", Component: Spaces };
