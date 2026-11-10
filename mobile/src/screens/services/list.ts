// Every service the phone app has, as data (direction B): one word, a filled Fluent glyph, a colour of its own within
// its group, and the screen it opens (a screen the app already has). Beranda's grid shows the first seven and
// "Lainnya"; Semua layanan shows them all, in named groups.
import type { StringKey } from "../../../../src/core/strings";
import type { Route } from "../../nav";
import type { ServiceTone } from "../../ui/b";
import type { FluentName } from "../../ui/fluent";

export interface Service {
  id: string;
  label: StringKey;
  icon: FluentName;
  tone: ServiceTone;
  /** A tab or a screen the window names (`Route`), or a path of the phone's own. */
  open: Route | `/${string}`;
}

const presence: Service = { id: "presence", label: "nav.presence", icon: "CalendarCheckmark28Filled", tone: "green", open: { screen: "presence" } };
const grades: Service = { id: "grades", label: "nav.grades", icon: "Ribbon28Filled", tone: "amber", open: { screen: "grades" } };
const krs: Service = { id: "krs", label: "plan.tab.krs", icon: "Form28Filled", tone: "indigo", open: { screen: "plan", tab: "krs" } };
const bills: Service = { id: "bills", label: "plan.tab.bills", icon: "Wallet28Filled", tone: "teal", open: { screen: "plan", tab: "bills" } };
const calendar: Service = {
  id: "calendar",
  label: "mobile.service.calendar",
  icon: "CalendarLtr28Filled",
  tone: "blue",
  open: { screen: "plan", tab: "deadlines" },
};
const planner: Service = { id: "planner", label: "plan.tab.planner", icon: "HatGraduation28Filled", tone: "magenta", open: { screen: "plan", tab: "planner" } };
const curriculum: Service = {
  id: "curriculum",
  label: "plan.tab.curriculum",
  icon: "Library28Filled",
  tone: "lime",
  open: { screen: "plan", tab: "curriculum" },
};

/** Beranda's grid, in order; "Lainnya" follows them. */
export const HOME_SERVICES: readonly Service[] = [presence, grades, krs, bills, calendar, planner, curriculum];

export const SERVICE_GROUPS: readonly { id: string; title: StringKey; services: readonly Service[] }[] = [
  {
    id: "daily",
    title: "mobile.services.group.daily",
    services: [
      { id: "schedule", label: "nav.schedule", icon: "CalendarAgenda28Filled", tone: "blue", open: { screen: "schedule" } },
      { id: "tasks", label: "mobile.tab.tasks", icon: "TextBulletListSquare28Filled", tone: "indigo", open: { screen: "tasks" } },
      { id: "courses", label: "mobile.tab.courses", icon: "BookOpen28Filled", tone: "magenta", open: "/courses" },
      presence,
      { id: "month", label: "mobile.service.month", icon: "CalendarMonth28Filled", tone: "teal", open: "/schedule-month" },
      { id: "needs", label: "mobile.service.needs", icon: "Warning28Filled", tone: "red", open: "/needs" },
    ],
  },
  { id: "academic", title: "mobile.services.group.academic", services: [grades, krs, bills, calendar, planner, curriculum] },
  {
    id: "app",
    title: "mobile.services.group.app",
    services: [
      { id: "alerts", label: "alerts.title", icon: "Alert28Filled", tone: "amber", open: "/alerts" },
      { id: "settings", label: "nav.settings", icon: "Settings28Filled", tone: "grey", open: "/settings" },
      { id: "report", label: "mobile.service.report", icon: "PersonFeedback28Filled", tone: "green", open: "/report" },
      { id: "scan", label: "mobile.service.scan", icon: "Sparkle28Filled", tone: "lime", open: "/first-scan" },
    ],
  },
];
