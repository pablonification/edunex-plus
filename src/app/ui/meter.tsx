// Meters that answer a question at a glance, in status colors only (never a
// course's): where attendance stands against the target, with the best still
// reachable as a ghost; and how much time a window has left, shrinking, amber
// in its last minutes.
import { cx } from "./cx";

export type MeterTone = "success" | "warning" | "danger" | "neutral";

// The meter colors, not the tones' text colors (amber text is brown); each reads 3:1 on the track.
const FILL: Record<MeterTone, string> = {
  success: "var(--meter-success)",
  warning: "var(--meter-warning)",
  danger: "var(--danger-fg)",
  neutral: "var(--faint)",
};

/**
 * A share (0–100) against a target: the share filled, the best still
 * reachable as a lighter part after it, a tick at the target. When the best
 * stops short of the tick, the target is out of reach: the bar shows it.
 */
export function ShareMeter({
  share,
  best,
  target,
  tone,
  label,
  className,
}: {
  share: number;
  /** The share if every remaining meeting is attended (0–100). */
  best?: number | null;
  target: number;
  tone: MeterTone;
  label: string;
  className?: string;
}) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const fill = FILL[tone];
  return (
    <span role="img" aria-label={label} data-tone={tone} className={cx("relative block h-1.5 rounded-full bg-meter-track", className)}>
      {best != null && best > share && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full opacity-30 motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${clamp(best)}%`, background: fill }}
        />
      )}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full motion-safe:transition-[width] motion-safe:duration-500"
        style={{ width: `${clamp(share)}%`, background: fill }}
      />
      <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-fg" style={{ left: `${clamp(target)}%` }} />
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
