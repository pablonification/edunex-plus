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
    // Tabs that don't fit the width (a narrow window, zoomed in) scroll sideways in their own frame, each name on
    // one line, instead of being cut at the window's edge. The frame reaches 4px past the list on every side, its
    // margins taking that back, so a tab's focus ring and the underline's pixel on the hairline aren't clipped.
    <div className="-m-1 overflow-x-auto overflow-y-hidden p-1">
      <Tabs.List
        aria-label={label}
        // The list itself never scrolls (its frame does), so the underline can cover the list's own hairline.
        className={cx("relative flex w-max min-w-full gap-6", className, "overflow-visible")}
      >
        {/* One pixel lower than the list, so it covers the hairline under the tabs (the list's own, or its frame's).
            High contrast drops backgrounds: there it keeps its own, in the system's text color, so the pick still shows. */}
        <SlidingHighlight
          active={value}
          shape="underline"
          className="-bottom-px h-0.5 rounded-full bg-fg forced-color-adjust-none forced-colors:bg-[CanvasText]"
        />
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            data-highlight={tab.value}
            className={cx(
              "focus-ring relative flex shrink-0 items-center rounded-t-sm font-medium whitespace-nowrap text-muted transition-colors duration-150 hover:text-fg data-[state=active]:text-fg",
              SIZE[size],
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="text-small font-medium text-faint tabular-nums">{tab.count}</span>}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </div>
  );
}
