// Text only the Android app shows on Kuliah, a course's page and a module (round 2, v4). Written with the copywriting
// skill. Each screen has its own block, so the three can grow apart without stepping on each other.
import type { Entry } from "./entry";

export const mobileKuliahStrings = {
  // Kuliah (the tab). The big number's words, beside the count of courses it names.
  "mobile.kuliah.lead.out": {
    id: "mata kuliah tak bisa lagi capai {target}%",
    en: { one: "course can't reach {target}% anymore", other: "courses can't reach {target}% anymore" },
  },
  "mobile.kuliah.lead.outMixed": {
    id: "mata kuliah tak bisa lagi capai targetnya",
    en: { one: "course can't reach its target anymore", other: "courses can't reach their target anymore" },
  },
  "mobile.kuliah.lead.none": {
    id: "mata kuliah jatah absennya habis",
    en: { one: "course with no absences left", other: "courses with no absences left" },
  },
  "mobile.kuliah.lead.spare": {
    id: "mata kuliah masih ada jatah absen",
    en: { one: "course with an absence to spare", other: "courses with absences to spare" },
  },
  "mobile.kuliah.lead.missed": {
    id: "mata kuliah selesai di bawah target",
    en: { one: "course finished below its target", other: "courses finished below their target" },
  },
  "mobile.kuliah.lead.met": {
    id: "mata kuliah mencapai target",
    en: { one: "course reached its target", other: "courses reached their target" },
  },
  "mobile.kuliah.lead.courses": { id: "mata kuliah semester ini", en: { one: "course this term", other: "courses this term" } },
  // The sheet the big number opens: the day's answer, the target, and how it's counted.
  "mobile.kuliah.facts": { id: "Kehadiranmu", en: "Your attendance" },
  // Two of today's classes at once: a row, its pick as the chip; the reason is in its sheet.
  "mobile.kuliah.clash.title": { id: "Bentrok {time}", en: "Clash {time}" },
  "mobile.kuliah.clash.pick": { id: "Pilih {code}", en: "Go to {code}" },
} as const satisfies Record<string, Entry>;

export const mobileCourseStrings = {
  // A course's page.
} as const satisfies Record<string, Entry>;

export const mobileModuleStrings = {
  // A module. Under its materials, once: who posted them ("Dr. Hadi Halim, S.T., M.T."; two or more joined by " · ").
  "mobile.module.postedBy": { id: "Diunggah oleh {names}", en: "Posted by {names}" },
} as const satisfies Record<string, Entry>;
