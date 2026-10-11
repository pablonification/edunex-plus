// Text for quick search and the first-run scan (#81).
import type { Entry } from "./entry";

export const searchStrings = {
  // Quick search (⌘K)
  "search.open": { id: "Cari", en: "Search" },
  "search.placeholder": { id: "Cari mata kuliah, tugas, modul, materi…", en: "Search courses, Tasks, modules, materials…" },
  "search.results": { id: "Hasil pencarian", en: "Search results" },
  "search.count": { id: "{count} hasil", en: { one: "{count} result", other: "{count} results" } },
  "search.noResults": { id: "Tidak ada yang cocok dengan “{query}”", en: "Nothing matches “{query}”" },
  "search.class": { id: "Kelas {classNo}", en: "Class {classNo}" },
  "search.sks": { id: "{sks} SKS", en: "{sks} SKS" },
  "search.due": { id: "tenggat {when}", en: "due {when}" },
  "search.examWeek": { id: "Minggu {kind} {range}", en: "{kind} week {range}" },
  "search.noDate": { id: "Tanggal belum ada", en: "No date yet" },
  "search.parentClass": { id: "Kelas induk", en: "Parent class" },
  "search.group.course": { id: "Mata kuliah", en: "Courses" },
  "search.group.task": { id: "Tugas", en: "Tasks" },
  "search.group.exam": { id: "Ujian", en: "Exams" },
  "search.group.material": { id: "Materi", en: "Materials" },
  "search.group.module": { id: "Modul", en: "Modules" },
  "search.group.announcement": { id: "Pengumuman", en: "Announcements" },
  "search.group.screen": { id: "Buka", en: "Go to" },
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
  "scan.title": { id: "{count} hal yang tidak disampaikan kedua sistem", en: { one: "{count} thing neither system tells you", other: "{count} things neither system tells you" } },
  "scan.title.edunex": { id: "{count} hal yang tidak disampaikan EduNex", en: { one: "{count} thing EduNex doesn't tell you", other: "{count} things EduNex doesn't tell you" } },
  "scan.title.six": { id: "{count} hal yang tidak disampaikan SIX", en: { one: "{count} thing SIX doesn't tell you", other: "{count} things SIX doesn't tell you" } },
  "scan.heading": { id: "Hasil pemeriksaan pertama", en: "What the first check found" },
  "scan.empty": { id: "Tidak ada yang perlu kamu perhatikan", en: "Nothing needs your attention" },
  "scan.connected": { id: "{sources} terhubung", en: "{sources} connected" },
  "scan.and": { id: "{a} dan {b}", en: "{a} and {b}" },
  "scan.read": { id: "{list} dibaca", en: "{list} read" },
  "scan.read.courses": { id: "{count} mata kuliah", en: { one: "{count} course", other: "{count} courses" } },
  "scan.read.tasks": { id: "{count} tugas", en: { one: "{count} Task", other: "{count} Tasks" } },
  "scan.read.meetings": { id: "{count} pertemuan", en: { one: "{count} meeting", other: "{count} meetings" } },
  "scan.more": { id: "dan {count} lainnya", en: "and {count} more" },
  "scan.goHome": { id: "Ke Beranda", en: "Go to Home" },

  // Attendance at risk
  "scan.attendance.title": { id: "Kehadiran {count} mata kuliah berisiko", en: { one: "Attendance at risk in {count} course", other: "Attendance at risk in {count} courses" } },
  "scan.attendance.out": {
    id: "{code}: hadir {attended} dari {held}, paling tinggi {best}%, jadi {target}% tak tercapai lagi",
    en: "{code}: {attended} of {held}, best case {best}%, so {target}% is out of reach",
  },
  "scan.attendance.none": { id: "{code}: tidak boleh absen lagi", en: "{code}: no absences left" },
  "scan.attendance.one": { id: "{code}: tinggal satu absen", en: "{code}: one absence left" },
  "scan.attendance.below": {
    id: "{code}: di bawah {target}%, kembali setelah {count}x hadir berturut-turut",
    en: "{code}: below {target}%, back after {count} in a row",
  },

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
  "scan.clash.krs": { id: "SIX menerimanya di KRS-mu tanpa peringatan.", en: "SIX accepted this in your KRS without a warning." },

  // Counted in SIX while EduNex shows its unused windows as absent
  "scan.unused.title": {
    id: "Kehadiran {count} mata kuliah dihitung di SIX, bukan EduNex",
    en: { one: "{count} course counts attendance in SIX, not EduNex", other: "{count} courses count attendance in SIX, not EduNex" },
  },
  "scan.unused.course": {
    id: "{code}: EduNex akan menampilkan {count}x absen, SIX mencatat hadir {attended} dari {held}",
    en: { one: "{code}: EduNex would show {count} absence; SIX has {attended} of {held}", other: "{code}: EduNex would show {count} absences; SIX has {attended} of {held}" },
  },
  "scan.unused.note": { id: "Presensi EduNex yang tak tercatat bukan absen.", en: "An unrecorded EduNex window isn't an absence." },

  // Exams
  "scan.exams.title": { id: "{count} ujian akan datang", en: { one: "{count} upcoming exam", other: "{count} upcoming exams" } },
  "scan.exams.at": { id: "{name} {code}: {when}", en: "{name} {code}: {when}" },
  "scan.exams.takeHome": { id: "UTS take-home {code}, tenggat {when}", en: "Take-home UTS {code}, due {when}" },
  "scan.exams.week": { id: "{kind} {code}, minggu {kind} {range}", en: "{kind} {code}, {kind} week {range}" },
  "scan.exams.noDate": { id: "{name} {code}, tanggal belum ada", en: "{name} {code}, no date yet" },

  // Meetings announced only in EduNex
  "scan.notInSix.title": {
    id: "{count} pertemuan hanya diumumkan di EduNex",
    en: { one: "{count} meeting announced only in EduNex", other: "{count} meetings announced only in EduNex" },
  },
  "scan.notInSix.meeting": { id: "{code} pertemuan {number}: {when}", en: "{code} meeting {number}: {when}" },
  "scan.notInSix.online": { id: "daring", en: "online" },
  "scan.notInSix.note": { id: "Tidak ada di jadwal SIX.", en: "Not in SIX's timetable." },

  // Tasks edited after posting
  "scan.edited.title": {
    id: "Dosen mengubah {count} tugas setelah diunggah",
    en: { one: "Lecturers edited {count} Task after posting it", other: "Lecturers edited {count} Tasks after posting them" },
  },
  "scan.edited.afterSubmit": { id: "{count} di antaranya setelah kamu mengumpulkan.", en: "{count} after you'd already submitted." },
  "scan.edited.silent": { id: "EduNex tidak memberi notifikasi.", en: "EduNex sent no notification." },

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
  "settings.firstScan": { id: "Hasil pemeriksaan pertama", en: "What the first check found" },
  "settings.firstScan.show": { id: "Lihat", en: "Show" },
} as const satisfies Record<string, Entry>;
