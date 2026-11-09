// Text only the Android app shows on Kuliah, a course's page and a module (round 2, v4). Written with the copywriting
// skill. Each screen has its own block, so the three can grow apart without stepping on each other.
import type { Entry } from "./entry";

export const mobileKuliahStrings = {
  // Kuliah (the tab).
  // The heading over the courses out of reach, with no absences left or finished below the target (round 3: the big
  // number became this heading, the meters on the rows say the rest).
  "mobile.kuliah.attention": { id: "Perlu perhatian", en: "Needs attention" },
  // A course's absences beside its meter (parts/attendance-meter.tsx): over the limit by how many, the red segments past
  // the line saying the rest. The whole sentence is the meter's accessible name.
  "mobile.absence.overShort": { id: "+{count}", en: "+{count}" },
  // A course Edunex alone records: present in how many of its closed Presence windows.
  "mobile.absence.edunex": { id: "Edunex {recorded}/{closed}", en: "Edunex {recorded}/{closed}" },
  // The quiet tick on a course SIX counted today, as TalkBack says it (the footer that listed the codes is gone).
  "mobile.kuliah.counted": { id: "Sudah dihitung di SIX hari ini", en: "Counted in SIX today" },
  "mobile.kuliah.countedLate": { id: "Akhirnya dihitung di SIX hari ini", en: "Counted in SIX today, after all" },
  // The sheet in ⋮: the day's answer, the target, and how it's counted.
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
  // The next class's room, as TalkBack says it (on screen: a pin and the room).
  "mobile.course.room": { id: "Ruang {room}", en: "Room {room}" },
  // The one exception, in a few words on the card; the whole of it is in the sheet. Out of reach, it's the desktop's
  // own words (presence.row.askLecturer).
  "mobile.course.ex.needed": { id: "Bergantung kuliah {date}", en: "Hangs on the class on {date}" },
  "mobile.course.ex.clash": { id: "Bentrok dengan {code}", en: "Clashes with {code}" },
  "mobile.course.ex.uncertain": { id: "Kuliah {date} mungkin tak ada", en: "The class on {date} may not run" },
  "mobile.course.ex.lab": { id: "Cek aturan praktikum", en: "Check the lab's rules" },
  // Tandai Hadir not on SIX yet, or gone again, in a few words (Beranda's words before its sheet dropped them).
  "mobile.course.ex.waiting": { id: "Tandai Hadir belum muncul", en: "No Tandai Hadir yet" },
  "mobile.course.ex.gone": { id: "Tandai Hadir tak tampil lagi", en: "Tandai Hadir is gone" },
  // The class on now: when the Edunex Presence closes, and whether it counts.
  "mobile.course.presenceCloses": { id: "Presensi tutup {time}", en: "Presence closes {time}" },
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
