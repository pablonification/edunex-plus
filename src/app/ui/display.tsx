// Things that show information: cards, section titles, chips, course marks,
// loading and empty states.
import type { ReactNode } from "react";
import { useT } from "../i18n";
import { cx } from "./cx";
import { Icons } from "./icons";
import { pauseUnseen } from "./motion/visible";

const CARD = {
  /** Content that sits on the page. */
  plain: "rounded-xl border border-edge bg-surface shadow-card",
  /** What matters most on a screen (what's happening now): lifted a little. */
  raised: "rounded-2xl border border-edge bg-raised shadow-raised",
  /** A quiet area inside a card or a page (an empty state, a side note). */
  sunken: "rounded-xl bg-sunken",
} as const;

export function Card({ variant = "plain", className, children }: { variant?: keyof typeof CARD; className?: string; children: ReactNode }) {
  return <div className={cx(CARD[variant], className)}>{children}</div>;
}

export function SectionTitle({ children, aside, count }: { children: ReactNode; aside?: ReactNode; count?: number }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-title font-semibold tracking-[-0.01em]">
        {children}
        {count !== undefined && <span className="ml-2 text-body font-medium text-faint tabular-nums">{count}</span>}
      </h2>
      {aside}
    </div>
  );
}

/** Nothing here yet: what would be here, why it's empty, and the way forward when there is one. */
export function EmptyState({ icon, title, description, children }: { icon: ReactNode; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-sunken px-6 py-11 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-surface text-muted shadow-card">{icon}</span>
      <div>
        <p className="text-body font-semibold text-fg">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-[46ch] text-small text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** A placeholder block while the first data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <span ref={pauseUnseen} data-loop aria-hidden className={cx("block rounded-md bg-fill motion-safe:animate-shimmer", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-black/10 bg-surface px-1 font-sans text-micro font-medium text-faint shadow-[0_1px_0_rgb(0_0_0/0.06)] dark:border-white/10">
      {children}
    </kbd>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span ref={pauseUnseen} data-loop aria-hidden className={cx("relative inline-flex size-2", className)}>
      <span className="absolute inset-0 rounded-full bg-live opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-live" />
    </span>
  );
}

/** A thin progress bar (attendance, SKS). */
export function Bar({ value, color, label, className }: { value: number; color: string; label: string; className?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cx("block h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]", className)}
    >
      <span
        className="block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500"
        style={{ width: `${clamped * 100}%`, background: color }}
      />
    </span>
  );
}

const TONE = {
  neutral: "bg-neutral-bg text-neutral-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  success: "bg-success-bg text-success-fg",
  info: "bg-info-bg text-info-fg",
} as const;
export type Tone = keyof typeof TONE;

/** A small count or label pill. */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-[18px] items-center rounded-full px-1.5 text-micro font-semibold tabular-nums", TONE[tone], className)}>{children}</span>
  );
}

/** The official systems a fact can come from. */
export type Source = "edunex" | "six" | "itb";

/**
 * Which official system a fact comes from, said quietly. Only where it changes
 * what the Student does: where to act, or when two systems disagree.
 */
export function SourceTag({ source, className }: { source: Source; className?: string }) {
  const t = useT();
  return (
    <span
      className={cx(
        "inline-flex h-[18px] shrink-0 items-center rounded-[5px] border border-edge px-1.5 text-micro font-semibold tracking-[0.01em] text-muted",
        className,
      )}
    >
      {t(`source.${source}`)}
    </span>
  );
}

export type TaskStatus = "not_started" | "draft" | "submitted" | "overdue" | "closed" | "in_review";

const STATUS_TONE: Record<TaskStatus, string> = {
  not_started: "bg-(--status-not-started-bg) text-(--status-not-started-fg)",
  draft: "bg-(--status-draft-bg) text-(--status-draft-fg)",
  submitted: "bg-(--status-submitted-bg) text-(--status-submitted-fg)",
  overdue: "bg-(--status-overdue-bg) text-(--status-overdue-fg)",
  closed: "bg-(--status-closed-bg) text-(--status-closed-fg)",
  in_review: "bg-(--status-review-bg) text-(--status-review-fg)",
};

export function StatusGlyph({ status, className = "size-3.5" }: { status: TaskStatus; className?: string }) {
  switch (status) {
    case "submitted":
      return <Icons.CheckCircle className={className} weight="bold" />;
    case "overdue":
      return <Icons.AlertTriangle className={className} weight="bold" />;
    case "closed":
      return <Icons.Lock className={className} weight="bold" />;
    case "in_review":
      return <Icons.Clock className={className} weight="bold" />;
    case "draft":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </svg>
      );
    default:
      return <Icons.Circle className={className} weight="bold" />;
  }
}

/** A Task's true status. Color is never the only signal: each has its own glyph and word. */
export function StatusChip({ status }: { status: TaskStatus }) {
  const t = useT();
  return (
    <span
      className={cx("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-caption font-semibold whitespace-nowrap", STATUS_TONE[status])}
    >
      <StatusGlyph status={status} className="size-3" />
      {t(`taskStatus.${status}`)}
    </span>
  );
}

export function CourseDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cx("inline-block size-2.5 shrink-0 rounded-[3px]", className)} style={{ background: color }} />;
}

export function CourseCode({ code, color, className }: { code: string; color: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-semibold tracking-[0.01em] tabular-nums", className)}>
      <CourseDot color={color} className="size-2" />
      {code}
    </span>
  );
}
