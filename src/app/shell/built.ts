// Which screens and tabs are built (each screen's `ready` flag), for the
// parts of the shell that can link anywhere: quick search and the first-run
// scan only offer, or open, a screen that's there.
import type { Route } from "../../core/route";
import { ready as courseReady } from "../screens/course";
import { ready as examReady } from "../screens/exam";
import { ready as gradesReady } from "../screens/grades";
import { ready as planReady } from "../screens/plan";
import { ready as billsReady } from "../screens/plan/bills";
import { ready as curriculumReady } from "../screens/plan/curriculum";
import { ready as deadlinesReady } from "../screens/plan/deadlines";
import { ready as krsReady } from "../screens/plan/krs";
import { ready as plannerReady } from "../screens/plan/planner";
import { ready as presenceReady } from "../screens/presence";
import { ready as scheduleReady } from "../screens/schedule";
import { ready as tasksReady } from "../screens/tasks";

const PLAN_TABS: Readonly<Record<string, boolean>> = {
  planner: plannerReady,
  curriculum: curriculumReady,
  krs: krsReady,
  bills: billsReady,
  deadlines: deadlinesReady,
};

export function isBuilt(route: Route): boolean {
  switch (route.screen) {
    case "home":
      return true;
    case "tasks":
    case "task":
      return tasksReady;
    case "exam":
      return examReady;
    case "course":
      return courseReady;
    case "schedule":
      return scheduleReady;
    case "presence":
      return presenceReady;
    case "grades":
      return gradesReady;
    case "plan":
      return planReady && (route.tab === undefined || PLAN_TABS[route.tab] === true);
  }
}
