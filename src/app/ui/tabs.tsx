// The tab bar of a screen or dialog (a course, Rencana studi, adding a course
// to the plan): Radix's tab list and tabs, each with an optional count, and one
// underline that glides to the picked tab (SlidingHighlight, 150 ms). The
// screen keeps its own Tabs.Root and Tabs.Content around it: a tab's content
// swaps at once, only the underline moves.
import * as Tabs from "@radix-ui/react-tabs";
import { cx } from "./cx";
import { SlidingHighlight } from "./motion/sliding-highlight";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** A quiet figure after the name (how many modules, meetings); none when unknown. */
  count?: number;
}

const SIZE = {
  md: "h-10 gap-1.5 text-body",
  sm: "h-9 gap-1.5 text-small",
} as const;

export function TabBar<T extends string>({
  value,
  tabs,
  label,
  size = "md",
  className,
}: {
  /** The picked tab: the same value the screen's Tabs.Root holds. */
  value: T;
  tabs: readonly TabItem<T>[];
  label: string;
  /** md for a screen, sm inside a dialog. */
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <Tabs.List aria-label={label} className={cx("relative flex gap-6", className)}>
      {/* One pixel lower than the list, so it covers the hairline under the tabs (the list's own, or its frame's). */}
      <SlidingHighlight active={value} shape="underline" className="-bottom-px h-0.5 rounded-full bg-fg" />
      {tabs.map((tab) => (
        <Tabs.Trigger
          key={tab.value}
          value={tab.value}
          data-highlight={tab.value}
          className={cx(
            "focus-ring relative flex items-center rounded-t-sm font-medium text-muted transition-colors duration-150 hover:text-fg data-[state=active]:text-fg",
            SIZE[size],
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="text-small font-medium text-faint tabular-nums">{tab.count}</span>}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}
