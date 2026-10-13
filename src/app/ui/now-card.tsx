// What's happening now or next, the same on Beranda and a course page: a
// card with a time block on the left (where a colored stripe used to be),
// what it is with its facts, the one thing to do, and zones under it split
// by hairlines (the Presence window, what comes after). Raised while it
// matters now (a class on, a window open), plain otherwise. When nothing is
// on, a course page says what's next in one quiet line (NowLine).
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Card } from "./display";

export function NowCard({
  raised,
  time,
  eyebrow,
  title,
  meta,
  note,
  action,
  children,
}: {
  raised: boolean;
  /** Start and end as the Student reads them ("08:00", "10:00"); none for a window without a class. */
  time?: { start: string; end: string } | null;
  /** What state it's in: "Sedang berlangsung · sampai 10:00". */
  eyebrow: ReactNode;
  /** What it is: the course, or the meeting's topic. */
  title: ReactNode;
  /** Where and how: one quiet line of facts. */
  meta?: ReactNode;
  /** One line under the facts that changes what to do (a class moved). */
  note?: ReactNode;
  /** The one thing to do (and at most one quieter second). */
  action?: ReactNode;
  /** Zones under the head, each starting with a hairline (NowZone). */
  children?: ReactNode;
}) {
  return (
    <Card variant={raised ? "raised" : "plain"} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-stretch gap-4">
          {time && (
            <div className="flex w-[4.5rem] shrink-0 flex-col items-end border-r border-line pr-4 tabular-nums">
              <span className="text-title font-semibold">{time.start}</span>
              <span className="text-small text-muted">{time.end}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-small font-semibold">{eyebrow}</div>
            <div className="mt-0.5">{title}</div>
            {meta && <div className="mt-1 text-body text-muted">{meta}</div>}
            {note}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

/** A zone under a NowCard's head: a hairline above, a quiet background. */
export function NowZone({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("border-t border-line bg-sunken/60 px-5 py-3.5", className)}>{children}</div>;
}

/** One quiet line, under the card or instead of it (what's next, a window still open from an earlier class): an icon, the facts, at most one small action. */
export function NowLine({ icon, action, children }: { icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted">
      <span className="flex shrink-0 text-faint">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
