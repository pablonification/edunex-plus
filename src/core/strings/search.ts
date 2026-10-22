// Text for quick search and the first-run scan (#81).
import type { Entry } from "./entry";

export const searchStrings = {
  // Quick search (⌘K)
  "search.open": { id: "Cari", en: "Search" },
  "search.placeholder": { id: "Cari mata kuliah, tugas, modul, materi…", en: "Search courses, Tasks, modules, materials…" },
  "search.results": { id: "Hasil pencarian", en: "Search results" },
  "search.count": { id: "{count} hasil", en: { one: "{count} result", other: "{count} results" } },
  "search.noResults": { id: "Tidak ada yang cocok dengan “{query}”", en: "Nothing matches “{query}”" },
  "search.noResultsHint": {
    id: "Coba kode mata kuliah (mis. {code}), judul tugas, atau nama halaman.",
    en: "Try a course code (like {code}), a Task title, or a page name.",
  },
  "search.action.refresh": { id: "Muat ulang data", en: "Refresh data" },
  "search.action.theme": { id: "Ganti tema", en: "Switch theme" },
  "search.action.themeTo": { id: "Ke tema {theme}", en: "To {theme} theme" },
  "search.alias.action.refresh": { id: "muat ulang perbarui sinkron segarkan", en: "refresh reload sync update" },
  "search.alias.action.theme": { id: "tema gelap terang mode malam", en: "theme dark light mode night" },
  "search.type.course": { id: "Mata kuliah", en: "Course" },
  "search.type.task": { id: "Tugas", en: "Task" },
  "search.type.exam": { id: "Ujian", en: "Exam" },
  "search.type.material": { id: "Materi", en: "Material" },
  "search.type.module": { id: "Modul", en: "Module" },
  "search.type.announcement": { id: "Pengumuman", en: "Announcement" },
  "search.type.screen": { id: "Halaman", en: "Page" },
  "search.type.action": { id: "Perintah", en: "Command" },
  "search.open.inApp": { id: "Buka", en: "Open" },
  "search.footer.move": { id: "pilih", en: "move" },
  "search.footer.open": { id: "buka", en: "open" },
  "search.footer.close": { id: "tutup", en: "close" },
  "search.class": { id: "Kelas {classNo}", en: "Class {classNo}" },
  "search.sks": { id: "{sks} SKS", en: "{sks} SKS" },
  "search.due": { id: "tenggat {when}", en: "due {when}" },
  "search.examWeek": { id: "Masa {kind} {range}", en: "{kind} period {range}" },
  "search.noDate": { id: "Tanggal belum ada", en: "No date yet" },
  "search.group.course": { id: "Mata kuliah", en: "Courses" },
  "search.group.task": { id: "Tugas belum selesai", en: "Tasks to do" },
  "search.group.exam": { id: "Ujian", en: "Exams" },
  "search.group.material": { id: "Materi", en: "Materials" },
  "search.group.module": { id: "Modul", en: "Modules" },
  "search.group.announcement": { id: "Pengumuman", en: "Announcements" },
  "search.group.screen": { id: "Halaman", en: "Pages" },
  "search.group.action": { id: "Perintah", en: "Commands" },
  "search.group.doneTask": { id: "Tugas selesai", en: "Done Tasks" },
  "search.group.recent": { id: "Terakhir dibuka", en: "Recently opened" },
  // More words a screen or tab is found by; never shown. Both languages are searched.
  "search.alias.home": { id: "hari ini ringkasan", en: "today overview" },
  "search.alias.tasks": { id: "tugas ujian tenggat uts uas", en: "tasks exams deadlines assignments" },
  "search.alias.schedule": { id: "kalender kuliah kelas ruang", en: "calendar timetable classes rooms" },
  "search.alias.presence": { id: "kehadiran absen", en: "attendance absences" },
  "search.alias.grades": { id: "ipk ip transkrip predikat", en: "gpa transcript honors" },
  "search.alias.plan": { id: "perencanaan studi", en: "planning" },
  "search.alias.plan.planner": { id: "rencana semester target ipk simulasi", en: "plan semesters target gpa planner" },
  "search.alias.plan.curriculum": { id: "kurikulum peta mata kuliah wajib pilihan", en: "curriculum map required electives" },
  "search.alias.plan.krs": { id: "krs rencana studi dosen wali", en: "krs study plan academic advisor" },
  "search.alias.plan.bills": { id: "ukt tagihan bayar biaya", en: "ukt bills payment tuition" },
  "search.alias.plan.deadlines": { id: "kalender akademik jadwal drs urs kuesioner", en: "academic calendar deadlines drs urs questionnaire" },
  "search.alias.settings": { id: "tema bahasa notifikasi akun keluar", en: "theme language notifications accounts sign out" },

  // The first-run scan: the dialog
  "scan.title": {
    id: "{count} hal yang tidak disampaikan kedua sistem",
    en: { one: "{count} thing neither system tells you", other: "{count} things neither system tells you" },
  },
  "scan.title.edunex": {
    id: "{count} hal yang tidak disampaikan Edunex",
    en: { one: "{count} thing Edunex doesn't tell you", other: "{count} things Edunex doesn't tell you" },
  },
  "scan.title.six": {
    id: "{count} hal yang tidak disampaikan SIX",
    en: { one: "{count} thing SIX doesn't tell you", other: "{count} things SIX doesn't tell you" },
  },
  "scan.heading": { id: "Ringkasan saat pertama terhubung", en: "Your first-connection summary" },
  "scan.empty": { id: "Tidak ada yang perlu kamu perhatikan", en: "Nothing needs your attention" },
  "scan.connected": { id: "{sources} terhubung", en: "{sources} connected" },
  "scan.read": { id: "{list} dibaca", en: "{list} read" },
  "scan.read.courses": { id: "{count} mata kuliah", en: { one: "{count} course", other: "{count} courses" } },
  "scan.read.tasks": { id: "{count} tugas", en: { one: "{count} Task", other: "{count} Tasks" } },
  // The reading step's figures: the count stands alone below its label.
  "scan.count.courses": { id: "Mata kuliah", en: "Courses" },
  "scan.count.tasks": { id: "Tugas", en: "Tasks" },
  "scan.count.meetings": { id: "Pertemuan", en: "Meetings" },
  "scan.more": { id: "dan {count} lainnya", en: "and {count} more" },
  "scan.goHome": { id: "Ke Beranda", en: "Go to Home" },
  "scan.later": { id: "Bisa dibuka lagi dari Pengaturan › Akun", en: "Open it again from Settings › Accounts" },

  // Attendance at risk
  "scan.attendance.title": {
    id: "Kehadiran {count} mata kuliah berisiko",
    en: { one: "Attendance at risk in {count} course", other: "Attendance at risk in {count} courses" },
  },
  "scan.attendance.out": {
    id: "{code}: hadir {attended} dari {held} · paling tinggi {best}% dari target {target}%",
    en: "{code}: {attended} of {held} · best case {best}% of the {target}% target",
  },
  "scan.attendance.none": { id: "{code}: jangan absen lagi", en: "{code}: don't miss another class" },

  // Overlapping classes
  "scan.clash.one": {
    id: "{a} dan {b} bentrok di {count} pertemuan",
    en: { one: "{a} and {b} overlap in {count} meeting", other: "{a} and {b} overlap in {count} meetings" },
  },
  "scan.clash.title": { id: "{count} pasang mata kuliah bentrok", en: { one: "{count} pair of courses overlaps", other: "{count} pairs of courses overlap" } },
  "scan.clash.next": { id: "Berikutnya {when}.", en: "Next {when}." },
  "scan.clash.pair": {
    id: "{a} dan {b}: {count} pertemuan, berikutnya {when}",
    en: { one: "{a} and {b}: {count} meeting, next {when}", other: "{a} and {b}: {count} meetings, next {when}" },
  },
  "scan.clash.krs": { id: "Pilih yang akan kamu hadiri, atau tanyakan ke dosen.", en: "Pick the one you'll attend, or ask the lecturers." },

  // Counted in SIX while Edunex shows its unused windows as absent
  "scan.unused.title": {
    id: "Kehadiran {count} mata kuliah dihitung di SIX, bukan Edunex",
    en: { one: "{count} course counts attendance in SIX, not Edunex", other: "{count} courses count attendance in SIX, not Edunex" },
  },
  "scan.unused.course": {
    id: "SIX mencatat {code} hadir {attended} dari {held}, jadi abaikan {count} “absen” di Edunex",
    en: {
      one: "SIX has {code} at {attended} of {held}, so ignore the {count} “absence” Edunex shows",
      other: "SIX has {code} at {attended} of {held}, so ignore the {count} “absences” Edunex shows",
    },
  },
  "scan.unused.note": { id: "Tandai Hadir di SIX. Presensi Edunex tidak wajib.", en: "Press Tandai Hadir in SIX. Edunex Presence is optional." },

  // Exams
  "scan.exams.title": { id: "{count} ujian akan datang", en: { one: "{count} upcoming exam", other: "{count} upcoming exams" } },
  "scan.exams.at": { id: "{name} {code}: {when}", en: "{name} {code}: {when}" },
  "scan.exams.takeHome": { id: "{kind} take-home {code}, tenggat {when}", en: "Take-home {kind} {code}, due {when}" },
  "scan.exams.week": { id: "{kind} {code}, minggu {kind} {range}", en: "{kind} {code}, {kind} week {range}" },
  "scan.exams.noDate": { id: "{name} {code}, tanggal belum ada", en: "{name} {code}, no date yet" },

  // Meetings announced only in Edunex
  "scan.notInSix.title": {
    id: "{count} pertemuan hanya diumumkan di Edunex",
    en: { one: "{count} meeting announced only in Edunex", other: "{count} meetings announced only in Edunex" },
  },
  "scan.notInSix.meeting": { id: "{code} pertemuan {number}: {when}", en: "{code} meeting {number}: {when}" },
  "scan.notInSix.online": { id: "daring", en: "online" },
  "scan.notInSix.note": { id: "Tidak ada di jadwal SIX; sudah ada di Beranda.", en: "Not on SIX's timetable; it's on Home." },

  // Tasks edited after posting
  "scan.edited.title": {
    id: "Dosen mengubah {count} tugas setelah diunggah",
    en: { one: "Lecturers edited {count} Task after posting it", other: "Lecturers edited {count} Tasks after posting them" },
  },
  "scan.edited.afterSubmit": { id: "{count} di antaranya setelah kamu mengumpulkan.", en: "{count} after you'd already submitted." },
  "scan.edited.silent": { id: "Cek lagi instruksinya; Edunex tidak mengabarkannya.", en: "Check the instructions again; Edunex didn't say." },

  // The IPK and its honors level (Peraturan Akademik ITB)
  "scan.ipk.title": { id: "IPK {ipk} · {band}", en: "IPK {ipk} · {band}" },
  "scan.ipk.level.summa": { id: "summa cum laude", en: "summa cum laude" },
  "scan.ipk.level.magna": { id: "magna cum laude", en: "magna cum laude" },
  "scan.ipk.level.cum": { id: "cum laude", en: "cum laude" },
  "scan.ipk.below": { id: "di bawah cum laude", en: "below cum laude" },
  "scan.ipk.next": { id: "Kurang {gap} untuk {band} ({min}).", en: "{gap} short of {band} ({min})." },
  "scan.ipk.retake": { id: "Predikat {band} tertutup karena kamu pernah mengulang mata kuliah.", en: "A retake rules out {band}." },
  "scan.ipk.time": { id: "Predikat pujian butuh lulus dalam 9 semester.", en: "Honors need graduating within 9 semesters." },

  // What couldn't be read
  "scan.unread.title": { id: "{count} bagian tidak terbaca", en: { one: "{count} part couldn't be read", other: "{count} parts couldn't be read" } },
  "scan.unread.offline": { id: "{source} tidak bisa dihubungi", en: "{source} couldn't be reached" },
  "scan.unread.changed": { id: "{source} mengubah sesuatu", en: "{source} changed something" },
  "scan.unread.expired": { id: "Sesi {source} berakhir", en: "{source} ended the session" },
  "scan.unread.catalog": { id: "Katalog publik SIX", en: "SIX's public catalog" },
  "scan.part.edunex.courses": { id: "Mata kuliah", en: "Courses" },
  "scan.part.edunex.tasks": { id: "Tugas", en: "Tasks" },
  "scan.part.edunex.outline": { id: "Modul", en: "Modules" },
  "scan.part.edunex.materials": { id: "Materi", en: "Materials" },
  "scan.part.edunex.presence": { id: "Presensi", en: "Presence" },
  "scan.part.edunex.announcements": { id: "Pengumuman", en: "Announcements" },
  "scan.part.edunex.exams": { id: "Ujian", en: "Exams" },
  "scan.part.six.courses": { id: "Kehadiran", en: "Attendance" },
  "scan.part.six.schedule": { id: "Jadwal", en: "Timetable" },
  "scan.part.six.transcript": { id: "Transkrip", en: "Transcript" },
  "scan.part.itb.calendar": { id: "Kalender akademik", en: "Academic calendar" },

  // Settings
  "settings.firstScan": { id: "Ringkasan saat pertama terhubung", en: "Your first-connection summary" },
  "settings.firstScan.hint": { id: "Apa yang ditemukan saat Edunex dan SIX pertama dibaca", en: "What turned up when Edunex and SIX were first read" },
  "settings.firstScan.show": { id: "Lihat", en: "Show" },
} as const satisfies Record<string, Entry>;
