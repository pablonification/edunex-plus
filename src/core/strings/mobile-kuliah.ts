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
  // A course's page. Its tab for Tasks and exams, short enough for five tabs.
  "mobile.course.tab.tasks": { id: "Tugas", en: "Tasks" },
  // The course's attendance on one line under its title, before what's left of the absences ("85% hadir · Sisa 1×").
  "mobile.course.attended": { id: "{percent}% hadir", en: "{percent}% attended" },
  // The course's sheet: what's used and left of the absences under the desktop's label ("Jatah absen: terpakai 2× · habis").
  "mobile.course.budget": { id: "Jatah absen: {words}", en: "Absences: {words}" },
  "mobile.course.aboutHint": { id: "Buka rincian mata kuliah", en: "Opens the course's details" },
  // The one exception, in a few words on the card; the whole of it is in the sheet.
  "mobile.course.ex.uncounted": { id: "Ada yang tak tercatat?", en: "A class not counted?" },
  "mobile.course.ex.needed": { id: "Bergantung kuliah {date}", en: "Hangs on the class on {date}" },
  "mobile.course.ex.clash": { id: "Bentrok dengan {code}", en: "Clashes with {code}" },
  "mobile.course.ex.uncertain": { id: "Kuliah {date} mungkin tak ada", en: "The class on {date} may not run" },
  "mobile.course.ex.lab": { id: "Cek aturan praktikum", en: "Check the lab's rules" },
  // Tandai Hadir not on SIX yet, or gone again, in a few words (Beranda's words before its sheet dropped them).
  "mobile.course.ex.waiting": { id: "Tandai Hadir belum muncul", en: "No Tandai Hadir yet" },
  "mobile.course.ex.gone": { id: "Tandai Hadir tak tampil lagi", en: "Tandai Hadir is gone" },
  // The class on now: when the Edunex Presence closes, and whether it counts.
  "mobile.course.presenceCloses": { id: "Presensi tutup {time}", en: "Presence closes {time}" },
  "mobile.course.optional": { id: "Tidak wajib", en: "Not required" },
  "mobile.course.mayNotCount": { id: "Belum pasti dihitung", en: "May not count" },
  // The course's sheet: its target, changed in place.
  "mobile.course.target": { id: "Target kehadiran", en: "Attendance target" },
  // The grade calculator. Example weights in one line (the banner opens the course contract when there is one).
  "mobile.grade.example": { id: "Contoh bobot, bukan bobot {code}", en: "Example weights, not {code}'s" },
  // The answer as a number: "74" big, then "untuk A", then where that average is needed.
  "mobile.grade.needFor": { id: "untuk {letter}", en: "for {letter}" },
  "mobile.grade.needOn": { id: "Rata-rata di {parts}", en: "Average on {parts}" },
  // A part's long-press menu (and its screen-reader actions).
  "mobile.grade.rename": { id: "Ganti nama", en: "Rename" },
  "mobile.grade.remove": { id: "Hapus", en: "Remove" },
  "mobile.grade.removed": { id: "{part} dihapus", en: "{part} removed" },
} as const satisfies Record<string, Entry>;

export const mobileModuleStrings = {
  // A module. Under its materials, once: who posted them ("Dr. Hadi Halim, S.T., M.T."; two or more joined by " · ").
  "mobile.module.postedBy": { id: "Diposting oleh {names}", en: "Posted by {names}" },
} as const satisfies Record<string, Entry>;
