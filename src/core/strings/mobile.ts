// Text only the Android app shows: its tabs, its notification channels, and what a phone does
// that the desktop doesn't (signing in on a page inside the app, the phone's calendar, files
// opened in other apps). Everything else on the phone uses the desktop's own keys, and
// phoneWording, at the end, says the few of them that speak of a computer the phone's way.
import type { StringKey } from "../strings";
import type { Entry } from "./entry";

export const mobileStrings = {
  // Bottom tabs: short, the screen's own title says the rest ("Tugas & Ujian").
  "mobile.tab.tasks": { id: "Tugas", en: "Tasks" },
  "mobile.tab.more": { id: "Lainnya", en: "More" },
  // Android's notification channels, as Settings › Notifications lists them.
  "mobile.channel.presence": { id: "Presensi dibuka dan ditutup", en: "Presence opening and closing" },
  "mobile.channel.alerts": { id: "Tugas, tenggat dan perubahan", en: "Tasks, deadlines and changes" },
  // welcome
  "mobile.welcome.waitingHint": { id: "Tutup halaman masuk untuk membatalkan.", en: "Close the sign-in page to cancel." },
  "mobile.welcome.notify": {
    id: "Izinkan notifikasi agar pengingat tetap sampai saat aplikasi tertutup.",
    en: "Allow notifications so reminders still arrive with the app closed.",
  },
  // tasks
  // A file from Edunex opens in the phone's own apps (A12, A13), or goes elsewhere through the share sheet.
  "mobile.file.openFor": { id: "Buka {name}", en: "Open {name}" },
  "mobile.file.share": { id: "Bagikan", en: "Share" },
  "mobile.file.shareFor": { id: "Bagikan {name}", en: "Share {name}" },
  "mobile.file.noApp": {
    id: "Belum ada aplikasi di HP ini yang bisa membuka {name}. Bagikan ke aplikasi lain.",
    en: "No app on this phone opens {name}. Share it to another app.",
  },
  // The phone's app for it didn't open it: the copy is still here, so Share is the other way.
  "mobile.file.openFailed": {
    id: "{name} tidak bisa dibuka. Coba lagi, atau bagikan ke aplikasi lain.",
    en: "Couldn't open {name}. Try again, or share it to another app.",
  },
  // The copy went (signing out of Edunex takes it): a tap on the file downloads it again.
  "mobile.file.shareFailed": {
    id: "{name} tidak bisa dibagikan. Ketuk berkasnya untuk mengunduh ulang, lalu bagikan lagi.",
    en: "Couldn't share {name}. Tap the file to download it again, then share it.",
  },
  // The answer box on the phone is plain text: an answer with bold, lists or links is changed on Edunex.
  "mobile.handIn.textPlain": {
    id: "Kotak jawaban di HP hanya untuk teks biasa, jadi ubah jawaban berformat ini di Edunex. Berkasnya tetap bisa diatur di sini.",
    en: "The answer box on the phone takes plain text only, so change this formatted answer on Edunex. You can still manage the files here.",
  },
  // settings
  "mobile.settings.notificationsOff": {
    id: "Notifikasi untuk Edunex Plus mati. Nyalakan di pengaturan HP.",
    en: "Notifications for Edunex Plus are off. Turn them on in your phone's settings.",
  },
  // At the top of Notifikasi while Android's permission is off; the button asks for it, or opens the app's notification settings.
  "mobile.settings.notificationsOffTitle": { id: "Notifikasi mati", en: "Notifications are off" },
  "mobile.settings.notificationsOffBody": {
    id: "Pengingat tenggat, kuliah dan Presensi tidak akan muncul di HP ini.",
    en: "Reminders for deadlines, classes and Presence won't show on this phone.",
  },
  "mobile.settings.notificationsTurnOn": { id: "Nyalakan notifikasi", en: "Turn on notifications" },
  // course
  // "Simpan untuk offline" on the phone: the course's files go into the app, a few at a time. It keeps going off the page.
  "mobile.offline.saving": {
    id: "Menyimpan {done} dari {total} berkas",
    en: { one: "Saving {done} of {total} file", other: "Saving {done} of {total} files" },
  },
  "mobile.offline.savingHint": {
    id: "Tetap berjalan meski kamu pindah halaman. Tiap berkas lalu bisa dibuka tanpa internet.",
    en: "Keeps going if you leave this page. Each file then opens without internet.",
  },
  // schedule
  // "Tambahkan ke kalender HP" on the phone (S8): the events go into the phone's own calendar, in one called Edunex Plus.
  "mobile.calendar.lead": {
    id: "Kuliah, ujian dan tenggatmu masuk ke kalender HP, di kalender bernama Edunex Plus.",
    en: "Your classes, exams and deadlines go into your phone's calendar, in one called Edunex Plus.",
  },
  "mobile.calendar.add": { id: "Tambahkan {count} acara", en: { one: "Add {count} event", other: "Add {count} events" } },
  "mobile.calendar.again": {
    id: "Menambahkan lagi memperbarui acaranya, tidak menggandakannya.",
    en: "Adding again updates the events instead of adding copies.",
  },
  "mobile.calendar.added": {
    id: "{count} acara ada di kalender HP",
    en: { one: "{count} event in your phone's calendar", other: "{count} events in your phone's calendar" },
  },
  // The Student said no to calendar access (or Android won't ask again): the way to allow it, or the file instead.
  "mobile.calendar.denied": { id: "Kalender HP belum diizinkan", en: "Calendar access is off" },
  "mobile.calendar.deniedHint": {
    id: "Izinkan Kalender untuk Edunex Plus di setelan HP, atau bagikan .ics ke aplikasi kalender.",
    en: "Allow Calendar for Edunex Plus in your phone's settings, or share the .ics with a calendar app.",
  },
  "mobile.calendar.settings": { id: "Buka setelan", en: "Open settings" },
  // Once the events are in: the phone's calendar app, opened on today.
  "mobile.calendar.open": { id: "Buka kalender", en: "Open calendar" },
  "mobile.calendar.openFailed": {
    id: "Aplikasi kalender tidak bisa dibuka. Acaranya ada di kalender Edunex Plus.",
    en: "Couldn't open your calendar app. The events are in the Edunex Plus calendar.",
  },
  // The exam page's "Tambahkan ke kalender HP": said in a toast, with Buka setelan as its button.
  "mobile.exam.calendarDenied": {
    id: "Kalender HP belum diizinkan. Izinkan Kalender untuk Edunex Plus di setelan HP.",
    en: "Calendar access is off. Allow Calendar for Edunex Plus in your phone's settings.",
  },
  "mobile.calendar.failed": {
    id: "Kalender HP tidak bisa diisi. Coba lagi, atau bagikan .ics.",
    en: "Couldn't add to your phone's calendar. Try again, or share the .ics.",
  },
  // The desktop's calendar file, through the share sheet (Drive, email, another calendar app).
  "mobile.calendar.share": { id: "Bagikan .ics", en: "Share .ics" },
  "mobile.calendar.shareFailed": { id: "Berkas .ics tidak bisa dibagikan. Coba lagi.", en: "Couldn't share the .ics file. Try again." },
  // grades-plan
  // The planner's ⋯ on a course: the desktop plans a course in a semester, the phone moves it there from a sheet.
  "mobile.planner.options": { id: "Pilihan untuk {code}", en: "Options for {code}" },
  "mobile.planner.moveTo": { id: "Pindahkan ke {term}", en: "Move to {term}" },
  "mobile.planner.moved": { id: "{code} dipindah ke {term}", en: "{code} moved to {term}" },
  // Rencana's summary: the count of things to check scrolls down to the rules, which sit beside the plan on the desktop.
  "mobile.planner.toCheckHint": { id: "Ke daftar aturan di bawah", en: "Goes to the rules below" },
  // Kalender akademik: a date opens in the phone's own calendar app, filled in, for the Student to save.
  "mobile.deadline.toCalendar": { id: "Tambahkan ke kalender HP", en: "Add to phone calendar" },
  // Kalender akademik, under the view switch: what a tap on a date does.
  "mobile.deadline.tapHint": { id: "Ketuk tanggal untuk menambahkannya ke kalender HP.", en: "Tap a date to add it to your phone's calendar." },
  "mobile.deadline.calendarFailed": {
    id: "Kalender HP tidak bisa dibuka. Pasang aplikasi kalender, lalu coba lagi.",
    en: "The phone's calendar didn't open. Install a calendar app, then try again.",
  },
  // report
  // "Laporkan masalah" on the phone (A9): the report file goes out through the share sheet, not a folder.
  "mobile.report.nothingKept": {
    id: "Saat ini tidak ada halaman yang gagal dibaca. Laporannya berisi versi aplikasi, sistem HP-mu, dan ceritamu.",
    en: "No page is failing to read right now. The report has the app's version, your phone's system and what you write.",
  },
  "mobile.report.ready": { id: "Berkas laporan siap", en: "Report file ready" },
  "mobile.report.share": { id: "Bagikan berkas", en: "Share the file" },
  "mobile.report.shareFailed": { id: "Berkas laporan tidak bisa dibagikan. Coba lagi.", en: "Couldn't share the report file. Try again." },
  // LINE is on this phone: no QR code to scan, the ID is searched in LINE instead.
  "mobile.report.lineAddHint": {
    id: "Di LINE, buka Tambah teman, lalu cari ID {id}. Sudah berteman? Lewati langkah ini.",
    en: "In LINE, open Add friends and search for the ID {id}. Already friends? Skip this step.",
  },
  "mobile.report.copyId": { id: "Salin ID", en: "Copy ID" },
  "mobile.report.idCopied": { id: "ID {id} disalin", en: "{id} copied" },
  "mobile.report.lineSendHint": { id: "Tekan Bagikan berkas, pilih LINE, lalu pilih {id}.", en: "Tap Share the file, pick LINE, then pick {id}." },
  "mobile.report.githubAttach": { id: "Lampirkan berkasnya di kotak terakhir, lalu kirim", en: "Attach the file in the last box, then submit" },
  "mobile.report.githubAttachHint": {
    id: "Simpan dulu lewat Bagikan berkas, misalnya ke Drive atau File, supaya bisa dipilih di GitHub.",
    en: "Save it first with Share the file, to Drive or Files for example, so you can pick it on GitHub.",
  },
  // settings: Tentang › Versi. The button beside the version says only the verb (its accessible name is update.check),
  // so "Diperiksa sendiri sekali sehari." keeps its room on a phone's width.
  "mobile.update.checkShort": { id: "Periksa", en: "Check" },
} as const satisfies Record<string, Entry>;

// The desktop's words the phone says its own way: the same facts, numbers and {placeholders}, with
// "HP ini" for "komputer ini", a page for a window, a tap for a click. translate() takes them on the
// phone only (./wording.native.ts), so the desktop's words stay as they are.
export const phoneWording: Partial<Record<StringKey, Entry>> = {
  // settings: the test notification's body, as Android shows it.
  "alert.test.body": { id: "Ketuk untuk membuka Tugas & Ujian", en: "Tap to open Tasks & Exams" },
  // settings: Notifikasi › Coba notifikasi, once sent.
  "settings.alerts.testSent": {
    id: "Terkirim. Tidak muncul? Izinkan notifikasi Edunex Plus di pengaturan HP.",
    en: "Sent. Didn't see it? Allow Edunex Plus notifications in your phone's settings.",
  },
  // settings: Notifikasi › Presensi. Tandai Hadir is only seen by checking SIX, which a closed app does now and then at best.
  "settings.alerts.presenceHint": {
    id: "Saat Presensi Edunex dibuka, saat Tandai Hadir muncul di SIX selama aplikasi terbuka, dan 15 menit sebelum tutup jika belum tercatat",
    en: "When an Edunex Presence opens, when Tandai Hadir shows in SIX while the app is open, and 15 minutes before it closes if you're not recorded",
  },
  // home and presence: SIX is checked every 2 minutes only while the app is open (Android freezes a closed one).
  "home.now.checkEvery": { id: "Dicek tiap 2 menit selama aplikasi terbuka", en: "Checked every 2 minutes while the app is open" },
  "presence.row.watching": {
    id: "Tandai Hadir belum muncul. Selama aplikasi terbuka, SIX dicek tiap 2 menit.",
    en: "Tandai Hadir hasn't shown yet. While the app is open, it checks SIX every 2 minutes.",
  },
  "presence.footer": {
    id: "Kehadiran dihitung di SIX. Tekan Tandai Hadir di SIX saat tombolnya muncul. Buka aplikasi saat kuliah agar langsung tahu.",
    en: "Attendance counts in SIX. Press Tandai Hadir in SIX when it shows. Open the app in class to hear of it right away.",
  },
  "presence.how.check": {
    id: "Setelah tiap kuliah, aplikasi mengecek apakah hitungan SIX bertambah, dan memberi tahu jika tidak. Pengecekannya saat aplikasi dibuka, dan sesekali saat tertutup.",
    en: "After each class the app checks that SIX's count went up, and tells you if it didn't. It checks when you open the app, and now and then while it's closed.",
  },
  // settings: Pengingat yang ditunda. They're kept on this phone only.
  "settings.snoozed.hint": {
    id: "Hanya di HP ini, untuk Beranda, halaman tugas, dan halaman mata kuliah. Notifikasi perubahan baru tetap muncul.",
    en: "Only on this phone, for Home, Task pages and course pages. Notifications about new changes still come.",
  },
  // settings: Keluar & hapus data, and its confirm. The phone has no phone linked to it, so it isn't in the list.
  "settings.signOutAllHint": {
    id: "Keluar dari Edunex dan SIX, lalu menghapus semua datamu dari HP ini.",
    en: "Signs out of Edunex and SIX, then removes all your data from this phone.",
  },
  "settings.signOutAllBody": {
    id: "Kamu keluar dari Edunex dan SIX, dan semua yang disimpan aplikasi di HP ini dihapus. Itu termasuk yang kamu isi sendiri, seperti rencana studi, koreksi kurikulum, bobot dan nilai mata kuliah, target kehadiran per mata kuliah, warna mata kuliah, dan pengingat yang ditunda. Ini tidak bisa dibatalkan.",
    en: "You're signed out of Edunex and SIX, and everything the app keeps on this phone is removed. That includes what you entered yourself, like your study plan, curriculum corrections, course weights and scores, each course's attendance target, course colors and snoozed reminders. You can't undo this.",
  },
  // sign-in, and the data status line: Edunex's or SIX's sign-in is a page in the app, not a window.
  "signIn.slowHint": {
    id: "Halaman masuknya terbuka lagi. Tunggu sebentar, atau tutup lalu coba lagi.",
    en: "Its sign-in page is open again. Wait a moment, or close it and try again.",
  },
  // grades-plan: under the planner. The plan is kept on this phone.
  "planner.local": {
    id: "Rencana ini tersimpan di HP ini. Aplikasi tidak pernah mengirim KRS.",
    en: "This plan stays on this phone. The app never sends a KRS.",
  },
  // schedule: the calendar sheet's button with nothing chosen. On the phone it adds to the calendar, it saves no file.
  "schedule.export.nothing": { id: "Tidak ada yang bisa ditambahkan", en: "Nothing to add" },
  // grades-plan: Kurikulum's note. A course's corrections open from a tap on its row, not a ⋯ menu.
  "curriculum.unlistedNote": {
    id: "{count} mata kuliah tidak ada di catatan SIX-mu, jadi tidak dihitung sebagai sisa. Kalau prodimu bilang itu wajib untukmu, ketuk barisnya lalu pilih “Ada di kurikulumku”.",
    en: {
      one: "{count} course isn't on your SIX record, so it isn't counted as left. If your program says it's yours, tap its row and choose “In my curriculum”.",
      other:
        "{count} courses aren't on your SIX record, so they aren't counted as left. If your program says one is yours, tap its row and choose “In my curriculum”.",
    },
  },
  // tasks and schedule: a Task that is also attendance counts only while its Presence is open. No student
  // says "jendela", so the phone says when Presence is open, or "dalam waktu ini" beside a time.
  "task.note.attendance": {
    id: "Tugas ini juga Presensi-mu. Kamu dihitung hadir hanya jika mengumpulkannya {date}, {time}.",
    en: "This Task is also your attendance. You count as present only if you hand it in {date}, {time}.",
  },
  "task.note.attendanceCounted": {
    id: "Terhitung hadir. Kamu mengumpulkannya selama Presensi dibuka ({when}).",
    en: "Counted as present. You handed it in while Presence was open ({when}).",
  },
  "task.note.attendanceOutside": {
    id: "Tidak dihitung hadir karena tidak dikumpulkan selama Presensi dibuka ({when}). Tugasnya tetap terkumpul.",
    en: "Not counted as present, since it wasn't handed in while Presence was open ({when}). The Task itself is handed in.",
  },
  "task.note.attendanceMissed": {
    id: "Presensi tugas ini sudah ditutup ({when}). Kalau dikumpulkan sekarang, tugas terkumpul tapi tidak dihitung hadir.",
    en: "This Task's Presence has closed ({when}). Handed in now, it counts as handed in, not as present.",
  },
  "handIn.why.early": {
    id: "Presensi belum dibuka. Simpan draf sekarang, lalu kumpulkan {when} agar terhitung hadir.",
    en: "Presence isn't open yet. Save a draft now, then hand in {when} to be counted present.",
  },
  "handIn.check.attendanceEarly": {
    id: "Presensi belum dibuka ({when}). Kalau dikumpulkan sekarang, tugas terkumpul tapi tidak dihitung hadir.",
    en: "Presence isn't open yet ({when}). Handed in now, it counts as handed in, not as present.",
  },
  "handIn.check.attendanceMissed": {
    id: "Presensi sudah ditutup ({when}). Tugas tetap terkumpul, tapi tidak dihitung hadir.",
    en: "Presence has closed ({when}). It's still handed in, but not counted as present.",
  },
  "handIn.check.attendanceIn": { id: "Presensi sedang dibuka, jadi terhitung hadir.", en: "Presence is open, so you'll be counted present." },
  // schedule: a hand-in Presence's details, beside its time, and its event in the phone's calendar.
  "schedule.window.only": {
    id: "Hadir tercatat hanya jika dikumpulkan dalam waktu ini.",
    en: "You're marked present only if you hand it in during this time.",
  },
  "ics.handIn.note": {
    id: "Hadir tercatat hanya jika tugasnya dikumpulkan dalam waktu ini.",
    en: "You're marked present only if you hand the Task in during this time.",
  },
};
