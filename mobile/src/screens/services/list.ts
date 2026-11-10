// Every service the phone app has, as data (mobile/qa/superapp-decisions.md): a name, one filled Fluent glyph that no
// other service and no tab uses, a colour of its own within its group, and the screen it opens (a screen the app
// already has, or a new view of data it already reads). Beranda's grid shows the first seven and "Lainnya"; Semua
// layanan shows each service once, in three named groups. A service keeps its glyph and colour wherever it shows.
// The tabs (Jadwal, Tugas, Kuliah) aren't services: they're one tap away on every screen.
import type { StringKey } from "../../../../src/core/strings";
import type { Route } from "../../nav";
import type { ServiceGlyph, ServiceTone } from "../../ui/b";

export interface Service {
  id: string;
  label: StringKey;
  icon: ServiceGlyph;
  tone: ServiceTone;
  /** A tab or a screen the app names (`Route`: the window's, and the phone's Materi and Ujian), or a path of the phone's own. */
  open: Route | `/${string}`;
}

// Harian: what a Student opens in a normal week.
const material: Service = { id: "material", label: "mobile.service.material", icon: "Materials", tone: "blue", open: { screen: "material" } };
const exams: Service = { id: "exams", label: "mobile.service.exams", icon: "Exams", tone: "red", open: { screen: "exams" } };
const presence: Service = { id: "presence", label: "nav.presence", icon: "Attendance", tone: "green", open: { screen: "presence" } };
const month: Service = { id: "month", label: "mobile.service.month", icon: "CalendarMonth28Filled", tone: "indigo", open: "/schedule-month" };
const needs: Service = { id: "needs", label: "mobile.service.needs", icon: "Needs", tone: "amber", open: "/needs" };

// Akademik: the office.
const grades: Service = { id: "grades", label: "nav.grades", icon: "Grades", tone: "amber", open: { screen: "grades" } };
const krs: Service = { id: "krs", label: "plan.tab.krs", icon: "Krs", tone: "indigo", open: { screen: "plan", tab: "krs" } };
const bills: Service = { id: "bills", label: "plan.tab.bills", icon: "Bills", tone: "green", open: { screen: "plan", tab: "bills" } };
const calendar: Service = {
  id: "calendar",
  label: "mobile.service.calendar",
  icon: "AcademicCalendar",
  tone: "teal",
  open: { screen: "plan", tab: "deadlines" },
};
const planner: Service = { id: "planner", label: "plan.tab.planner", icon: "StudyPlan", tone: "magenta", open: { screen: "plan", tab: "planner" } };
const curriculum: Service = { id: "curriculum", label: "plan.tab.curriculum", icon: "Curriculum", tone: "lime", open: { screen: "plan", tab: "curriculum" } };

/**
 * Beranda's grid, in order: Materi, Ujian, Nilai, Kalender on the top row (a normal week), KRS, UKT, Rencana on the
 * bottom (the office); "Lainnya" (`MORE`) follows them. No two the same colour.
 */
export const HOME_SERVICES: readonly Service[] = [material, exams, grades, calendar, krs, bills, planner];

/** "Lainnya": the neutral tile with the 2×2 grid, the eighth on Beranda. It opens Semua layanan. */
export const MORE: Service = { id: "more", label: "mobile.tab.more", icon: "More", tone: "grey", open: "/services" };

export const SERVICE_GROUPS: readonly { id: string; title: StringKey; services: readonly Service[] }[] = [
  { id: "daily", title: "mobile.services.group.daily", services: [material, exams, presence, month, needs] },
  { id: "academic", title: "mobile.services.group.academic", services: [grades, krs, bills, calendar, planner, curriculum] },
  {
    id: "app",
    title: "mobile.services.group.app",
    services: [
      { id: "alerts", label: "alerts.title", icon: "Notifications", tone: "blue", open: "/alerts" },
      { id: "settings", label: "nav.settings", icon: "Settings", tone: "grey", open: "/settings" },
      { id: "report", label: "mobile.service.report", icon: "Report", tone: "magenta", open: "/report" },
      { id: "scan", label: "mobile.service.scan", icon: "FirstSummary", tone: "teal", open: "/first-scan" },
    ],
  },
];
