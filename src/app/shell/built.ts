// Which screens and tabs are built, for the parts of the shell that can link
// anywhere: the sidebar shows a screen once it's built, and quick search and
// the first-run scan only offer, or open, one that's there. Kept here rather
// than in each screen, so the shell can ask without loading the screens.
import type { Route } from "../../core/route";

const SCREENS: Readonly<Record<Route["screen"], boolean>> = {
  home: true,
  tasks: true,
  task: true,
  exam: true,
  course: true,
  schedule: true,
  presence: true,
  grades: true,
  plan: true,
};

/** Rencana studi's tabs, in their order. */
export const PLAN_TABS = ["planner", "curriculum", "krs", "bills", "deadlines"] as const;
export type PlanTab = (typeof PLAN_TABS)[number];

const PLAN_TAB_BUILT: Readonly<Record<PlanTab, boolean>> = {
  planner: true,
  curriculum: true,
  krs: true,
  bills: true,
  deadlines: true,
};

/** Rencana studi's tabs that are built; the screen shows once one is. */
export const builtPlanTabs: readonly PlanTab[] = PLAN_TABS.filter((tab) => PLAN_TAB_BUILT[tab]);

export function isBuilt(route: Route): boolean {
  if (route.screen === "plan") return builtPlanTabs.length > 0 && (route.tab === undefined || (builtPlanTabs as readonly string[]).includes(route.tab));
  return SCREENS[route.screen];
}
