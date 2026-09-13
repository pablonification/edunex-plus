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
    placeholder: "Your current Period courses and pending To Do items appear here.",
  },
  todo: {
    icon: "ri-checkbox-line",
    placeholder: "Your aggregated pending Tasks and Exams appear here.",
  },
  agenda: {
    icon: "ri-calendar-line",
    placeholder: "Your scheduled course meetings, with Vicon tags on online sessions.",
  },
  presence: {
    icon: "ri-hand-heart-line",
    placeholder: "Your attendance records per course meeting, read-only.",
  },
  materials: {
    icon: "ri-folder-3-line",
    placeholder: "Your course files with download live here.",
  },
  exams: {
    icon: "ri-file-list-3-line",
    placeholder: "Your scheduled exams, read-only.",
  },
};

export const NAV_ITEMS = NAV_VIEWS.map((view) => ({ ...view, ...META[view.key] }));

export type { NavKey };

export function navItem(key: NavKey) {
  return NAV_ITEMS.find((item) => item.key === key)!;
}
