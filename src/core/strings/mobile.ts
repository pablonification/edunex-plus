// Text only the Android app shows: its tabs, its notification channels, and what a phone does
// that the desktop doesn't (signing in on a page inside the app, the phone's calendar, files
// opened in other apps). Everything else on the phone uses the desktop's own keys.
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
  "mobile.calendar.failed": {
    id: "Kalender HP tidak bisa diisi. Coba lagi, atau bagikan .ics.",
    en: "Couldn't add to your phone's calendar. Try again, or share the .ics.",
  },
  // The desktop's calendar file, through the share sheet (Drive, email, another calendar app).
  "mobile.calendar.share": { id: "Bagikan .ics", en: "Share .ics" },
  "mobile.calendar.shareFailed": { id: "Berkas .ics tidak bisa dibagikan. Coba lagi.", en: "Couldn't share the .ics file. Try again." },
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
} as const satisfies Record<string, Entry>;
