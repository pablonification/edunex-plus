// Text for the guide: the tour of the window after a new Student's first
// sign-in (shell/guide.tsx), page by page and part by part, and its row in
// Settings. Each step names the part it points at and says what it's for.
import type { Entry } from "./entry";

export const guideStrings = {
  "guide.intro.title": { id: "Kenalan dulu dengan Edunex Plus", en: "Get to know Edunex Plus" },
  "guide.intro.body": {
    id: "Lihat isi tiap halaman dan cara memakainya, dalam beberapa menit. Bisa dilewati kapan saja.",
    en: "See what's on each page and how to use it, in a few minutes. Skip it any time.",
  },
  "guide.start": { id: "Mulai panduan", en: "Take the tour" },
  "guide.skip": { id: "Lewati panduan", en: "Skip the tour" },
  "guide.next": { id: "Lanjut", en: "Next" },
  "guide.done": { id: "Selesai", en: "Done" },
  "guide.step": { id: "{step} dari {count}", en: "{step} of {count}" },
  "guide.progress": { id: "Kemajuan panduan", en: "Tour progress" },
  "guide.later": { id: "Panduan bisa dibuka nanti dari Pengaturan › Tentang", en: "You can take the tour later from Settings › About" },
  "guide.tools": { id: "Menu dan alat", en: "Menus and tools" },

  // Beranda
  "guide.home.now.title": { id: "Kuliah sekarang", en: "Class now" },
  "guide.home.now.body": {
    id: "Kuliah yang sedang berjalan atau berikutnya, dengan ruangnya. Saat Tandai Hadir di SIX dibuka, aplikasi memberi tahu dan membawamu ke sana.",
    en: "The class on now or next, with its room. When Tandai Hadir opens on SIX, the app tells you and takes you there.",
  },
  "guide.home.today.title": { id: "Hari ini", en: "Today" },
  "guide.home.today.body": {
    id: "Kuliah dan tenggat hari ini, berurutan. Kuliah yang bentrok atau tanpa sisa jatah absen diberi tanda.",
    en: "Today's classes and deadlines, in order. A class that clashes or has no absences left is marked.",
  },
  "guide.home.needs.title": { id: "Perlu perhatianmu", en: "Needs you" },
  "guide.home.needs.body": {
    id: "Yang perlu kamu urus, paling mendesak di atas. Centang yang sudah beres, atau pakai jam untuk diingatkan nanti.",
    en: "What needs you, most urgent first. Tick one off when it's handled, or use the clock to be reminded later.",
  },
  "guide.home.changes.title": { id: "Yang berubah", en: "What changed" },
  "guide.home.changes.body": {
    id: "Tugas dan materi baru, tugas yang diubah dosen, dan jadwal yang pindah minggu ini. Semuanya tersimpan di lonceng.",
    en: "New Tasks and materials, Tasks a lecturer edited and classes that moved this week. The bell keeps them all.",
  },
  "guide.home.courses.title": { id: "Mata kuliah semester ini", en: "Courses this semester" },
  "guide.home.courses.body": {
    id: "Tiap mata kuliah dengan sisa jatah absennya. Klik untuk membuka halamannya.",
    en: "Each course with the absences it has left. Click one to open its page.",
  },

  // Tugas & Ujian
  "guide.tasks.show.title": { id: "Belum selesai atau selesai", en: "To do or done" },
  "guide.tasks.show.body": {
    id: "Belum selesai dikelompokkan per minggu, yang terlambat paling atas. Selesai berisi yang sudah terkumpul atau ditutup, dan ujian yang sudah lewat.",
    en: "To do is grouped by week, with anything overdue first. Done keeps what's submitted or closed, and past exams.",
  },
  "guide.tasks.row.title": { id: "Tenggat dan pengumpulan", en: "Deadlines and handing in" },
  "guide.tasks.row.body": {
    id: "Tenggat dan waktu ujian ada di kanan, kuning kalau tinggal kurang dari sehari, merah kalau terlambat. Klik tugas untuk menulis jawaban, melampirkan berkas, lalu menyimpan draf atau mengumpulkan.",
    en: "Deadlines and exam times are on the right, amber with under a day to go, red once late. Click a Task to write your answer, attach files, then save a draft or submit it.",
  },

  // Jadwal
  "guide.schedule.view.title": { id: "Minggu atau bulan", en: "Week or month" },
  "guide.schedule.view.body": {
    id: "Ganti tampilan, geser dengan panah, dan tambahkan jadwalnya ke kalender HP-mu dari sini.",
    en: "Switch the view, move with the arrows, and add the schedule to your phone's calendar from here.",
  },
  "guide.schedule.grid.title": { id: "Jadwal resmi", en: "The official schedule" },
  "guide.schedule.grid.body": {
    id: "Tiap kuliah dari SIX dengan ruangnya, dan yang bentrok berdampingan. Garis putus-putus berarti pertemuan yang hanya diumumkan di Edunex, atau kuliah yang belum pasti ada.",
    en: "Every class from SIX with its room, and clashes side by side. A dashed edge is a meeting only Edunex announced, or a class that may not run.",
  },

  // Presensi
  "guide.presence.targets.title": { id: "Target kehadiran", en: "Attendance target" },
  "guide.presence.targets.body": {
    id: "Jatah absen dihitung dari target ini. Samakan target tiap mata kuliah dengan batas minimal di kontrak kuliahnya.",
    en: "Absences left are counted from this target. Set each course's target to the minimum in its course contract.",
  },
  "guide.presence.now.title": { id: "Perlu perhatianmu sekarang", en: "Needs you now" },
  "guide.presence.now.body": {
    id: "Tandai Hadir yang sedang dibuka, Presensi Edunex, dan kuliah yang bentrok. Setelah kuliah, di sini terlihat apakah SIX sudah menghitungmu hadir.",
    en: "Tandai Hadir when it's open, Edunex Presence and classes that clash. After class, it shows whether SIX counted you.",
  },
  "guide.presence.row.title": { id: "Kehadiran dan jatah absen", en: "Attendance and absences" },
  "guide.presence.row.body": {
    id: "Kehadiranmu di SIX sejauh ini, dan berapa kali lagi boleh absen. Tiap tanda satu absen: terisi kalau terpakai, kosong kalau tersisa, merah kalau lewat batas.",
    en: "Your SIX attendance so far, and how many more classes you can miss. Each mark is one absence: filled once used, empty while left, red past the limit.",
  },

  // Nilai
  "guide.grades.outlook.title": { id: "Menuju lulus", en: "Toward graduation" },
  "guide.grades.outlook.body": {
    id: "IP dan IPK-mu tiap semester, dan arahnya dengan nilai yang kamu perkirakan. Lalu IPK saat lulus, dan predikat pujian yang masih bisa diraih.",
    en: "Your IP and IPK each semester, and where the grades you expect take them. Then the IPK you'd graduate with, and the honors still in reach.",
  },
  "guide.grades.term.title": { id: "Semester ini", en: "This semester" },
  "guide.grades.term.body": {
    id: "Ubah perkiraan nilai tiap mata kuliah untuk melihat IPK-mu setelah semester ini. Pilih target IPK untuk melihat rata-rata yang dibutuhkan, atau “Butuh berapa?” untuk satu mata kuliah.",
    en: "Change the grade you expect in each course to see your IPK after this semester. Pick an IPK target to see the average it takes, or “What do I need?” for one course.",
  },

  // Rencana studi
  "guide.plan.tabs.title": { id: "Rencana, KRS, dan UKT", en: "Plan, KRS and UKT" },
  "guide.plan.tabs.body": {
    id: "Rencanakan studimu di sini, dan cek kurikulum, KRS, tagihan UKT, serta kalender akademik ITB di tab lainnya.",
    en: "Plan your studies here, and check your curriculum, KRS, UKT bills and ITB's academic calendar in the other tabs.",
  },
  "guide.plan.plan.title": { id: "Rencanamu", en: "Your plan" },
  "guide.plan.plan.body": {
    id: "SKS yang terpenuhi, kapan kamu lulus, dan dengan IPK berapa. Coba tambah mata kuliah di semester di bawahnya, dan aturan ITB langsung dicek. KRS-mu tidak berubah.",
    en: "How many SKS your plan covers, when you'd graduate and with what IPK. Try adding courses to the semesters below, and ITB's rules are checked as you go. Your KRS doesn't change.",
  },

  // A course
  "guide.course.list.title": { id: "Mata kuliahmu", en: "Your courses" },
  "guide.course.list.body": {
    id: "Mata kuliah semester ini, masing-masing dengan warnanya. Klik kanan untuk mengganti warnanya.",
    en: "This semester's courses, each with its own color. Right-click one to change its color.",
  },
  "guide.course.tabs.title": { id: "Isi mata kuliah", en: "What's in a course" },
  "guide.course.tabs.body": {
    id: "Semua tentang mata kuliah ini dari Edunex dan SIX. Pertemuan menampilkan tiap kuliah dan Presensinya, dan Nilai menghitung yang kamu butuhkan untuk nilai yang kamu mau.",
    en: "Everything about this course from Edunex and SIX. Meetings shows each class and its Presence, and Grades works out what you need for the grade you want.",
  },
  "guide.course.modules.title": { id: "Modul dan materi", en: "Modules and materials" },
  "guide.course.modules.body": {
    id: "Kebanyakan berkas terbuka di aplikasi, dan teks PDF atau Word bisa kamu sorot dan beri catatan. Untuk membaca tanpa internet, pilih Simpan untuk offline di Lainnya (⋯).",
    en: "Most files open in the app, and in a PDF or Word file you can highlight and add notes. To read without internet, choose Save for offline under More (⋯).",
  },

  // Menu dan alat
  "guide.tools.nav.title": { id: "Menu", en: "Menu" },
  "guide.tools.nav.body": {
    id: "Angka di samping tiap halaman adalah jumlah yang menunggu, dan kuning kalau ada yang perlu segera kamu urus. Pindah cepat dengan {keys}.",
    en: "The number beside each page is what's waiting there, amber when something needs you soon. Jump between them with {keys}.",
  },
  "guide.tools.search.title": { id: "Cari dari mana saja", en: "Search from anywhere" },
  "guide.tools.search.body": {
    id: "Tekan {keys} untuk mencari mata kuliah, tugas, modul, atau materi.",
    en: "Press {keys} to find a course, Task, module or material.",
  },
  "guide.tools.alerts.title": { id: "Notifikasi", en: "Notifications" },
  "guide.tools.alerts.body": {
    id: "Tugas dan materi baru, tenggat yang mendekat, dan Presensi yang dibuka muncul di sini. Bisa dikirim ke HP-mu juga.",
    en: "New Tasks and materials, coming deadlines and Presence opening show here. They can reach your phone too.",
  },
  "guide.tools.status.title": { id: "Status data", en: "Data status" },
  "guide.tools.status.body": {
    id: "Kapan Edunex dan SIX terakhir diperbarui. Kalau ada masalah, penyebab dan jalan keluarnya ada di sini.",
    en: "When Edunex and SIX were last updated. If something's wrong, what happened and the fix are here.",
  },
  "guide.tools.settings.title": { id: "Pengaturan", en: "Settings" },
  "guide.tools.settings.body": {
    id: "Atur pengingat tenggat, notifikasi di HP, bahasa, dan tema. Panduan ini juga bisa dibuka lagi dari sini.",
    en: "Set deadline reminders, phone notifications, language and theme. You can take this tour again from here.",
  },

  // Settings
  "settings.guide": { id: "Panduan aplikasi", en: "Tour of the app" },
  "settings.guide.hint": { id: "Tiap halaman dan bagiannya, langkah demi langkah", en: "Each page and its parts, step by step" },
  "settings.guide.start": { id: "Mulai", en: "Start" },
} as const satisfies Record<string, Entry>;
