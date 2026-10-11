// PROTOTYPE (#83) — throwaway. Variant A "Calendar": shared tokens, time and
// colour math, status glyphs and small building blocks used by every screen.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Course, DesignData, Task, TaskStatus } from "./data";
import type { StringKey } from "./i18n";

// ---------------------------------------------------------------- time (WIB)

export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
const WIB = 7 * HOUR; // Asia/Jakarta has no DST.

/** Minutes since midnight in WIB. */
export function wibMinutes(iso: string): number {
  return Math.floor((((Date.parse(iso) + WIB) % DAY) + DAY) % DAY / MIN);
}
/** "2026-10-08" (WIB) for an epoch time. */
export function keyOf(ms: number): string {
  return new Date(ms + WIB).toISOString().slice(0, 10);
}
/** A WIB wall-clock moment on a day key, as ISO. */
export function keyIso(key: string, hhmm = "12:00"): string {
  return `${key}T${hhmm}:00+07:00`;
}
export function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
/** 492 → "08:12" */
export function clock(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ---------------------------------------------------------------- colour

type RGB = [number, number, number];
const hexRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as RGB;
};
const css = ([r, g, b]: RGB, a = 1) =>
  a === 1 ? `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})` : `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Nudge `base` toward `toward` until it reads at AA on `bg`. */
const readable = (base: RGB, toward: RGB, bg: RGB, target = 4.7): RGB => {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(base, toward, t);
    if (contrast(c, bg) >= target) return c;
  }
  return toward;
};

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const NIGHT = hexRgb("#141416");

/** A course colour turned into calendar-event surfaces for one theme. */
export interface Tone {
  solid: string;
  /** Event fill. */
  soft: string;
  /** Event fill on hover. */
  softHover: string;
  /** A barely-there wash for cards and headers. */
  wash: string;
  /** Text that passes AA on `soft`. */
  text: string;
  /** Hairline / ring in the course colour. */
  ring: string;
}

const toneCache = new Map<string, Tone>();
export function tone(hex: string, dark: boolean): Tone {
  const id = `${hex}:${dark}`;
  const hit = toneCache.get(id);
  if (hit) return hit;
  const c = hexRgb(hex);
  const base = dark ? NIGHT : WHITE;
  const soft = mix(c, base, dark ? 0.79 : 0.87);
  const out: Tone = {
    solid: hex,
    soft: css(soft),
    softHover: css(mix(c, base, dark ? 0.73 : 0.81)),
    wash: css(mix(c, base, dark ? 0.88 : 0.94)),
    text: css(readable(c, dark ? WHITE : BLACK, soft)),
    ring: css(c, dark ? 0.45 : 0.35),
  };
  toneCache.set(id, out);
  return out;
}
/** The course colour at some opacity (for gradients). */
export function alpha(hex: string, a: number): string {
  return css(hexRgb(hex), a);
}

// ---------------------------------------------------------------- tokens

/** Text colours (AA on white / #F7F7F8 and on #141416 / #1B1B1D). */
export const ink = {
  1: "text-[#1D1D1F] dark:text-[#F2F2F3]",
  2: "text-[#5F5F66] dark:text-[#A1A1A6]",
  3: "text-[#6E6E76] dark:text-[#8A8A90]",
} as const;
export const accentText = "text-[#2468E0] dark:text-[#6AA6FF]";
export const hairline = "border-black/[0.07] dark:border-white/[0.07]";
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7CF6] dark:focus-visible:outline-[#5B9BFF]";
export const card =
  "rounded-[12px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.07)] dark:bg-[#1C1C1F] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.07)]";
export const press = "transition duration-150 ease-out motion-safe:active:scale-[0.98]";

// ---------------------------------------------------------------- buttons

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function PrimaryButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-[#2468E0] px-3.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.14)] hover:bg-[#1F5DCC] active:bg-[#1A53B8] ${press} ${focusRing} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function QuietButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium text-[#3A3A40] hover:bg-black/[0.05] active:bg-black/[0.08] dark:text-[#D4D4D8] dark:hover:bg-white/[0.07] dark:active:bg-white/[0.1] ${press} ${focusRing} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, className = "", children, ...rest }: ButtonProps & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-7 place-items-center rounded-[7px] ${ink[2]} hover:bg-black/[0.05] hover:text-[#1D1D1F] active:bg-black/[0.08] dark:hover:bg-white/[0.07] dark:hover:text-white ${press} ${focusRing} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- bits

export function Swatch({ color, className = "size-2.5" }: { color: string; className?: string }) {
  return <span aria-hidden className={`shrink-0 rounded-[3px] ${className}`} style={{ background: color }} />;
}

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-[11.5px] font-semibold tracking-[0.01em] ${ink[3]} ${className}`}>{children}</h2>;
}

/** Live indicator: a dot with a soft ping (still when reduced motion is on). */
export function LiveDot({ color = "#1FA971" }: { color?: string }) {
  return (
    <span className="relative flex size-2 shrink-0" aria-hidden>
      <span className="absolute inline-flex size-full rounded-full opacity-50 motion-safe:animate-ping" style={{ background: color }} />
      <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

// ---------------------------------------------------------------- icons (extra)

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

/** Icons icons.tsx lacks (Lucide paths, ISC). */
export const Ex = {
  Flag: glyph(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></>),
  Hourglass: glyph(<><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></>),
  Info: glyph(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>),
  Plus: glyph(<><path d="M5 12h14" /><path d="M12 5v14" /></>),
  CalendarDays: glyph(<><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></>),
  Timer: glyph(<><line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" /></>),
  Receipt: glyph(<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" /></>),
  File: glyph(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></>),
  Image: glyph(<><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>),
};

// ---------------------------------------------------------------- status

export const STATUS_LABEL: Record<TaskStatus, StringKey> = {
  not_started: "status_not_started",
  draft: "status_draft",
  submitted: "status_submitted",
  in_review: "status_in_review",
  overdue: "status_overdue",
  closed: "status_closed",
};

/** Colour of the status glyph / label text. */
export const STATUS_INK: Record<TaskStatus, string> = {
  not_started: "text-[#6E6E76] dark:text-[#8A8A90]",
  draft: "text-[#B45309] dark:text-[#F5B547]",
  submitted: "text-[#15803D] dark:text-[#4ADE80]",
  in_review: "text-[#4F46E5] dark:text-[#A5B4FC]",
  overdue: "text-[#D92D33] dark:text-[#FF7A7F]",
  closed: "text-[#5F5F66] dark:text-[#A1A1A6]",
};

/** Soft surface for status headers / pills. */
export const STATUS_SOFT: Record<TaskStatus, string> = {
  not_started: "bg-[#F4F4F5] dark:bg-white/[0.05]",
  draft: "bg-[#FEF4DF] dark:bg-[#F5B547]/[0.11]",
  submitted: "bg-[#E7F6EC] dark:bg-[#4ADE80]/[0.09]",
  in_review: "bg-[#EEF0FF] dark:bg-[#A5B4FC]/[0.11]",
  overdue: "bg-[#FDECEC] dark:bg-[#FF7A7F]/[0.11]",
  closed: "bg-[#EFEFF1] dark:bg-white/[0.04]",
};

export const isDone = (s: TaskStatus) => s === "submitted" || s === "in_review";

/** One glyph per server status; shape differs, not just colour. */
export function StatusGlyph({ status, className = "size-4" }: { status: TaskStatus; className?: string }) {
  const body = (() => {
    switch (status) {
      case "not_started":
        return <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />;
      case "draft":
        return (
          <>
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 3.75a4.25 4.25 0 0 1 0 8.5z" fill="currentColor" />
          </>
        );
      case "submitted":
        return (
          <>
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path d="m5.1 8.2 1.9 1.9 3.9-4" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case "in_review":
        return (
          <>
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <circle cx="5" cy="8" r="1.05" fill="white" />
            <circle cx="8" cy="8" r="1.05" fill="white" />
            <circle cx="11" cy="8" r="1.05" fill="white" />
          </>
        );
      case "overdue":
        return (
          <>
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path d="M8 4.4v4.3" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="8" cy="11.3" r="1" fill="white" />
          </>
        );
      case "closed":
        return (
          <>
            <rect x="3.6" y="7.1" width="8.8" height="6.4" rx="1.6" fill="currentColor" />
            <path d="M5.6 7.1V5.6a2.4 2.4 0 0 1 4.8 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${STATUS_INK[status]} ${className}`} aria-hidden>
      {body}
    </svg>
  );
}

// ---------------------------------------------------------------- data helpers

export function courseMap(data: DesignData): Map<string, Course> {
  return new Map(data.courses.map((c) => [c.code, c]));
}
/** SIX is the source of truth for course names; EduNex's English name is a fallback. */
export function courseName(courses: Map<string, Course>, code: string, fallback: string): string {
  return courses.get(code)?.name ?? fallback;
}
export function courseColor(courses: Map<string, Course>, code: string): string {
  return courses.get(code)?.color ?? "#8E8E93";
}
export function byDue(a: Task, b: Task): number {
  return (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
}

const PROVIDERS: Record<string, string> = {
  "ms-teams": "Microsoft Teams",
  zoom: "Zoom",
  "google-meet": "Google Meet",
  cloudx: "CloudX",
  webex: "Webex",
};
export function providerName(provider: string | null): string | null {
  return provider ? (PROVIDERS[provider] ?? provider) : null;
}
export function fileExt(name: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  return m ? m[1].toUpperCase() : "";
}
