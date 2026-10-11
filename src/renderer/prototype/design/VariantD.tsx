// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": the LMS-native direction.
// Mental model: semester → course → modules (EduNex's table of contents) +
// meetings (SIX). Navigation keeps the words students already know from
// EduNex and SIX; productivity-app ideas appear only as accents.
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { TrafficLights } from "./chrome";
import { Icons, type IconProps } from "./icons";
import { setParams } from "./params";
import type { VariantModule, VariantProps } from "./variant-props";
import { AcademicPage } from "./variant-d-academic";
import { CoursePage } from "./variant-d-course";
import { ExamPage } from "./variant-d-exams";
import { FeatureMap } from "./variant-d-features";
import { GradesPage } from "./variant-d-grades";
import { CommandPalette, InboxPanel, SettingsSheet } from "./variant-d-overlays";
import { PresencePage } from "./variant-d-presence";
import { Home } from "./variant-d-home";
import { SignIn } from "./variant-d-onboarding";
import { SchedulePage } from "./variant-d-schedule";
import { TaskPage, TasksPage } from "./variant-d-tasks";
import { CourseDot, Kbd, cx, openPresence, openTasks, ui, useDSettings, visibleNotices } from "./variant-d-ui";

type Overlay = "search" | "inbox" | "settings" | null;

function KuliahApp(p: VariantProps) {
  // ?overlay=search|inbox|settings opens one directly (deep links from the feature map, screenshots).
  const urlOverlay = new URLSearchParams(window.location.search).get("overlay") as Overlay;
  const [overlay, setOverlay] = useState<Overlay>(urlOverlay ?? null);
  useEffect(() => {
    if (urlOverlay) setOverlay(urlOverlay);
  }, [urlOverlay]);
  const close = useCallback(() => {
    setOverlay(null);
    if (new URLSearchParams(window.location.search).get("overlay")) setParams({ overlay: null });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOverlay((o) => (o === "search" ? null : "search"));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setOverlay("settings");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (p.screen === "signin") return <SignIn {...p} />;
  if (p.screen === "features") return <FeatureMap {...p} />;
  return (
    <div className={cx("flex h-screen overflow-hidden bg-white dark:bg-[#161618]", ui.text)}>
      <Sidebar {...p} onSearch={() => setOverlay("search")} onSettings={() => setOverlay("settings")} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar {...p} onInbox={() => setOverlay((o) => (o === "inbox" ? null : "inbox"))} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {p.screen === "today" && <Home {...p} />}
          {p.screen === "tasks" && <TasksPage {...p} />}
          {p.screen === "task" && <TaskPage key={`${p.task.id}-${p.task.status}`} {...p} />}
          {p.screen === "exam" && <ExamPage key={p.course.code} {...p} />}
          {p.screen === "course" && <CoursePage key={p.course.code} {...p} />}
          {p.screen === "schedule" && <SchedulePage {...p} />}
          {p.screen === "presence" && <PresencePage {...p} openSettings={() => setOverlay("settings")} />}
          {p.screen === "grades" && <GradesPage {...p} />}
          {p.screen === "academic" && <AcademicPage {...p} />}
        </main>
        {overlay === "inbox" && <InboxPanel p={p} onClose={close} />}
      </div>
      {overlay === "search" && <CommandPalette p={p} onClose={close} />}
      {overlay === "settings" && <SettingsSheet p={p} onClose={close} />}
    </div>
  );
}

// ---------------------------------------------------------------- sidebar

interface NavItem {
  key: string;
  label: string;
  Icon: ComponentType<IconProps>;
  active?: boolean;
  badge?: { value: number; tone: "neutral" | "amber" };
  onClick?: () => void;
}

function Sidebar(p: VariantProps & { onSearch: () => void; onSettings: () => void }) {
  const { data, now, screen, course, f, t, tr, go, onSearch, onSettings } = p;
  const { hidden } = useDSettings();
  const open = openTasks(data).length;
  const presence = openPresence(data, now);
  const items: NavItem[] = [
    { key: "home", label: tr({ en: "Home", id: "Beranda" }), Icon: Icons.Home, active: screen === "today", onClick: () => go("today") },
    {
      key: "tasks",
      label: tr({ en: "Tasks & Exams", id: "Tugas & Ujian" }),
      Icon: Icons.ListChecks,
      active: screen === "tasks" || screen === "task",
      badge: open ? { value: open, tone: "neutral" } : undefined,
      onClick: () => go("tasks"),
    },
    { key: "schedule", label: t("schedule"), Icon: Icons.Calendar, active: screen === "schedule", onClick: () => go("schedule") },
    {
      key: "presence",
      label: t("presence"),
      Icon: Icons.Hand,
      active: screen === "presence",
      badge: presence ? { value: 1, tone: "amber" } : undefined,
      onClick: () => go("presence"),
    },
    { key: "grades", label: t("grades"), Icon: Icons.GraduationCap, active: screen === "grades", onClick: () => go("grades") },
    { key: "academic", label: tr({ en: "Study plan", id: "Rencana studi" }), Icon: Icons.BookOpen, active: screen === "academic", onClick: () => go("academic") },
  ].filter((item) => !hidden.includes(item.key)) as NavItem[];
  const initials = data.student.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <aside className={cx("relative flex w-[248px] shrink-0 flex-col border-r bg-[#f7f7f8] dark:bg-[#1b1b1e]", ui.line)}>
      <TrafficLights />
      <div className="h-[52px] shrink-0" />

      <div className="px-3">
        <button
          onClick={onSearch}
          className={cx(
            "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px]",
            "bg-white/80 ring-1 ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.07]",
            ui.muted,
            ui.focus,
          )}
        >
          <Icons.Search className="size-3.5" />
          {t("search")}
          <span className="ml-auto flex gap-0.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <nav className="mt-3 space-y-px px-3">
        {items.map(({ key, label, Icon, active, badge, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px]",
              active ? "bg-black/[0.06] font-semibold dark:bg-white/[0.08]" : cx("font-medium", ui.hover),
              ui.focus,
            )}
          >
            <Icon className={cx("size-4", active ? "" : ui.muted)} strokeWidth={active ? 2 : 1.75} />
            <span className="flex-1 truncate text-left">{label}</span>
            {badge && (
              <span
                className={cx(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  badge.tone === "amber"
                    ? "bg-[#fff1d6] text-[#8a5300] dark:bg-[#3a2c10] dark:text-[#f5c46a]"
                    : cx("bg-black/[0.06] dark:bg-white/[0.08]", ui.muted),
                )}
              >
                {badge.value}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        <p className={cx("mb-1 px-2.5 text-[11.5px] font-semibold tracking-[0.04em] uppercase", ui.faint)}>
          {tr({ en: "Courses", id: "Mata kuliah" })}
        </p>
        <ul className="space-y-px">
          {data.courses.map((c) => {
            const active = screen === "course" && course.code === c.code;
            return (
              <li key={c.code}>
                <button
                  onClick={() => go("course", { course: c.code })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px]",
                    active ? "bg-black/[0.06] dark:bg-white/[0.08]" : ui.hover,
                    ui.focus,
                  )}
                >
                  <CourseDot color={c.color} />
                  <span className="shrink-0 font-semibold tabular-nums">{c.code}</span>
                  <span className={cx("truncate", ui.muted)}>{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={cx("border-t px-2 py-2", ui.line)}>
        <button onClick={onSettings} className={cx("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left", ui.hover, ui.focus)}>
          <span className="grid size-7 place-items-center rounded-full bg-[#dfe7fb] text-[11px] font-bold text-[#2f5fc4] dark:bg-[#22304f] dark:text-[#9ab8ff]">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold">{data.student.name}</span>
            <span className={cx("flex items-center gap-1.5 text-[11.5px]", ui.faint)}>
              <span className="size-1.5 rounded-full bg-[#22a35a]" />
              EduNex · SIX · {f.time(data.sources.edunex.updatedAt)}
            </span>
          </span>
          <Icons.Settings className={cx("ml-auto size-4 shrink-0", ui.faint)} />
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- top bar

function TopBar(p: VariantProps & { onInbox: () => void }) {
  const { data, now, screen, task, course, t, tr, go, onInbox } = p;
  const unread = visibleNotices(data, now).filter((n) => !n.read).length;
  const crumbs: { label: string; onClick?: () => void }[] =
    screen === "task"
      ? [{ label: tr({ en: "Tasks & Exams", id: "Tugas & Ujian" }), onClick: () => go("tasks") }, { label: task.title }]
      : screen === "course"
        ? [{ label: tr({ en: "Courses", id: "Mata kuliah" }) }, { label: `${course.code} · ${course.name}` }]
        : [];
  return (
    <div className={cx("flex h-[52px] shrink-0 items-center gap-3 border-b px-6", ui.line)}>
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <Icons.ChevronRight className={cx("size-3.5 shrink-0", ui.faint)} />}
            {c.onClick ? (
              <button onClick={c.onClick} className={cx("shrink-0 rounded font-medium hover:text-current", ui.muted, ui.focus)}>
                {c.label}
              </button>
            ) : (
              <span className={cx("truncate", i === crumbs.length - 1 ? "font-semibold" : ui.muted)}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onInbox}
          aria-label={t("announcements")}
          className={cx("relative grid size-8 place-items-center rounded-lg", ui.muted, ui.hover, ui.focus)}
        >
          <Icons.Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[#e5484d] px-1 text-[9.5px] font-bold text-white ring-2 ring-white dark:ring-[#161618]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export const VariantD: VariantModule = { key: "D", name: "Kuliah", Component: KuliahApp };
