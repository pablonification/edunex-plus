// The counts beside the sidebar's places. Kept apart from the screens, so the
// sidebar can count before a screen's own code has loaded.
import { useMemo } from "react";
import { billNeedsStudent, krsNeedsStudent, krsOverlaps } from "../../core/academic";
import { needsAttention } from "../../core/attendance";
import { isOpenStatus, taskStatus } from "../../core/tasks";
import { useAttendance } from "../attendance";
import { useDeadlines } from "../deadlines";
import { useNow } from "../i18n";
import { useDataset } from "../store";
import { builtPlanTabs, type PlanTab } from "./built";

export type Badge = { value: number; tone: "neutral" | "warning" } | null;

const DAY = 24 * 60 * 60_000;

/** Tugas & Ujian: Tasks still to hand in; amber when one is late or due within a day. */
export function useTasksBadge(): Badge {
  const tasks = useDataset("edunex.tasks");
  const now = useNow();
  return useMemo(() => {
    if (!Array.isArray(tasks)) return null;
    let value = 0;
    let urgent = false;
    for (const task of tasks) {
      const status = taskStatus(task, now);
      if (!isOpenStatus(status)) continue;
      value += 1;
      if (status === "overdue" || (task.dueAt !== null && task.dueAt - now < DAY)) urgent = true;
    }
    return value ? { value, tone: urgent ? "warning" : "neutral" } : null;
  }, [tasks, now]);
}

/** Presensi: courses that need the Student (no absences left, or the target out of reach). */
export function usePresenceBadge(): Badge {
  const attendance = useAttendance();
  const value = attendance?.courses.filter((c) => needsAttention(c.health.state)).length ?? 0;
  return value > 0 ? { value, tone: "warning" } : null;
}

/** UKT: bills overdue or due within a week. */
function useBillsBadge(): Badge {
  const bills = useDataset("six.bills");
  const now = useNow();
  const value = bills?.filter((bill) => billNeedsStudent(bill, now)).length ?? 0;
  return value > 0 ? { value, tone: "warning" } : null;
}

/**
 * KRS: amber only for a step the Student must take today (send the KRS). A
 * clash still to come counts in a neutral badge: worth a question to the
 * lecturer, not a deadline.
 */
function useKrsBadge(): Badge {
  const plan = useDataset("six.krs");
  const calendar = useDataset("itb.calendar");
  const schedule = useDataset("six.schedule") ?? [];
  const now = useNow();
  if (!plan) return null;
  if (krsNeedsStudent(plan, calendar, now)) return { value: 1, tone: "warning" };
  const value = krsOverlaps(
    plan.courses.map((c) => c.code),
    schedule,
    now,
  ).filter((o) => o.upcoming).length;
  return value > 0 ? { value, tone: "neutral" } : null;
}

/** Kalender akademik: the questionnaire running now, as SIX hides grades until it's filled. (KRS and UKT count in their own tabs.) */
function useDeadlinesBadge(): Badge {
  const { upcoming } = useDeadlines();
  const value = upcoming.filter((d) => d.when === "now" && d.event.kind === "questionnaire").length;
  return value > 0 ? { value, tone: "warning" } : null;
}

const noBadge = (): Badge => null;

const PLAN_BADGES: Readonly<Record<PlanTab, () => Badge>> = {
  planner: noBadge,
  curriculum: noBadge,
  krs: useKrsBadge,
  bills: useBillsBadge,
  deadlines: useDeadlinesBadge,
};

/** Rencana studi: its tabs' counts together, what needs the Student (warnings) first. */
export function usePlanBadge(): Badge {
  // The tabs are fixed, so every tab's hook runs on every render, in the same order.
  const badges = builtPlanTabs.map((tab) => PLAN_BADGES[tab]()).filter((badge): badge is NonNullable<Badge> => badge !== null);
  const warnings = badges.filter((badge) => badge.tone === "warning");
  const pick = warnings.length ? warnings : badges;
  if (!pick.length) return null;
  return { value: pick.reduce((sum, badge) => sum + badge.value, 0), tone: warnings.length ? "warning" : "neutral" };
}
