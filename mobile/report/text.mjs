// The words of the hand-off page (mobile/report/index.html, made by mobile/scripts/make-report.mjs).
// Each flow names its pictures: the phone's from mobile/flows/judge/*.yaml ("light-01-beranda"), the
// desktop's from scripts/demo/capture.mjs ("01-beranda"). Demo data only: a made-up student.

export const TITLE = "Edunex Plus for Android: hand-off";

/** @type {{ id: string, title: string, steps: string[], shots: { phone: string, desktop?: string, caption: string }[] }[]} */
export const FLOWS = [
  {
    id: "first-run",
    title: "First run: welcome, sign in, first scan",
    steps: [
      "Open the app for the first time: a short credit, then the promise and <b>Mulai</b>.",
      "<b>Hubungkan Edunex</b> opens ITB's real sign-in page inside the app (the demo uses a made-up one). SIX comes along on the same Microsoft sign-in.",
      "Both say who is signed in; <b>Lanjut</b> reads the semester (courses, tasks, meetings) until Beranda is ready.",
      "<b>Buka Edunex Plus</b> asks for notifications (Android's own prompt), then the first-scan summary shows what neither system tells.",
    ],
    shots: [
      { phone: "32-pertama-selamat-datang", desktop: "32-pertama-selamat-datang", caption: "Welcome" },
      { phone: "32a-pertama-menyelesaikan", desktop: "32a-pertama-menyelesaikan", caption: "Finishing the sign-in" },
      { phone: "33-pertama-terhubung", desktop: "33-pertama-terhubung", caption: "Both connected" },
      { phone: "34-pertama-membaca", desktop: "34-pertama-membaca", caption: "Reading the semester" },
      { phone: "35-pertama-temuan", desktop: "35-pertama-temuan", caption: "First-scan summary" },
    ],
  },
  {
    id: "home",
    title: "Beranda",
    steps: [
      "The class on now (or next), with Tandai Hadir in SIX and the Edunex Presence when they're open.",
      "Scroll: the rest of today and tomorrow, <b>Perlu perhatianmu</b> (swipe a row, or long-press it, for Ingatkan nanti or Sudah beres), what changed, this term's courses.",
    ],
    shots: [
      { phone: "01-beranda", desktop: "01-beranda", caption: "Beranda" },
      { phone: "02-beranda-hari-ini", desktop: "02-beranda-hari-ini", caption: "Beranda, further down" },
    ],
  },
  {
    id: "tasks",
    title: "Tugas & Ujian, a Task, an exam",
    steps: [
      "The <b>Tugas</b> tab: Belum selesai and Selesai, filtered by course, exams and their periods among the Tasks.",
      "A Task: its deadline and facts, the attendance it counts as, the lecturer's instructions, then the answer, files (from the phone's file picker), draft and submit.",
      "An exam: when and where, what Edunex and SIX say about it.",
    ],
    shots: [
      { phone: "03-tugas-ujian", desktop: "03-tugas-ujian", caption: "Tugas & Ujian" },
      { phone: "04-tugas", desktop: "04-tugas", caption: "A Task" },
      { phone: "04b-tugas-kumpulkan", desktop: "05-kumpulkan-di-luar-jendela-presensi", caption: "Handing it in" },
      { phone: "06-ujian", desktop: "06-ujian", caption: "An exam" },
    ],
  },
  {
    id: "schedule",
    title: "Jadwal and the phone's calendar",
    steps: [
      "The <b>Jadwal</b> tab: the week as a strip of days over the chosen day's classes; a class opens its sheet.",
      "Next week (the midterms), or the month.",
      "<b>Tambahkan ke kalender HP</b>: classes, exams, deadlines and ITB's dates go straight into a calendar named Edunex Plus on the phone. Adding again updates them, no copies.",
    ],
    shots: [
      { phone: "07-jadwal-minggu", desktop: "07-jadwal-minggu", caption: "This week" },
      { phone: "08-jadwal-detail", desktop: "08-jadwal-detail", caption: "A class" },
      { phone: "09-jadwal-masa-uts", desktop: "09-jadwal-masa-uts", caption: "The midterms' week" },
      { phone: "10-jadwal-bulan", desktop: "10-jadwal-bulan", caption: "The month" },
      { phone: "11-ekspor-kalender", desktop: "11-ekspor-kalender", caption: "Add to the phone's calendar" },
      { phone: "12-ekspor-kalender-selesai", desktop: "12-ekspor-kalender-selesai", caption: "Added" },
    ],
  },
  {
    id: "presence",
    title: "Presensi",
    steps: ["The <b>Presensi</b> tab: each course's absences left against its target, what's open now, clashes; long-press a course for its colour."],
    shots: [{ phone: "13-presensi", desktop: "13-presensi", caption: "Presensi" }],
  },
  {
    id: "grades-plan",
    title: "Nilai and Rencana studi",
    steps: [
      "<b>Lainnya › Nilai</b>: IPK, its chart, this term's estimates, every term.",
      "<b>Lainnya › Rencana studi</b>: the planner (courses moved between terms from a sheet), Kurikulum, KRS, UKT, Kalender akademik (a date goes into the phone's calendar app).",
    ],
    shots: [
      { phone: "14-nilai", desktop: "14-nilai", caption: "Nilai" },
      { phone: "15-rencana", desktop: "15-rencana", caption: "Rencana" },
      { phone: "16-kurikulum", desktop: "16-kurikulum", caption: "Kurikulum" },
      { phone: "17-krs", desktop: "17-krs", caption: "KRS" },
      { phone: "18-ukt", desktop: "18-ukt", caption: "UKT" },
      { phone: "19-kalender-akademik", desktop: "19-kalender-akademik", caption: "Kalender akademik" },
    ],
  },
  {
    id: "course",
    title: "A course",
    steps: [
      "From Lainnya's course list (or any row naming a course): its absences, the class on now, then tabs that scroll sideways: Modul, Pertemuan, Tugas & Ujian, Nilai, Pengumuman.",
      "A module's file downloads into the app and opens in the phone's own apps, or goes elsewhere through the share sheet.",
      "Nilai's calculator: weights and scores on the number keypad, and what's needed for each letter.",
    ],
    shots: [
      { phone: "20-mata-kuliah", desktop: "20-mata-kuliah", caption: "The course" },
      { phone: "21-pertemuan", desktop: "21-pertemuan", caption: "Pertemuan" },
      { phone: "22-kalkulator-nilai", desktop: "22-kalkulator-nilai", caption: "Grade calculator" },
    ],
  },
  {
    id: "search-status-alerts",
    title: "Search, the data's state, the bell",
    steps: [
      "The search button: everything the app read, as the desktop's Ctrl K.",
      "The status line at the top: when the data was read, and reading it again now.",
      "The bell: every alert the app raised, the same ones that arrive as Android notifications.",
    ],
    shots: [
      { phone: "23-cari", desktop: "23-cari", caption: "Search" },
      { phone: "24-status-data-memperbarui", desktop: "24-status-data-memperbarui", caption: "Reading again" },
      { phone: "25-notifikasi", desktop: "25-notifikasi", caption: "The bell" },
    ],
  },
  {
    id: "more-settings",
    title: "Lainnya and Settings",
    steps: [
      "The <b>Lainnya</b> tab: who's signed in, Nilai, Rencana studi, the courses (the palette opens their colours), Settings, Laporkan masalah. The desktop's sidebar, as a tab.",
      "Settings: accounts, notifications (and a test one), theme and language, course colours, other choices, about, licences.",
    ],
    shots: [
      { phone: "lainnya", caption: "Lainnya (the phone's own)" },
      { phone: "26-pengaturan", desktop: "26-pengaturan", caption: "Settings" },
      { phone: "26-pengaturan-notifikasi", desktop: "26-pengaturan-hp", caption: "Notifications" },
      { phone: "26-pengaturan-tentang", desktop: "26-pengaturan-tentang", caption: "About" },
      { phone: "26-pengaturan-lisensi", desktop: "26-pengaturan-lisensi", caption: "Licences" },
    ],
  },
  {
    id: "edunex-only",
    title: "Edunex without SIX",
    steps: ["Signed in to Edunex only: Beranda and Jadwal from what Edunex says, and the way to connect SIX."],
    shots: [
      { phone: "36-tanpa-six-beranda", desktop: "36-tanpa-six-beranda", caption: "Beranda" },
      { phone: "37-tanpa-six-jadwal", desktop: "37-tanpa-six-jadwal", caption: "Jadwal" },
    ],
  },
];

// The page's own words above and below the flows. Filled in with the final scores at hand-off.
export const SECTIONS = {
  top: `
<h1>Edunex Plus for Android</h1>
<p class="lead">The desktop app, made for a phone: the same engine reading Edunex and SIX, the same data and words, bottom tabs for one hand, and what a phone does better (notifications, the phone's calendar, files in other apps, the share sheet, a home-screen widget).</p>
`,
  bottom: ``,
};
