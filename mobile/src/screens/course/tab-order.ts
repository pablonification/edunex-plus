// The course page's tabs, in the order this visit shows them (./course-screen.tsx). A course at risk leads with
// Pertemuan; the order is picked once, when the page is first drawn with its attendance, and kept for the visit: a
// count arriving or changing later never moves the page from the tab the Student is reading.
import { useRef } from "react";
import type { AttendanceState } from "../../../../src/core/attendance";

export const TABS = ["modules", "meetings", "tasks", "grades", "announcements"] as const;
export type Tab = (typeof TABS)[number];
/** A course at risk leads with its meetings (Pertemuan: which were missed, which are left), then the rest in order. */
const AT_RISK_TABS: readonly Tab[] = ["meetings", "modules", "tasks", "grades", "announcements"];

export const tabsFor = (state: AttendanceState | undefined): readonly Tab[] =>
  state === "out" || state === "none" || state === "risk" || state === "missed" ? AT_RISK_TABS : TABS;

/** `ready`: the page is drawn and its attendance read (or known to be missing); from then on this course's order stays. */
export function useVisitTabs(code: string, state: AttendanceState | undefined, ready: boolean): readonly Tab[] {
  const pinned = useRef<{ code: string; order: readonly Tab[] } | null>(null);
  if (pinned.current?.code === code) return pinned.current.order;
  const order = tabsFor(state);
  if (ready) pinned.current = { code, order };
  return order;
}
