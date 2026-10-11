// Text for the Rencana studi screen's tabs (#79, #80).
import type { Entry } from "./entry";

export const planStrings = {
  "plan.tab.planner": { id: "Rencana", en: "Plan" },
  "plan.tab.curriculum": { id: "Kurikulum", en: "Curriculum" },
  "plan.tab.krs": { id: "KRS", en: "KRS" },
  "plan.tab.bills": { id: "UKT", en: "UKT" },
  "plan.tab.deadlines": { id: "Kalender akademik", en: "Academic calendar" },
} as const satisfies Record<string, Entry>;
