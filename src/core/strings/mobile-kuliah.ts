// Text only the Android app shows on Kuliah, a course's page and a module (round 2, v4). Written with the copywriting
// skill. Each screen has its own block, so the three can grow apart without stepping on each other.
import type { Entry } from "./entry";

export const mobileKuliahStrings = {
  // Kuliah (the tab).
  // The headings over Kuliah's two cards (round 3, the blind review: one heading read as if it held all five): the
  // courses out of reach, with no absences left or finished below the target; then the rest, "Aman" when every one of
  // them has absences to spare or met its target, else (some with no count yet) "Lainnya".
  "mobile.kuliah.attention": { id: "Perlu perhatian", en: "Needs attention" },
  "mobile.kuliah.calm": { id: "Aman", en: "On track" },
  "mobile.kuliah.rest": { id: "Lainnya", en: "Others" },
  // A course Edunex alone records: present in how many of its closed Presence windows.
  "mobile.absence.edunex": { id: "Edunex {recorded}/{closed}", en: "Edunex {recorded}/{closed}" },
  // A finished course's share, where its absences used to be ("Selesai 85%"); the whole sentence is its spoken name.
  "mobile.absence.final": { id: "Selesai {percent}%", en: "Ended at {percent}%" },
  // The sheet in ⋮: the day's answer, the target, and how it's counted.
  "mobile.kuliah.facts": { id: "Kehadiranmu", en: "Your attendance" },
  // Two of today's classes at once: a row, the two courses by short name, and "Pilih kelas" opening the sheet that says
  // which to go to and why. With a pick but no why, the pick as a chip by the course's short name.
  "mobile.kuliah.clash.title": { id: "Bentrok {time}", en: "Clash {time}" },
  "mobile.kuliah.clash.choose": { id: "Pilih kelas", en: "Which class?" },
  "mobile.kuliah.clash.pick": { id: "Pilih {code}", en: "Go to {code}" },
  // superapp: Kuliah
  // What the "Isi Presensi" button says to a screen reader: it opens Edunex, where the Presence is marked.
  "mobile.kuliah.presenceLabel": { id: "Isi Presensi {course} di Edunex", en: "Fill in Presence for {course} in Edunex" },
  // A course's absences as a count, once, after its state ("Jatah absen habis", then "3 dari 3 absen"): used of allowed.
  "mobile.kuliah.absences": { id: "{used} dari {allowed} absen", en: "{used} of {allowed} absences" },
  // Kuliah's two headings, read top to bottom: what's on today (a Presence open, a clash), then the term's courses.
  "mobile.kuliah.today": { id: "Hari ini", en: "Today" },
  "mobile.kuliah.term": { id: "Semester ini", en: "This semester" },
} as const satisfies Record<string, Entry>;

export const mobileCourseStrings = {
  // A course's page. Its tab for Tasks and exams, short enough for five tabs.
  "mobile.course.tab.tasks": { id: "Tugas", en: "Tasks" },
  // The course's attendance on one line under its title, before what's left of the absences ("85% hadir · Sisa 1×").
  "mobile.course.attended": { id: "{percent}% hadir", en: "{percent}% attended" },
  // The course's sheet: what's used and left of the absences under the desktop's label ("Jatah absen: terpakai 2× · habis").
  "mobile.course.budget": { id: "Jatah absen: {words}", en: "Absences: {words}" },
  "mobile.course.aboutHint": { id: "Buka rincian mata kuliah", en: "Opens the course's details" },
  // Under the course's header when something new came to a module in the last 7 days: the way to this week's material
  // (Kuliah read as attendance only, and a Student couldn't find the materials). A tap opens that module.
  "mobile.course.newestModule": { id: "Modul terbaru: {title}", en: "Newest module: {title}" },
  // The next class's room, as TalkBack says it (on screen: a pin and the room).
  "mobile.course.room": { id: "Ruang {room}", en: "Room {room}" },
  // The one exception, in a few words on the card; the whole of it is in the sheet. Out of reach, it's the desktop's
  // own words (presence.row.askLecturer).
  "mobile.course.ex.needed": { id: "Bergantung kuliah {date}", en: "Hangs on the class on {date}" },
  // The other course by its short name ("Ekonomi Infrastruktur"), not its code (round 3, the blind review).
  "mobile.course.ex.clash": { id: "Bentrok dengan {course}", en: "Clashes with {course}" },
  "mobile.course.ex.uncertain": { id: "Kuliah {date} mungkin tak ada", en: "The class on {date} may not run" },
  "mobile.course.ex.lab": { id: "Cek aturan praktikum", en: "Check the lab's rules" },
  // Tandai Hadir not on SIX yet, or gone again, in a few words (Beranda's words before its sheet dropped them).
  "mobile.course.ex.waiting": { id: "Tandai Hadir belum muncul", en: "No Tandai Hadir yet" },
  "mobile.course.ex.gone": { id: "Tandai Hadir tak tampil lagi", en: "Tandai Hadir is gone" },
  // The class on now: when the Edunex Presence closes, and whether it counts.
  "mobile.course.presenceCloses": { id: "Presensi tutup {time}", en: "Presence closes {time}" },
  "mobile.course.mayNotCount": { id: "Belum pasti dihitung", en: "May not count" },
  // Pertemuan (round 3, after the blind reviews): the past meetings under their heading, newest first, each one's mark at
  // its row's end. SIX gives totals only: a mark comes from what SIX's count did after a class the app watched, or from
  // Edunex, else a quiet "Tak tercatat", its spoken name saying why. Where Edunex alone keeps the count, a meeting it
  // didn't record counts as absent ("Tidak hadir").
  "mobile.meeting.past": { id: "Sudah lewat", en: "Past" },
  "mobile.meeting.absent": { id: "Tidak hadir", en: "Absent" },
  "mobile.meeting.missing": { id: "Belum dihitung", en: "Not counted yet" },
  "mobile.meeting.untracked": { id: "Tak tercatat", en: "No record" },
  "mobile.meeting.countedSix": { id: "Dihitung hadir di SIX", en: "Counted present in SIX" },
  "mobile.meeting.absentSix": { id: "SIX mencatatmu tidak hadir", en: "SIX marked you absent" },
  "mobile.meeting.missingSix": { id: "SIX belum menghitung kuliah ini", en: "SIX hasn't counted this class yet" },
  "mobile.meeting.unknown": {
    id: "SIX hanya memberi jumlahnya, jadi tak bisa dipastikan",
    en: "SIX gives only the total, so this one can't be told",
  },
  // Under the listed meetings, the ones SIX counted before the months the app read, so the list adds up to the count
  // ("8 pertemuan sebelum 5 Nov"); its meta line how many of them were attended, when SIX's count tells it, else why
  // they aren't listed one by one.
  "mobile.meeting.earlier": {
    id: "{count} pertemuan sebelum {date}",
    en: { one: "{count} meeting before {date}", other: "{count} meetings before {date}" },
  },
  "mobile.meeting.earlierAll": { id: "{count} pertemuan", en: { one: "{count} meeting", other: "{count} meetings" } },
  "mobile.meeting.earlierSplit": { id: "Hadir {attended} · tidak hadir {absent}", en: "{attended} attended · {absent} absent" },
  "mobile.meeting.totalOnly": { id: "SIX hanya mencatat jumlahnya", en: "SIX keeps only the total" },
  // The course's sheet: its target, changed in place.
  "mobile.course.target": { id: "Target kehadiran", en: "Attendance target" },
  // The course's sheet: the next class clashes with another course's, named short ("Bentrok dengan Proposal TA 16:00–16:30").
  "mobile.course.clash": { id: "Bentrok dengan {course} {time}", en: "Clashes with {course} {time}" },
  // The grade calculator. Example weights in one line (the banner opens the course contract when there is one).
  "mobile.grade.example": { id: "Contoh bobot, bukan bobot {code}", en: "Example weights, not {code}'s" },
  // The answer as a number: "74" big, then "untuk A", then where that average is needed.
  "mobile.grade.needFor": { id: "untuk {letter}", en: "for {letter}" },
  "mobile.grade.needOn": { id: "Rata-rata di {parts}", en: "Average on {parts}" },
  // A part's long-press menu (and its screen-reader actions).
  "mobile.grade.rename": { id: "Ganti nama", en: "Rename" },
  "mobile.grade.remove": { id: "Hapus", en: "Remove" },
  "mobile.grade.removed": { id: "{part} dihapus", en: "{part} removed" },
  // superapp: Kuliah
  // Over the module the course is on, unfolded at the top of Materi: new material this week, else the newest.
  "mobile.course.material.thisWeek": { id: "Materi minggu ini", en: "This week's material" },
  "mobile.course.material.latest": { id: "Materi terbaru", en: "Latest material" },
  // Over the whole table of contents under it.
  "mobile.course.material.all": { id: "Semua modul", en: "All modules" },
  // The way into the unfolded module's own page (its Tasks, who posted it).
  "mobile.course.material.openModule": { id: "Buka {module}", en: "Open {module}" },
  // The module the class is on has no files yet: said once, under its name.
  "mobile.course.material.none": { id: "Belum ada materi untuk modul ini", en: "No material for this module yet" },
  // What a screen reader says for the module the course is on, in the list of all modules (the eye sees its number in a filled circle).
  "mobile.course.material.current": { id: "Modul sekarang", en: "Current module" },
} as const satisfies Record<string, Entry>;

export const mobileModuleStrings = {
  // A module. Under its materials, once: who posted them ("Dr. Hadi Halim, S.T., M.T."; two or more joined by " · ").
  "mobile.module.postedBy": { id: "Diposting oleh {names}", en: "Posted by {names}" },
} as const satisfies Record<string, Entry>;
