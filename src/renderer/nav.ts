import { NAV_VIEWS, type NavKey } from "@shared/shell";

/**
 * Curated rail metadata: the views come from the shared contract (the
 * application menu's ⌘1–6 maps over the same list), and this file adds the
 * renderer-only chrome — icons and placeholder copy naming the ticket each
 * surface lands in. No EduNex data reaches the shell until those slices.
 */
const META: Record<NavKey, { icon: string; placeholder: string }> = {
  home: {
    icon: "ri-home-5-line",
    placeholder:
      "The shell is live — native window chrome, menu shortcuts, tray and notifications. No EduNex account is connected yet; surfaces below arrive slice by slice.",
  },
  todo: {
    icon: "ri-checkbox-line",
    placeholder: "Your aggregated pending Tasks and Exams will live here (#21).",
  },
  agenda: {
    icon: "ri-calendar-line",
    placeholder: "The course agenda with Vicon tags for online meetings will live here (#28).",
  },
  presence: {
    icon: "ri-hand-heart-line",
    placeholder: "Your Presence records per course will live here (#29).",
  },
  materials: {
    icon: "ri-folder-3-line",
    placeholder: "Course materials with download will live here (#30).",
  },
  exams: {
    icon: "ri-file-list-3-line",
    placeholder: "The read-only exams list will live here (#27).",
  },
};

export const NAV_ITEMS = NAV_VIEWS.map((view) => ({ ...view, ...META[view.key] }));

export type { NavKey };

export function navItem(key: NavKey) {
  return NAV_ITEMS.find((item) => item.key === key)!;
}
