// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): the shared look — colour
// tokens, Things-style list glyphs, Task status circles, pills, buttons, rows.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { TaskStatus } from "./data";
import type { StringKey } from "./i18n";
import { Icons } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Text colours. Each one is AA (4.5:1 or better) on its background in both themes. */
export const ink = {
  primary: "text-[#1D1D1F] dark:text-[#F2F2F7]",
  body: "text-[#3A3A3C] dark:text-[#D1D1D6]",
  secondary: "text-[#6E6E73] dark:text-[#98989D]",
  blue: "text-[#0068D6] dark:text-[#2B8FFF]",
  red: "text-[#D70015] dark:text-[#FF453A]",
  green: "text-[#1A7F37] dark:text-[#30D158]",
} as const;

export const hairline = "border-black/[0.08] dark:border-white/[0.08]";
export const focusRing =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-[#007AFF]/45 dark:focus-visible:ring-[#0A84FF]/60";

/** A list row: full-bleed hover that hangs 10px past the text column, like Things. */
export const rowBase = cx(
  "group/row relative -mx-2.5 flex w-[calc(100%+20px)] gap-3 rounded-[9px] px-2.5 text-left",
  "transition-colors duration-150 ease-out hover:bg-black/[0.035] active:bg-black/[0.06]",
  "dark:hover:bg-white/[0.045] dark:active:bg-white/[0.07]",
  focusRing,
);
/** The left time/date column shared by Today, Upcoming and the course page, so rows line up. */
export const leadCol = "w-[92px] shrink-0 text-[13px] leading-5 tabular-nums";

/* ── Small line icons the shared set lacks (Lucide paths, ISC) ─────────── */

function glyph(children: ReactNode) {
  return function Glyph({ className = "size-4", strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
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

export const More = {
  Flag: glyph(
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </>,
  ),
  Image: glyph(
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>,
  ),
  Info: glyph(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>,
  ),
  Spinner: glyph(<path d="M21 12a9 9 0 1 1-6.219-8.56" />),
  Minus: glyph(<path d="M5 12h14" />),
};

/* ── Things-style smart-list glyphs (filled, one colour each) ──────────── */

export function StarGlyph({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M10 2.8L12 7.85L17.42 8.19L13.23 11.65L14.58 16.91L10 14L5.42 16.91L6.77 11.65L2.58 8.19L8 7.85Z"
        fill="#F5C400"
        stroke="#F5C400"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarGlyph({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="2.5" y="3.25" width="15" height="14.25" rx="3.25" fill="#FF3B30" />
      <path d="M2.5 7.6h15" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.1" />
      <g fill="#fff">
        <circle cx="6.6" cy="10.75" r="1" />
        <circle cx="10" cy="10.75" r="1" />
        <circle cx="13.4" cy="10.75" r="1" />
        <circle cx="6.6" cy="14.05" r="1" />
        <circle cx="10" cy="14.05" r="1" />
      </g>
    </svg>
  );
}

export function ChecklistGlyph({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="15" height="15" rx="3.75" fill="#007AFF" />
      <path
        d="M5.5 7.35l1.2 1.2 2.15-2.3M5.5 12.65l1.2 1.2 2.15-2.3"
        fill="none"
        stroke="#fff"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 7.55h3.5M11 12.85h3.5" stroke="#fff" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

export function LogbookGlyph({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="3.75" y="2.5" width="12.5" height="15" rx="2.6" fill="#2EA44F" />
      <path d="M6.6 2.5v15" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.1" />
      <path
        d="M9.1 10.1l1.45 1.45 2.75-2.95"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Things' project pie: an outlined ring with a wedge for the share of Tasks handed in. */
export function ProgressPie({
  color,
  value,
  size = 16,
  className,
}: {
  color: string;
  value: number;
  size?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  const r = 4.55;
  let wedge: ReactNode = null;
  if (v >= 0.999) wedge = <circle cx="8" cy="8" r={r} fill={color} />;
  else if (v > 0.001) {
    const a = v * 2 * Math.PI;
    const x = (8 + r * Math.sin(a)).toFixed(3);
    const y = (8 - r * Math.cos(a)).toFixed(3);
    wedge = <path d={`M8 8V${8 - r}A${r} ${r} 0 ${v > 0.5 ? 1 : 0} 1 ${x} ${y}Z`} fill={color} />;
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={cx("shrink-0", className)} aria-hidden>
      <circle cx="8" cy="8" r="6.9" fill="none" stroke={color} strokeWidth="1.5" />
      {wedge}
    </svg>
  );
}

/* ── Task status: six shapes, never colour alone ───────────────────────── */

export const STATUS_LABEL: Record<TaskStatus, StringKey> = {
  not_started: "status_not_started",
  draft: "status_draft",
  submitted: "status_submitted",
  in_review: "status_in_review",
  overdue: "status_overdue",
  closed: "status_closed",
};

export type Tone = "neutral" | "blue" | "green" | "indigo" | "red" | "yellow" | "orange";

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  not_started: "neutral",
  draft: "blue",
  submitted: "green",
  in_review: "indigo",
  overdue: "red",
  closed: "red",
};

/**
 * ○ not started · ◑ draft (half full) · ✓ submitted · ⋯ in review (being graded)
 * · ! overdue (still actionable, so the loudest) · lock closed (quiet ring, nothing to do).
 */
export function StatusCircle({
  status,
  label,
  size = 18,
  className,
}: {
  status: TaskStatus;
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cx("shrink-0 overflow-visible", className)}
    >
      {status === "not_started" && (
        <circle cx="10" cy="10" r="8.25" fill="none" strokeWidth="1.5" className="stroke-[#8E8E93] dark:stroke-[#6C6C71]" />
      )}
      {status === "draft" && (
        <>
          <circle cx="10" cy="10" r="8.25" fill="none" strokeWidth="1.5" className="stroke-[#007AFF] dark:stroke-[#0A84FF]" />
          <path d="M10 4.6a5.4 5.4 0 0 1 0 10.8z" className="fill-[#007AFF] dark:fill-[#0A84FF]" />
        </>
      )}
      {status === "submitted" && (
        <>
          <circle cx="10" cy="10" r="9" className="fill-[#2EA44F] dark:fill-[#2EA44F]" />
          <path
            d="M6.2 10.25l2.55 2.55 5.05-5.35"
            fill="none"
            stroke="#fff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {status === "in_review" && (
        <>
          <circle cx="10" cy="10" r="9" className="fill-[#5856D6] dark:fill-[#5E5CE6]" />
          <g fill="#fff">
            <circle cx="6.3" cy="10" r="1.2" />
            <circle cx="10" cy="10" r="1.2" />
            <circle cx="13.7" cy="10" r="1.2" />
          </g>
        </>
      )}
      {status === "overdue" && (
        <>
          <circle cx="10" cy="10" r="9" className="fill-[#FF3B30] dark:fill-[#FF453A]" />
          <path d="M10 5.4v5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="14.1" r="1.15" fill="#fff" />
        </>
      )}
      {status === "closed" && (
        <>
          <circle cx="10" cy="10" r="8.25" fill="none" strokeWidth="1.5" className="stroke-[#FF3B30] dark:stroke-[#FF453A]" />
          <rect x="6.75" y="9.2" width="6.5" height="5" rx="1.25" className="fill-[#FF3B30] dark:fill-[#FF453A]" />
          <path
            d="M8.2 9.2V8a1.8 1.8 0 0 1 3.6 0v1.2"
            fill="none"
            strokeWidth="1.45"
            className="stroke-[#FF3B30] dark:stroke-[#FF453A]"
          />
        </>
      )}
    </svg>
  );
}

/* ── Pills, dots, tiles ────────────────────────────────────────────────── */

const PILL: Record<Tone, string> = {
  neutral: "bg-black/[0.055] text-[#5E5E63] dark:bg-white/[0.09] dark:text-[#AEAEB2]",
  blue: "bg-[#007AFF]/[0.1] text-[#0059B8] dark:bg-[#0A84FF]/[0.2] dark:text-[#6AB0FF]",
  green: "bg-[#2EA44F]/[0.12] text-[#176F30] dark:bg-[#30D158]/[0.15] dark:text-[#4CD571]",
  indigo: "bg-[#5856D6]/[0.12] text-[#4441B8] dark:bg-[#5E5CE6]/[0.24] dark:text-[#ABA9FF]",
  red: "bg-[#FF3B30]/[0.1] text-[#B8000F] dark:bg-[#FF453A]/[0.17] dark:text-[#FF7A72]",
  yellow: "bg-[#F5C400]/[0.24] text-[#5F4700] dark:bg-[#F5C400]/[0.16] dark:text-[#F5C400]",
  orange: "bg-[#FF9500]/[0.13] text-[#9A4A00] dark:bg-[#FF9F0A]/[0.18] dark:text-[#FFB340]",
};

export function Pill({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none",
        PILL[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Dot({ color, className = "size-2" }: { color: string; className?: string }) {
  return <span aria-hidden className={cx("inline-block shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

/** Fixed slot for the row indicator (status circle or course dot) so every list lines up. */
export function Mark({ children }: { children: ReactNode }) {
  return <span className="grid h-5 w-[18px] shrink-0 place-items-center">{children}</span>;
}

export type TileKind = "pdf" | "image" | "doc" | "meeting" | "note" | "other";

export function fileKind(name: string): TileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "heic", "webp"].includes(ext)) return "image";
  if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) return "doc";
  return "other";
}

const TILE: Record<TileKind, string> = {
  pdf: "bg-[#FF3B30]/[0.1] text-[#D70015] dark:bg-[#FF453A]/[0.16] dark:text-[#FF6961]",
  image: "bg-[#2EA44F]/[0.12] text-[#1A7F37] dark:bg-[#30D158]/[0.15] dark:text-[#30D158]",
  doc: "bg-[#007AFF]/[0.1] text-[#0068D6] dark:bg-[#0A84FF]/[0.18] dark:text-[#5EA8FF]",
  meeting: "bg-[#007AFF]/[0.1] text-[#0068D6] dark:bg-[#0A84FF]/[0.18] dark:text-[#5EA8FF]",
  note: "bg-[#F5C400]/[0.2] text-[#7A5B00] dark:bg-[#F5C400]/[0.15] dark:text-[#F5C400]",
  other: "bg-black/[0.05] text-[#6E6E73] dark:bg-white/[0.08] dark:text-[#98989D]",
};

export function FileTile({ kind, small = false }: { kind: TileKind; small?: boolean }) {
  const icon = small ? "size-[14px]" : "size-4";
  return (
    <span
      aria-hidden
      className={cx("grid shrink-0 place-items-center", small ? "size-7 rounded-[7px]" : "size-8 rounded-[8px]", TILE[kind])}
    >
      {kind === "pdf" && <Icons.FileText className={icon} />}
      {kind === "doc" && <Icons.FileText className={icon} />}
      {kind === "image" && <More.Image className={icon} />}
      {kind === "meeting" && <Icons.Video className={icon} />}
      {kind === "note" && <Icons.StickyNote className={icon} />}
      {kind === "other" && <Icons.Link className={icon} />}
    </span>
  );
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

type ButtonKind = "primary" | "quiet" | "secondary" | "tinted";

export function Button({
  kind = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap",
        "transition-[background-color,box-shadow,opacity,transform] duration-150 ease-out motion-safe:active:scale-[0.97]",
        "disabled:cursor-default disabled:opacity-50",
        focusRing,
        size === "sm" && "h-7 rounded-[7px] px-2.5 text-[12.5px] font-medium",
        size === "md" && "h-8 rounded-[8px] px-3.5 text-[13px] font-medium",
        size === "lg" && "h-11 rounded-[11px] px-7 text-[15px] font-semibold",
        kind === "primary" &&
          "bg-[#0071E3] font-semibold text-white shadow-[0_1px_2px_rgba(0,40,100,0.18),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#0077ED] active:bg-[#0068D1]",
        kind === "quiet" &&
          cx(ink.primary, "hover:bg-black/[0.05] active:bg-black/[0.08] dark:hover:bg-white/[0.08] dark:active:bg-white/[0.11]"),
        kind === "secondary" &&
          cx(
            ink.primary,
            "bg-white shadow-[0_0.5px_1.5px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.09] hover:bg-[#FAFAFB] active:bg-[#F2F2F4]",
            "dark:bg-white/[0.1] dark:shadow-none dark:ring-white/[0.07] dark:hover:bg-white/[0.14] dark:active:bg-white/[0.17]",
          ),
        kind === "tinted" &&
          "bg-[#007AFF]/[0.1] text-[#0059B8] hover:bg-[#007AFF]/[0.15] active:bg-[#007AFF]/[0.2] dark:bg-[#0A84FF]/[0.2] dark:text-[#6AB0FF] dark:hover:bg-[#0A84FF]/[0.27]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Sections ──────────────────────────────────────────────────────────── */

/** Bold title over a hairline, Things-heading style. `aside` is a quiet right-hand note. */
export function Section({
  title,
  aside,
  children,
  className = "mt-8",
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className={cx("flex items-baseline gap-3 border-b pb-1.5", hairline)}>
        <h2 className={cx("flex-1 text-[15px] font-bold leading-5 tracking-[-0.01em]", ink.primary)}>{title}</h2>
        {aside != null && <span className={cx("text-[12px] font-medium", ink.secondary)}>{aside}</span>}
      </div>
      <div className="mt-0.5">{children}</div>
    </section>
  );
}

export function EmptyRow({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cx("flex items-center gap-2.5 py-2.5 text-[13.5px]", ink.secondary)}>
      {icon}
      {children}
    </div>
  );
}
