// PROTOTYPE (#83) — throwaway. Variant C "Spaces": shared tokens, the data
// model every screen reads from, a few extra icons and small primitives.
import type { CSSProperties, ReactNode } from "react";
import type { ClassSession, Course, DesignData, Material, Notice, PresenceWindow, Task, TaskStatus } from "./data";
import type { Format, StringKey } from "./i18n";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";

/* ------------------------------------------------------------------ tokens */

/** Course-less things (e.g. materials of a past course) get a calm gray. */
export const NEUTRAL = "#8E8E93";
/** Home's own space tint: a quiet periwinkle-slate, so courses own the color. */
export const HOME_TINT = "#6E7BA8";
export const BRAND = "#2F6BF0";

/** Every course-colored element reads its color from `--c`. */
export function withColor(color: string, extra?: CSSProperties): CSSProperties {
  return { ["--c" as string]: color, ...extra } as CSSProperties;
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C8DFF] dark:focus-visible:outline-[#7AA7FF]";

export const TEXT = "text-zinc-900 dark:text-zinc-50";
export const MUTED = "text-zinc-500 dark:text-zinc-400";
export const SUBTLE = "text-zinc-600 dark:text-zinc-300";

/** Course color as readable text (≥6:1 on light and dark surfaces, see .vc-ink). */
export const INK = "vc-ink";
/** Course color as a soft wash behind content. */
export const WASH = "bg-[color-mix(in_oklab,var(--c)_11%,transparent)] dark:bg-[color-mix(in_oklab,var(--c)_20%,transparent)]";
export const WASH_STRONG =
  "bg-[color-mix(in_oklab,var(--c)_17%,transparent)] dark:bg-[color-mix(in_oklab,var(--c)_28%,transparent)]";

export const CARD =
  "rounded-[20px] bg-white ring-1 ring-black/[0.045] shadow-[0_1px_2px_rgba(15,20,35,0.04),0_10px_28px_-14px_rgba(15,20,35,0.16)] dark:bg-[#181A20] dark:ring-white/[0.07] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_14px_34px_-16px_rgba(0,0,0,0.7)]";

/** Gentle hover lift for clickable cards. */
export const LIFT =
  "transition-[transform,box-shadow,background-color] duration-200 ease-out motion-safe:hover:-translate-y-[2px] hover:shadow-[0_1px_2px_rgba(15,20,35,0.05),0_18px_36px_-16px_rgba(15,20,35,0.24)] dark:hover:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_20px_40px_-16px_rgba(0,0,0,0.85)] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.995]";

/** Small row hover inside cards. */
export const ROW_HOVER =
  "transition-colors duration-150 ease-out hover:bg-zinc-900/[0.035] dark:hover:bg-white/[0.045]";

/**
 * Deep → vivid course gradient. Stops stay between l×0.64 and l×0.8 in OKLCH so
 * white text keeps ≥4.5:1 for every course color; the brighter glow is
 * decoration only and is placed (`glow`) where no text sits.
 */
export function heroGradient(angle = 125, glow = "100% 0%"): string {
  return [
    `radial-gradient(70% 120% at ${glow}, oklch(from var(--c) calc(l * 0.97) calc(c * 1.04) calc(h + 10) / 0.9) 0%, transparent 62%)`,
    `linear-gradient(${angle}deg, oklch(from var(--c) calc(l * 0.64) c calc(h - 4)) 0%, oklch(from var(--c) calc(l * 0.72) c h) 52%, oklch(from var(--c) calc(l * 0.8) c calc(h + 6)) 100%)`,
  ].join(", ");
}

/* --------------------------------------------------------------- the CSS */

/** Variant-scoped CSS: fonts, keyframes, prose. Everything else is Tailwind. */
export const VC_CSS = `
.vc-root { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; font-feature-settings: "cv11"; }
.vc-display { font-family: ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif; letter-spacing: -0.018em; }
.vc-num { font-variant-numeric: tabular-nums; }
.vc-drag { -webkit-app-region: drag; }
.vc-no-drag { -webkit-app-region: no-drag; }

.vc-scroll { scrollbar-width: thin; scrollbar-color: rgb(0 0 0 / 0.16) transparent; }
.dark .vc-scroll { scrollbar-color: rgb(255 255 255 / 0.14) transparent; }

/* Course color as text: deepened in OKLCH (keeps it vivid), pastel on dark. */
.vc-ink { color: oklch(from var(--c) calc(l * 0.68) c h); }
.dark .vc-ink { color: color-mix(in oklab, var(--c) 58%, white); }
/* On white buttons that sit on course gradients (same in both themes). */
.vc-ink-deep { color: oklch(from var(--c) calc(l * 0.6) c h); }

/* The space's primary action: its color, deepened so white text stays AA. */
.vc-solid { background-color: oklch(from var(--c) calc(l * 0.64) calc(c * 0.96) h); color: #fff; }
.vc-solid:hover:not(:disabled) { background-color: oklch(from var(--c) calc(l * 0.57) c h); }
.dark .vc-solid { background-color: oklch(from var(--c) calc(l * 0.7) c h); }
.dark .vc-solid:hover:not(:disabled) { background-color: oklch(from var(--c) calc(l * 0.76) c h); }

@keyframes vc-sheet-in { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes vc-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes vc-rise { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes vc-blob-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(14%, 10%) scale(1.12); } }
@keyframes vc-blob-2 { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(-12%, 12%) scale(0.92); } }
@keyframes vc-blob-3 { 0%,100% { transform: translate(0,0) scale(0.95); } 50% { transform: translate(10%, -14%) scale(1.1); } }
@keyframes vc-blob-4 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-14%, -8%) scale(1.08); } }
@keyframes vc-breathe { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: 0; transform: scale(2.4); } }

.vc-prose { font-size: 13.5px; line-height: 1.68; overflow-wrap: anywhere; }
.vc-prose > :first-child { margin-top: 0; }
.vc-prose > :last-child { margin-bottom: 0; }
.vc-prose p { margin: 0 0 .7em; }
.vc-prose ol, .vc-prose ul { margin: .2em 0 .8em; padding-left: 1.35em; }
.vc-prose ol { list-style: decimal; }
.vc-prose ul { list-style: disc; }
.vc-prose ol ol { list-style: lower-alpha; margin: .35em 0; }
.vc-prose li { margin: .3em 0; padding-left: .25em; }
.vc-prose li::marker { color: rgb(113 113 122); font-variant-numeric: tabular-nums; }
.vc-prose strong, .vc-prose b { font-weight: 600; }
.vc-prose a { color: color-mix(in oklab, var(--c) 62%, black); text-decoration: underline; text-decoration-color: color-mix(in oklab, var(--c) 40%, transparent); text-underline-offset: 2px; }
.dark .vc-prose a { color: color-mix(in oklab, var(--c) 55%, white); }
.vc-prose img { max-width: 100%; height: auto; border-radius: 12px; }
.vc-prose figure { margin: 0 0 .8em; }
/* EduNex HTML carries inline colors meant for a white page; let the theme win. */
.vc-prose [style] { color: inherit !important; background-color: transparent !important; }
`;

export function VcStyles() {
  return <style>{VC_CSS}</style>;
}

/* ------------------------------------------------------------ extra icons */

function svgIcon(children: ReactNode) {
  return function Icon({ className = "size-4", strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {children}
      </svg>
    );
  };
}

/** Lucide-style paths not in the shared set (ISC license). */
export const XIcons = {
  CircleDashed: svgIcon(
    <>
      <path d="M10.1 2.182a10 10 0 0 1 3.8 0" />
      <path d="M13.9 21.818a10 10 0 0 1-3.8 0" />
      <path d="M17.609 3.721a10 10 0 0 1 2.69 2.7" />
      <path d="M2.182 13.9a10 10 0 0 1 0-3.8" />
      <path d="M20.279 17.609a10 10 0 0 1-2.7 2.69" />
      <path d="M21.818 10.1a10 10 0 0 1 0 3.8" />
      <path d="M3.721 6.391a10 10 0 0 1 2.7-2.69" />
      <path d="M6.391 20.279a10 10 0 0 1-2.69-2.7" />
    </>,
  ),
  PencilLine: svgIcon(
    <>
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </>,
  ),
  Hourglass: svgIcon(
    <>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </>,
  ),
  Plus: svgIcon(
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>,
  ),
  Timer: svgIcon(
    <>
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </>,
  ),
  Sparkle: svgIcon(
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />,
  ),
  CalendarClock: svgIcon(
    <>
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h5" />
      <path d="M17.5 17.5 16 16.3V14" />
      <circle cx="16" cy="16" r="6" />
    </>,
  ),
  Layers: svgIcon(
    <>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </>,
  ),
  EyeOff: svgIcon(
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>,
  ),
  Command: svgIcon(<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />),
  ArrowRight: svgIcon(
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>,
  ),
};

/* -------------------------------------------------------------- the model */

export type Tone = "overdue" | "soon" | "week" | "later" | "done" | "closed";

export interface Model {
  courses: Course[];
  course(code: string): Course | undefined;
  color(code: string): string;
  courseName(code: string, fallback?: string): string;
  openPresence: PresenceWindow | undefined;
  todaySessions: ClassSession[];
  currentSession: ClassSession | undefined;
  nextSession: ClassSession | undefined;
  /** Later sessions that start before an earlier one ends (SIX schedule clash). */
  overlapsWith: Map<string, ClassSession>;
  sessionsOf(code: string): ClassSession[];
  /** Open = still needs the student (not started, draft, overdue). */
  openTasks: Task[];
  /** Notices up to "now", newest first. */
  notices: Notice[];
  unreadCount: number;
  noticeCourse(n: Notice): Course | undefined;
  noticeTask(n: Notice): Task | undefined;
  materialsOf(code: string): Material[];
  ms(iso: string): number;
  now: number;
  tone(task: Task): Tone;
}

export function buildModel(data: DesignData, now: Date, f: Format): Model {
  const ms = (iso: string) => new Date(iso).getTime();
  const nowMs = now.getTime();
  const byCode = new Map(data.courses.map((c) => [c.code, c]));
  const sessions = [...data.sessions].sort((a, b) => ms(a.start) - ms(b.start));
  const todaySessions = sessions.filter((s) => f.dayOffset(s.start) === 0);

  const overlapsWith = new Map<string, ClassSession>();
  todaySessions.forEach((s, i) =>
    todaySessions.slice(0, i).forEach((earlier) => {
      if (ms(s.start) < ms(earlier.end) && ms(earlier.start) < ms(s.end)) overlapsWith.set(s.id, earlier);
    }),
  );

  const dueMs = (t: Task) => (t.dueAt ? ms(t.dueAt) : Number.POSITIVE_INFINITY);
  const openTasks = data.tasks
    .filter((t) => t.status === "not_started" || t.status === "draft" || t.status === "overdue")
    .sort((a, b) => dueMs(a) - dueMs(b));

  const notices = data.notices.filter((n) => ms(n.date) <= nowMs).sort((a, b) => ms(b.date) - ms(a.date));

  const noticeTask = (n: Notice) => {
    const prefix = n.id.split("-")[0];
    return n.type === "ASSIGNMENT" ? data.tasks.find((t) => t.id === prefix) : undefined;
  };
  const noticeCourse = (n: Notice) => {
    const prefix = n.id.split("-")[0];
    const byClass = data.courses.find((c) => String(c.edunexId) === prefix);
    if (byClass) return byClass;
    const byTask = data.tasks.find((t) => t.id === prefix);
    if (byTask) return byCode.get(byTask.courseCode);
    const byName = data.tasks.find((t) => n.message.includes(t.courseName));
    return byName ? byCode.get(byName.courseCode) : undefined;
  };

  return {
    courses: data.courses,
    course: (code) => byCode.get(code),
    color: (code) => byCode.get(code)?.color ?? NEUTRAL,
    courseName: (code, fallback) => byCode.get(code)?.name ?? fallback ?? code,
    openPresence: data.presence.find((p) => ms(p.opensAt) <= nowMs && nowMs < ms(p.closesAt)),
    todaySessions,
    currentSession: sessions.find((s) => ms(s.start) <= nowMs && nowMs < ms(s.end)),
    nextSession: sessions.find((s) => ms(s.start) > nowMs),
    overlapsWith,
    sessionsOf: (code) => sessions.filter((s) => s.courseCode === code),
    openTasks,
    notices,
    unreadCount: notices.filter((n) => !n.read).length,
    noticeCourse,
    noticeTask,
    materialsOf: (code) =>
      data.materials
        .filter((m) => m.courseCode === code)
        .sort((a, b) => ms(b.updatedAt ?? "1970-01-01") - ms(a.updatedAt ?? "1970-01-01")),
    ms,
    now: nowMs,
    tone: (task) => {
      if (task.status === "submitted" || task.status === "in_review") return "done";
      if (task.status === "closed") return "closed";
      if (task.status === "overdue") return "overdue";
      if (!task.dueAt) return "later";
      const hours = (ms(task.dueAt) - nowMs) / 3_600_000;
      if (hours < 0) return "overdue";
      if (hours < 48) return "soon";
      if (hours < 24 * 7) return "week";
      return "later";
    },
  };
}

/* ------------------------------------------------------------- primitives */

export const STATUS_KEY: Record<TaskStatus, StringKey> = {
  not_started: "status_not_started",
  draft: "status_draft",
  submitted: "status_submitted",
  overdue: "status_overdue",
  closed: "status_closed",
  in_review: "status_in_review",
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  not_started: "bg-zinc-900/[0.06] text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-200",
  draft: "bg-[#FFB020]/[0.16] text-[#8A5300] dark:bg-[#FFB020]/[0.16] dark:text-[#FFCF70]",
  submitted: "bg-[#22A45D]/[0.13] text-[#146C3B] dark:bg-[#30D158]/[0.15] dark:text-[#7EE2A0]",
  in_review: "bg-[#5856D6]/[0.12] text-[#3F3BB5] dark:bg-[#7D7AFF]/[0.18] dark:text-[#B4B2FF]",
  overdue: "bg-[#FF3B30]/[0.12] text-[#B42318] dark:bg-[#FF453A]/[0.16] dark:text-[#FF9C94]",
  closed: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
};

export function StatusIcon({ status, className = "size-3.5" }: { status: TaskStatus; className?: string }) {
  switch (status) {
    case "not_started":
      return <XIcons.CircleDashed className={className} strokeWidth={2} />;
    case "draft":
      return <XIcons.PencilLine className={className} strokeWidth={2} />;
    case "submitted":
      return <Icons.CheckCircle className={className} strokeWidth={2} />;
    case "in_review":
      return <XIcons.Hourglass className={className} strokeWidth={2} />;
    case "overdue":
      return <Icons.AlertTriangle className={className} strokeWidth={2} />;
    case "closed":
      return <Icons.Lock className={className} strokeWidth={2} />;
  }
}

export function StatusBadge({ status, t, size = "md" }: { status: TaskStatus; t: VariantProps["t"]; size?: "sm" | "md" }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-[12px]",
        STATUS_STYLE[status],
      )}
    >
      <StatusIcon status={status} className={size === "sm" ? "size-3.5" : "size-[15px]"} />
      {t(STATUS_KEY[status])}
    </span>
  );
}

const TONE_STYLE: Record<Tone, string> = {
  overdue: "bg-[#FF3B30]/[0.12] text-[#B42318] dark:bg-[#FF453A]/[0.16] dark:text-[#FF9C94]",
  soon: "bg-[#FF6A00]/[0.12] text-[#A33F00] dark:bg-[#FF8A3D]/[0.16] dark:text-[#FFB27A]",
  week: "bg-[#FFB020]/[0.16] text-[#8A5300] dark:bg-[#FFB020]/[0.15] dark:text-[#FFCF70]",
  later: "bg-zinc-900/[0.05] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300",
  done: "bg-[#22A45D]/[0.12] text-[#146C3B] dark:bg-[#30D158]/[0.14] dark:text-[#7EE2A0]",
  closed: "bg-zinc-900/[0.06] text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300",
};

/** "Fri, 16 Oct, 23:59 · in 8 days" with urgency color. */
export function DueChip({
  task,
  m,
  f,
  t,
  tr,
  compact = false,
}: {
  task: Task;
  m: Model;
  f: Format;
  t: VariantProps["t"];
  tr: VariantProps["tr"];
  compact?: boolean;
}) {
  const tone = m.tone(task);
  if (!task.dueAt) return null;
  const rel = f.fromNow(task.dueAt);
  const label =
    tone === "overdue"
      ? tr({ en: `Was due ${rel}`, id: `Tenggat ${rel}` })
      : tone === "closed"
        ? `${t("status_closed")} · ${f.dueLabel(task.dueAt)}`
        : compact
          ? f.dueLabel(task.dueAt)
          : `${f.dueLabel(task.dueAt)} · ${rel}`;
  return (
    <span
      className={cx(
        "vc-num inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap",
        TONE_STYLE[tone],
      )}
    >
      {tone === "overdue" ? (
        <Icons.AlertTriangle className="size-3.5 shrink-0" strokeWidth={2.1} />
      ) : (
        <Icons.Clock className="size-3.5 shrink-0" strokeWidth={2.1} />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

/** The course "space" tag: code in the course's ink on its wash. */
export function CodeTag({ code, color, className }: { code: string; color: string; className?: string }) {
  return (
    <span
      style={withColor(color)}
      className={cx(
        "vc-num inline-flex h-[22px] shrink-0 items-center rounded-[7px] px-1.5 text-[11px] font-bold tracking-[0.02em]",
        WASH,
        INK,
        className,
      )}
    >
      {code}
    </span>
  );
}

/** Small source tag (EduNex / SIX) on tiles: tells where data comes from, nothing more. */
export function SourceTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[6px] px-1.5 py-[3px] text-[10px] font-semibold tracking-[0.04em] text-zinc-500 ring-1 ring-zinc-900/[0.08] ring-inset dark:text-zinc-400 dark:ring-white/10">
      {children}
    </span>
  );
}

export function TileTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="vc-display text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{children}</h2>
      {aside}
    </div>
  );
}

/** Progress ring (SVG), course colored. */
export function Ring({
  value,
  size = 56,
  stroke = 6,
  color,
  children,
  track = "stroke-zinc-900/[0.07] dark:stroke-white/[0.09]",
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  children?: ReactNode;
  track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
        />
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

export function materialKind(kind: Material["kind"], t: VariantProps["t"], tr: VariantProps["tr"]) {
  switch (kind) {
    case "pdf":
      return { label: "PDF", Icon: Icons.FileText, tone: "bg-[#FF3B30]/[0.1] text-[#C4271D] dark:bg-[#FF453A]/[0.16] dark:text-[#FF9C94]" };
    case "meeting":
      return { label: t("online_class"), Icon: Icons.Video, tone: "bg-[#5B5FC7]/[0.12] text-[#4146A8] dark:bg-[#7B83EB]/[0.2] dark:text-[#B8BDF7]" };
    case "note":
      return { label: tr({ en: "Note", id: "Catatan" }), Icon: Icons.StickyNote, tone: "bg-[#FFB020]/[0.16] text-[#8A5300] dark:bg-[#FFB020]/[0.16] dark:text-[#FFCF70]" };
    default:
      return { label: tr({ en: "Link", id: "Tautan" }), Icon: Icons.Link, tone: "bg-zinc-900/[0.06] text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300" };
  }
}

/** Extension-based file type for attached / lecturer files. */
export function fileKind(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { ext: "PDF", tone: "bg-[#FF3B30]/[0.1] text-[#C4271D] dark:bg-[#FF453A]/[0.16] dark:text-[#FF9C94]" };
  if (["jpg", "jpeg", "png", "heic", "gif", "webp"].includes(ext))
    return { ext: ext.toUpperCase(), tone: "bg-[#0A84FF]/[0.1] text-[#0B5CC2] dark:bg-[#0A84FF]/[0.18] dark:text-[#8CC2FF]" };
  if (["doc", "docx"].includes(ext)) return { ext: "DOC", tone: "bg-[#2B579A]/[0.12] text-[#2B579A] dark:bg-[#5B8BD9]/[0.2] dark:text-[#A9C4F0]" };
  if (["ppt", "pptx"].includes(ext)) return { ext: "PPT", tone: "bg-[#D24726]/[0.12] text-[#A8361B] dark:bg-[#E86A4A]/[0.18] dark:text-[#F5B3A2]" };
  return { ext: (ext || "FILE").toUpperCase().slice(0, 4), tone: "bg-zinc-900/[0.06] text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300" };
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** "PL3002" → ["PL", "3002"] for the stacked space tiles. */
export function splitCode(code: string): [string, string] {
  const match = code.match(/^([A-Za-z]+)(.*)$/);
  return match ? [match[1], match[2]] : [code, ""];
}

/** Where "Open in EduNex" goes. Production builds the exact course / Presence URL. */
export const EDUNEX_URL = "https://edunex.itb.ac.id/";
