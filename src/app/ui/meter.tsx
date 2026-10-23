// Meters that answer a question at a glance, in status colors only (never a
// course's): the absences a course's target allows this term, as the Student
// spends them; and how much time a window has left, shrinking, amber in its
// last minutes.
import { cx } from "./cx";

export type BarTone = "neutral" | "warning" | "danger";

// The meter colors, not the tones' text colors (amber text is brown); each reads 3:1 on a row, hovered too.
// Past the limit the bar itself is full, so amber: only what's over it is red.
const USED: Record<BarTone, string> = { neutral: "bg-muted", warning: "bg-meter-warning", danger: "bg-meter-warning" };
/** From this many segments the gaps go: one fill, split where the used part ends. */
const CONTINUOUS = 12;
/** The bar's width (px) at each size, and the gap between segments. */
const WIDTH = { sm: 96, md: 200 } as const;
const GAP = 2;
const LEFT_RING = "shadow-[inset_0_0_0_1.5px_var(--pip-ring)]";
const HATCH = { backgroundImage: "repeating-linear-gradient(135deg, var(--hatch) 0 2px, transparent 2px 4px)" };

/**
 * "Jatah absen": one segment per absence the course's target allows this
 * term, filled from the start as they're used, ringed while still left.
 * Full, it turns amber; misses past the limit sit after a short limit line,
 * red (the line says where the limit is, so color is never the only sign).
 * `estimate`: before SIX has a count, the timetable's allowance, hatched.
 * Always beside its words ("1 used · 1 left"), never alone; one picture with
 * a name, never a stop for the keyboard.
 * Nothing to draw (no absence allowed, none missed): nothing.
 */
export function AbsenceBar({
  allowed,
  used,
  over = 0,
  tone,
  estimate = false,
  size = "sm",
  label,
  className,
}: {
  /** Segments in the bar: the limit. */
  allowed: number;
  /** Filled from the start (at most `allowed`). */
  used: number;
  /** Past the limit: after the limit line, red. */
  over?: number;
  tone: BarTone;
  estimate?: boolean;
  /** sm: a Presence row; md: the course page's header and Home's course cards (the card's width, up to it). */
  size?: "sm" | "md";
  label: string;
  className?: string;
}) {
  if (allowed <= 0 && over <= 0) return null;
  const filled = estimate ? 0 : Math.min(used, allowed);
  // An over segment is as wide as one of the bar's own, while they all fit in half the bar's width again.
  const own = allowed > 0 ? (WIDTH[size] - GAP * (allowed - 1)) / allowed : WIDTH[size] / 4;
  const segment = over > 0 ? Math.max(6, Math.min(own, (WIDTH[size] / 2 - GAP * (over - 1)) / over)) : own;
  const height = size === "sm" ? "h-2" : "h-2.75";
  const state = (i: number) => (estimate ? "estimate" : i < filled ? "used" : "left");
  return (
    <span role="img" aria-label={label} data-tone={tone} className={cx("inline-flex max-w-full items-center gap-0.5 align-middle", className)}>
      {allowed > 0 &&
        (allowed < CONTINUOUS ? (
          <span aria-hidden className={cx("flex min-w-0 shrink gap-0.5", size === "sm" ? "w-24" : "w-50")}>
            {Array.from({ length: allowed }, (_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: segments are positions, nothing else tells them apart
                key={i}
                data-state={state(i)}
                className={cx("min-w-0 flex-1 rounded-xs transition-colors duration-150", height, state(i) === "used" ? USED[tone] : LEFT_RING)}
                style={estimate ? HATCH : undefined}
              />
            ))}
          </span>
        ) : (
          // Too many to tell apart: one fill, split at what's used. The words always say the numbers.
          <span
            aria-hidden
            data-state="continuous"
            className={cx("relative flex min-w-0 shrink overflow-hidden rounded-xs", height, LEFT_RING, size === "sm" ? "w-24" : "w-50")}
            style={estimate ? HATCH : undefined}
          >
            {filled > 0 && <span data-state="used" className={cx("h-full", USED[tone])} style={{ width: `${(filled / allowed) * 100}%` }} />}
          </span>
        ))}
      {over > 0 && (
        <>
          <span aria-hidden data-state="limit" className={cx("mx-0.5 w-0.5 shrink-0 rounded-full bg-fg", size === "sm" ? "h-3.5" : "h-4.25")} />
          {Array.from({ length: over }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: segments are positions, nothing else tells them apart
              key={i}
              aria-hidden
              data-state="over"
              className={cx("shrink-0 rounded-xs bg-danger-fg", height)}
              style={{ width: `${segment}px` }}
            />
          ))}
        </>
      )}
    </span>
  );
}

/** Time left in a window, shrinking as it runs out; amber in the last 15 minutes. `label` says how long is left. */
export function CountdownBar({
  opensAt,
  closesAt,
  now,
  label,
  showLabel = true,
  className,
}: {
  opensAt: number;
  closesAt: number;
  now: number;
  label: string;
  /** False when the words beside the bar already say it: the label stays the bar's name for screen readers. */
  showLabel?: boolean;
  className?: string;
}) {
  const left = Math.max(0, Math.min(1, (closesAt - now) / Math.max(1, closesAt - opensAt)));
  const soon = closesAt - now < 15 * 60_000;
  return (
    // With no room for the words beside the bar, they go under it, whole.
    <span className={cx("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left * 100)}
        className="block h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-meter-track"
      >
        {/* It moves every minute, so it slides (a transform) instead of changing width: full width, pushed
            left by the time gone. Sliding keeps its moving end round; the clipped track rounds the other. */}
        <span
          className={cx(
            "block h-full rounded-full motion-safe:transition-[translate] motion-safe:duration-(--duration-slow) motion-safe:ease-out",
            soon ? "bg-meter-warning" : "bg-accent",
          )}
          style={{ translate: `${(left - 1) * 100}% 0` }}
        />
      </span>
      {showLabel && <span className={cx("min-w-0 text-small font-semibold tabular-nums", soon ? "text-warning-fg" : "text-muted")}>{label}</span>}
    </span>
  );
}
