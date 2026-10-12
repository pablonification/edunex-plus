// Meters that answer a question at a glance, in status colors only (never a
// course's): where attendance stands against the target, with the best still
// reachable as a ghost; and how much time a window has left, shrinking, amber
// in its last minutes.
import { cx } from "./cx";

export type MeterTone = "success" | "warning" | "danger" | "neutral";

const FILL: Record<MeterTone, string> = {
  success: "var(--live)",
  warning: "var(--warning-fg)",
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
    <span role="img" aria-label={label} className={cx("relative block h-1.5 rounded-full bg-black/[0.07] dark:bg-white/[0.09]", className)}>
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
  className,
}: {
  opensAt: number;
  closesAt: number;
  now: number;
  label: string;
  className?: string;
}) {
  const left = Math.max(0, Math.min(1, (closesAt - now) / Math.max(1, closesAt - opensAt)));
  const soon = closesAt - now < 15 * 60_000;
  return (
    <span className={cx("flex items-center gap-3", className)}>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left * 100)}
        className="block h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.09]"
      >
        <span
          className={cx("block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500", soon ? "bg-warning-fg" : "bg-accent")}
          style={{ width: `${left * 100}%` }}
        />
      </span>
      <span className={cx("shrink-0 text-small font-semibold tabular-nums", soon ? "text-warning-fg" : "text-muted")}>{label}</span>
    </span>
  );
}
