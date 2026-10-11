// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): the window — a Things-style
// sidebar (smart lists, then courses as projects with progress pies), a 52px
// toolbar band that keeps the traffic lights clear, and the big-title page frame.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { TrafficLights } from "./chrome";
import { Icons } from "./icons";
import { useVB } from "./variant-b-context";
import { CalendarGlyph, ChecklistGlyph, ProgressPie, StarGlyph, cx, focusRing, ink } from "./variant-b-ui";

export function Shell({
  children,
  toolbar,
  title,
  scrollKey,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  /** Shown small in the toolbar once the page's big title scrolls away. */
  title: string;
  /** Changes on navigation: scroll back to the top. */
  scrollKey: string;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [titleGone, setTitleGone] = useState(false);

  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 2);
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    const heading = main.querySelector("[data-vb-title]");
    let observer: IntersectionObserver | null = null;
    if (heading) {
      observer = new IntersectionObserver(([entry]) => setTitleGone(!entry.isIntersecting), {
        root: main,
        rootMargin: "-52px 0px 0px 0px",
      });
      observer.observe(heading);
    } else setTitleGone(false);
    return () => {
      main.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [scrollKey]);

  return (
    <div
      className={cx(
        "relative flex h-screen w-screen overflow-hidden bg-white text-[14px] dark:bg-[#161618]",
        ink.primary,
      )}
    >
      <TrafficLights />
      <Sidebar />
      <main ref={mainRef} className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className={cx(
            "sticky top-0 z-20 flex h-[52px] items-center border-b px-4",
            "transition-[background-color,border-color] duration-200 ease-out",
            scrolled
              ? "border-black/[0.07] bg-white/85 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#161618]/85"
              : "border-transparent",
          )}
        >
          <div
            aria-hidden
            className={cx(
              "pointer-events-none absolute inset-0 flex items-center justify-center px-48",
              "transition-opacity duration-200 ease-out",
              titleGone ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="truncate text-[13px] font-semibold">{title}</span>
          </div>
          <div className="relative flex min-w-0 flex-1 items-center">{toolbar}</div>
        </div>
        {children}
      </main>
    </div>
  );
}

function Sidebar() {
  const { p, m, nav, active } = useVB();
  const { t, tr, data } = p;
  return (
    <aside
      className={cx(
        "relative flex w-[248px] shrink-0 flex-col border-r",
        "border-black/[0.08] bg-gradient-to-b from-[#F6F6F8] to-[#F1F1F4]",
        "dark:border-black/80 dark:from-[#1F1F21] dark:to-[#1C1C1E]",
      )}
    >
      {/* the hidden title bar: the traffic lights sit here */}
      <div className="h-[52px] shrink-0" />
      <nav aria-label="Edunex Plus" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        <ul className="flex flex-col gap-[2px]">
          <SideItem
            glyph={<StarGlyph />}
            label={t("today")}
            count={m.todayCount}
            active={active === "today"}
            onClick={nav.today}
          />
          <SideItem
            glyph={<CalendarGlyph />}
            label={tr({ en: "Upcoming", id: "Mendatang" })}
            active={active === "upcoming"}
            onClick={() => nav.tasks("upcoming")}
          />
          <SideItem
            glyph={<ChecklistGlyph />}
            label={tr({ en: "All Tasks", id: "Semua tugas" })}
            count={m.open.length}
            active={active === "all"}
            onClick={() => nav.tasks("all")}
          />
        </ul>
        <h2 className={cx("mb-1 mt-6 px-2.5 text-[11px] font-semibold", ink.secondary)}>{t("courses")}</h2>
        <ul className="flex flex-col gap-[2px]">
          {data.courses.map((c) => {
            const pr = m.progress(c.code);
            return (
              <SideItem
                key={c.code}
                glyph={<ProgressPie color={c.color} value={pr.total ? pr.done / pr.total : 0} />}
                label={c.name}
                active={active === `course:${c.code}`}
                onClick={() => nav.course(c.code)}
              />
            );
          })}
        </ul>
      </nav>
      <SyncStatus />
    </aside>
  );
}

function SideItem({
  glyph,
  label,
  count,
  active,
  onClick,
}: {
  glyph: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex w-full items-start gap-2.5 rounded-[7px] px-2.5 py-[6px] text-left text-[13.5px] font-medium leading-[18px]",
          "transition-colors duration-150 ease-out",
          focusRing,
          active
            ? "bg-black/[0.075] dark:bg-white/[0.1]"
            : "hover:bg-black/[0.04] active:bg-black/[0.065] dark:hover:bg-white/[0.05] dark:active:bg-white/[0.08]",
        )}
      >
        <span className="grid h-[18px] w-[18px] shrink-0 place-items-center">{glyph}</span>
        <span className="min-w-0 flex-1">{label}</span>
        {count ? <span className={cx("pl-1 text-[12.5px] font-normal tabular-nums", ink.secondary)}>{count}</span> : null}
      </button>
    </li>
  );
}

function SyncStatus() {
  const { p, m } = useVB();
  const { t, f, data } = p;
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pb-3.5 pt-2">
      <div
        className="min-w-0 flex-1"
        title={`EduNex ${f.time(data.sources.edunex.updatedAt)} · SIX ${f.time(data.sources.six.updatedAt)}`}
      >
        <div className={cx("flex items-center gap-1.5 text-[12px] font-medium leading-4", ink.secondary)}>
          <span className="size-[7px] shrink-0 rounded-full bg-[#34C759] shadow-[0_0_0_3px_rgba(52,199,89,0.16)]" />
          {t("synced")} · {f.time(m.syncedAt)}
        </div>
        <div className={cx("pl-[13px] text-[11.5px] leading-4", ink.secondary)}>EduNex · SIX</div>
      </div>
      <button
        type="button"
        aria-label={t("settings")}
        title={t("settings")}
        className={cx(
          "grid size-7 place-items-center rounded-[7px] transition-colors duration-150 ease-out",
          ink.secondary,
          "hover:bg-black/[0.05] hover:text-[#1D1D1F] dark:hover:bg-white/[0.07] dark:hover:text-white",
          focusRing,
        )}
      >
        <Icons.Settings className="size-[15px]" />
      </button>
    </div>
  );
}

/** The page frame: glyph + big bold title, optional quiet subtitle, then sections. */
export function Page({
  glyph,
  title,
  subtitle,
  children,
}: {
  glyph: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[800px] px-10 pb-28 pt-4 motion-safe:animate-[vb-in_240ms_ease-out]">
      <header className="flex items-start gap-3">
        <span className="grid size-[34px] shrink-0 place-items-center">{glyph}</span>
        <div className="min-w-0 flex-1">
          <h1 data-vb-title className="text-[28px] font-bold leading-[34px] tracking-[-0.022em]">
            {title}
          </h1>
          {subtitle != null && <div className={cx("mt-0.5 text-[15px] leading-[22px]", ink.secondary)}>{subtitle}</div>}
        </div>
      </header>
      {children}
    </div>
  );
}

/** Toolbar back button: "‹ Today", "‹ All Tasks", "‹ <course>". */
export function BackButton() {
  const { nav, backLabel, p } = useVB();
  return (
    <button
      type="button"
      onClick={nav.back}
      aria-label={`${p.t("back")}: ${backLabel}`}
      className={cx(
        "-ml-1 flex h-7 max-w-[340px] items-center gap-0.5 rounded-[7px] pl-1 pr-2.5 text-[13px] font-medium",
        "transition-colors duration-150 ease-out hover:bg-black/[0.05] active:bg-black/[0.08] dark:hover:bg-white/[0.07]",
        ink.blue,
        focusRing,
      )}
    >
      <Icons.ChevronLeft className="size-[17px] shrink-0" strokeWidth={2.2} />
      <span className="truncate">{backLabel}</span>
    </button>
  );
}
