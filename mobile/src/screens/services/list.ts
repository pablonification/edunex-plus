// Every service the phone app has, as data (mobile/qa/superapp-decisions.md): a name, one filled Fluent glyph that no
// other service and no tab uses, a colour, and the screen it opens (a screen the app already has, or a new view of
// data it already reads). Beranda's grid shows the first seven and "Lainnya"; Semua layanan shows each service once,
// in three named groups. A service keeps its glyph and colour wherever it shows.
//
// Colour by one rule a student can guess: a solid colour is one of Beranda's seven (none red or amber: those are
// states' colours; none violet: the class on now may be), and every other service is the app's own pale blue with a
// blue glyph (the tone still named `grey`), so every tile looks alive and no colour ever stands for two services
// (test/mobile/contrast.test.ts, "service colours by the rule").
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
const exams: Service = { id: "exams", label: "mobile.service.exams", icon: "Exams", tone: "rose", open: { screen: "exams" } };
const presence: Service = { id: "presence", label: "nav.presence", icon: "Attendance", tone: "grey", open: { screen: "presence" } };
const month: Service = { id: "month", label: "mobile.service.month", icon: "Month", tone: "grey", open: "/schedule-month" };
const needs: Service = { id: "needs", label: "mobile.service.needs", icon: "Needs", tone: "grey", open: "/needs" };

// Akademik: the office.
const grades: Service = { id: "grades", label: "nav.grades", icon: "Grades", tone: "orange", open: { screen: "grades" } };
const krs: Service = { id: "krs", label: "plan.tab.krs", icon: "Krs", tone: "magenta", open: { screen: "plan", tab: "krs" } };
const bills: Service = { id: "bills", label: "plan.tab.bills", icon: "Bills", tone: "gold", open: { screen: "plan", tab: "bills" } };
const calendar: Service = {
  id: "calendar",
  label: "mobile.service.calendar",
  icon: "AcademicCalendar",
  tone: "teal",
  open: { screen: "plan", tab: "deadlines" },
};
const planner: Service = { id: "planner", label: "plan.tab.planner", icon: "StudyPlan", tone: "green", open: { screen: "plan", tab: "planner" } };
const scan: Service = { id: "scan", label: "mobile.service.scan", icon: "FirstSummary", tone: "grey", open: "/first-scan" };
const curriculum: Service = { id: "curriculum", label: "plan.tab.curriculum", icon: "Curriculum", tone: "grey", open: { screen: "plan", tab: "curriculum" } };

/**
 * Beranda's grid, in order: Materi (blue), Ujian (rose), Nilai (orange), Kalender (teal) on the top row (a normal
 * week), KRS (magenta), UKT (gold), Rencana (green) on the bottom (the office); "Lainnya" (`MORE`, the quiet pale
 * blue) follows them. No two the same colour, none red, amber or violet, one green, no neighbours of one lightness.
 */
export const HOME_SERVICES: readonly Service[] = [material, exams, grades, calendar, krs, bills, planner];

/** "Lainnya": the quiet pale-blue tile with the 2×2 grid, the eighth on Beranda. It opens Semua layanan. */
export const MORE: Service = { id: "more", label: "mobile.tab.more", icon: "More", tone: "grey", open: "/services" };

export const SERVICE_GROUPS: readonly { id: string; title: StringKey; services: readonly Service[] }[] = [
  // Rows that fill (4, 4 + 4, 3): fifteen services leave one row short, and it is the page's last, sitting left as a
  // grid ends, never a hole in the middle. "Ringkasan awal" (what the first read found of the Student's studies) sits
  // with Akademik; "Jadwal bulanan" by "Kalender" (both are a month to look at).
  { id: "daily", title: "mobile.services.group.daily", services: [material, exams, presence, needs] },
  { id: "academic", title: "mobile.services.group.academic", services: [grades, krs, bills, planner, curriculum, calendar, month, scan] },
  {
    id: "app",
    title: "mobile.services.group.app",
    services: [
      { id: "alerts", label: "alerts.title", icon: "Notifications", tone: "grey", open: "/alerts" },
      { id: "settings", label: "nav.settings", icon: "Settings", tone: "grey", open: "/settings" },
      { id: "report", label: "mobile.service.report", icon: "Report", tone: "grey", open: "/report" },
    ],
  },
];
