// The course page's tabs, in the order this visit shows them (./course-screen.tsx). Every course leads with Modul, the
// material a Student opens a course for (round 3: a student couldn't find this week's material when a course at risk
// led with Pertemuan; its attendance is in the header's meter anyway). The order is picked once per visit and kept.
import { useRef } from "react";
import type { AttendanceState } from "../../../../src/core/attendance";

export const TABS = ["modules", "meetings", "tasks", "grades", "announcements"] as const;
export type Tab = (typeof TABS)[number];
/** Modul first for every course, whatever its attendance (the header's meter says that). */
export const tabsFor = (_state: AttendanceState | undefined): readonly Tab[] => TABS;

/** `ready`: the page is drawn and its attendance read (or known to be missing); from then on this course's order stays. */
export function useVisitTabs(code: string, state: AttendanceState | undefined, ready: boolean): readonly Tab[] {
  const pinned = useRef<{ code: string; order: readonly Tab[] } | null>(null);
  if (pinned.current?.code === code) return pinned.current.order;
  const order = tabsFor(state);
  if (ready) pinned.current = { code, order };
  return order;
}
