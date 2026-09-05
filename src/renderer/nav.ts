/**
 * Curated rail metadata for the shell slice (#32). Keys and labels follow the
 * v1 scope (#6) and CONTEXT.md language (To Do, Presence, Task — never
 * "assignment"/"attendance"). The placeholder copy names the ticket each
 * surface lands in; no EduNex data reaches the shell until those slices.
 */
export const NAV_ITEMS = [
  {
    key: "home",
    label: "Home",
    icon: "ri-home-5-line",
    placeholder:
      "The app shell is live — floating sidebar, content panel, tray and notifications. No EduNex account is connected yet; surfaces below arrive slice by slice.",
  },
  {
    key: "todo",
    label: "To Do",
    icon: "ri-checkbox-line",
    placeholder: "Your aggregated pending Tasks and Exams will live here (#21).",
  },
  {
    key: "agenda",
    label: "Agenda",
    icon: "ri-calendar-line",
    placeholder: "The course agenda with Vicon tags for online meetings will live here (#28).",
  },
  {
    key: "presence",
    label: "Presence",
    icon: "ri-hand-heart-line",
    placeholder: "Your Presence records per course will live here (#29).",
  },
  {
    key: "materials",
    label: "Materials",
    icon: "ri-folder-3-line",
    placeholder: "Course materials with download will live here (#30).",
  },
  {
    key: "exams",
    label: "Exams",
    icon: "ri-file-list-3-line",
    placeholder: "The read-only exams list will live here (#27).",
  },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];

export function navItem(key: NavKey) {
  return NAV_ITEMS.find((item) => item.key === key)!;
}
