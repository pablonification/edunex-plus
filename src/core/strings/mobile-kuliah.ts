// Text only the Android app shows on Kuliah, a course's page and a module (round 2, v4). Written with the copywriting
// skill. Each screen has its own block, so the three can grow apart without stepping on each other.
import type { Entry } from "./entry";

export const mobileKuliahStrings = {
  // Kuliah (the tab).
} as const satisfies Record<string, Entry>;

export const mobileCourseStrings = {
  // A course's page.
} as const satisfies Record<string, Entry>;

export const mobileModuleStrings = {
  // A module.
} as const satisfies Record<string, Entry>;
