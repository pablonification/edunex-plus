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
  // grades-plan
  // The planner's ⋯ on a course: the desktop plans a course in a semester, the phone moves it there from a sheet.
  "mobile.planner.options": { id: "Pilihan untuk {code}", en: "Options for {code}" },
  "mobile.planner.moveTo": { id: "Pindahkan ke {term}", en: "Move to {term}" },
  "mobile.planner.moved": { id: "{code} dipindah ke {term}", en: "{code} moved to {term}" },
  // Kalender akademik: a date opens in the phone's own calendar app, filled in, for the Student to save.
  "mobile.calendar.add": { id: "Tambah ke kalender HP", en: "Add to phone calendar" },
  "mobile.calendar.failed": {
    id: "Kalender HP tidak bisa dibuka. Pasang aplikasi kalender, lalu coba lagi.",
    en: "The phone's calendar didn't open. Install a calendar app, then try again.",
  },
} as const satisfies Record<string, Entry>;
