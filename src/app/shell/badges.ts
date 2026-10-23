// The counts beside the sidebar's places. Kept apart from the screens, so the
// sidebar can count before a screen's own code has loaded.
import { useMemo } from "react";
import { billNeedsStudent, krsNeedsStudent, krsOverlaps } from "../../core/academic";
import { resultNeedsStudent } from "../../core/attendance";
import { checkingIn } from "../../core/check-in";
import { activeDone, billDoneKey } from "../../core/done";
import { todoCount, todoUrgent } from "../../core/todo";
import { useAttendance } from "../attendance";
import { useDeadlines } from "../deadlines";
import { useNow } from "../i18n";
import { useTodo } from "../schedule-data";
import { useDataset } from "../store";
import { builtPlanTabs, type PlanTab } from "./built";

export type Badge = { value: number; tone: "neutral" | "warning" } | null;

/**
 * Tugas & Ujian: the same number as its "Belum selesai" (Tasks, take-homes and
 * exams with a day still ahead; never an exam period, nor a Task the Student
 * put away: handed in another way, by the group, not at all); amber when one
 * is late or runs out (or starts) within a day.
 */
export function useTasksBadge(): Badge {
  const todo = useTodo();
  return useMemo(() => {
    if (!todo) return null;
    const value = todoCount(todo.items);
    return value ? { value, tone: todoUrgent(todo.items, todo.now) ? "warning" : "neutral" } : null;
  }, [todo]);
}

/**
 * Presensi: what needs the Student now: Tandai Hadir open in SIX, an Edunex
 * window open that may count, a class SIX's count didn't go up after. A
 * course standing with no absences left (or out of reach) is said on the
 * screen and on the day, not counted here for the rest of the term.
 */
export function usePresenceBadge(): Badge {
  const attendance = useAttendance();
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const now = useNow();
  if (!attendance) return null;
  const codes = new Set(attendance.courses.map((c) => c.course.code));
  const open = student ? attendance.schedule.filter((s) => checkIns?.[s.id]?.state === "open" && checkingIn(s, now)).length : 0;
  const windows = attendance.open.filter((w) => w.counts).length;
  const results = Object.values(attendance.results).filter((r) => codes.has(r.courseCode) && resultNeedsStudent(r, attendance.countLog, now)).length;
  const value = open + windows + results;
  return value > 0 ? { value, tone: "warning" } : null;
}

/** UKT: bills overdue or due within a week, unless marked paid where SIX doesn't show it yet. */
function useBillsBadge(): Badge {
  const bills = useDataset("six.bills");
  const handled = useDataset("local.done") ?? [];
  const now = useNow();
  const paid = (bill: NonNullable<typeof bills>[number]) =>
    bill.nextDueAt !== null && activeDone(billDoneKey(bill, bill.nextDueAt < now), handled) !== undefined;
  const value = bills?.filter((bill) => billNeedsStudent(bill, now) && !paid(bill)).length ?? 0;
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
