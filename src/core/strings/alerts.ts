// Text for alerts, the alert history, the tray and their settings (#75).
import type { Entry } from "./entry";

export const alertsStrings = {
  // One alert (OS notification and history row)
  "alert.plain": { id: "{title}", en: "{title}" },
  "alert.newTask": { id: "Tugas baru · {course}", en: "New Task · {course}" },
  "alert.shortTask": { id: "Tugas singkat · {course}", en: "Short Task · {course}" },
  "alert.shortTask.body": { id: "{title} · tutup {time}", en: "{title} · closes {time}" },
  "alert.newMaterial": { id: "Materi baru · {course}", en: "New material · {course}" },
  "alert.due24": { id: "Tenggat 24 jam lagi · {course}", en: "Due in 24 hours · {course}" },
  "alert.due3": { id: "Tenggat 3 jam lagi · {course}", en: "Due in 3 hours · {course}" },
  "alert.due.body": { id: "{title} · belum dikumpulkan", en: "{title} · not submitted yet" },

  // A burst, grouped into one notification
  "alert.group.newTask": { id: "{count} tugas baru", en: { one: "{count} new Task", other: "{count} new Tasks" } },
  "alert.group.newMaterial": { id: "{count} materi baru", en: { one: "{count} new material", other: "{count} new materials" } },
  "alert.group.deadline": { id: "{count} tenggat mendekat", en: { one: "{count} deadline coming up", other: "{count} deadlines coming up" } },
  "alert.group.other": { id: "{count} notifikasi baru", en: { one: "{count} new alert", other: "{count} new alerts" } },
  "alert.group.more": { id: "{list} dan {count} lainnya", en: "{list} and {count} more" },

  // The history panel
  "alerts.title": { id: "Notifikasi", en: "Notifications" },
  "alerts.open": { id: "Notifikasi, {count} belum dibaca", en: "Notifications, {count} unread" },
  "alerts.empty": { id: "Belum ada yang berubah", en: "Nothing has changed yet" },
  "alerts.emptyHint": {
    id: "Tugas baru, perubahan jadwal, dan tenggat yang mendekat muncul di sini. Edunex dan SIX diperiksa sendiri secara berkala.",
    en: "New Tasks, schedule changes and coming deadlines show here. Edunex and SIX are checked regularly on their own.",
  },
  "alerts.emptyHintEdunex": {
    id: "Tugas baru, materi, dan tenggat yang mendekat muncul di sini. Edunex diperiksa sendiri secara berkala; jadwal dan kehadiran menyusul setelah SIX terhubung.",
    en: "New Tasks, materials and coming deadlines show here. Edunex is checked regularly on its own; schedule and attendance follow once SIX is connected.",
  },
  "alerts.markAllRead": { id: "Tandai semua dibaca", en: "Mark all read" },
  "alerts.unread": { id: "belum dibaca", en: "unread" },
  "alerts.period.today": { id: "Hari ini", en: "Today" },
  "alerts.period.yesterday": { id: "Kemarin", en: "Yesterday" },
  "alerts.period.week": { id: "Minggu ini", en: "This week" },
  "alerts.period.earlier": { id: "Sebelumnya", en: "Earlier" },
  "alerts.footnoteEdunex": { id: "Dari Edunex · SIX belum terhubung", en: "From Edunex · SIX isn't connected" },
  "alerts.footnote": { id: "Dari Edunex dan SIX", en: "From Edunex and SIX" },
  "alerts.settings": { id: "Atur notifikasi", en: "Notification settings" },

  // Settings
  "settings.alerts": { id: "Notifikasi", en: "Notifications" },
  "settings.alerts.newTask": { id: "Tugas baru", en: "New Tasks" },
  "settings.alerts.newTaskHint": { id: "Termasuk yang waktunya singkat, langsung", en: "Including short-window ones, immediately" },
  "settings.alerts.newMaterial": { id: "Materi baru", en: "New materials" },
  "settings.alerts.newMaterialHint": { id: "Digabung jika banyak sekaligus", en: "Grouped when many arrive at once" },
  "settings.alerts.deadline": { id: "Tenggat", en: "Deadlines" },
  "settings.alerts.deadlineHint": {
    id: "24 jam dan 3 jam sebelumnya, hanya jika belum dikumpulkan",
    en: "24 h and 3 h before, only if not submitted",
  },
  "settings.alerts.test": { id: "Coba notifikasi", en: "Test notification" },
  "settings.alerts.testAction": { id: "Kirim", en: "Send" },
  "settings.alerts.testHint": { id: "Kirim satu notifikasi untuk memastikan muncul", en: "Send one to make sure they show up" },
  "settings.alerts.testSent": {
    id: "Terkirim. Tidak muncul? Izinkan notifikasi Edunex Plus di pengaturan sistem.",
    en: "Sent. Didn't see it? Allow Edunex Plus notifications in your system settings.",
  },
  "settings.closeWindow": { id: "Saat jendela ditutup", en: "When the window is closed" },
  "settings.closeWindow.hint": { id: "Tetap berjalan agar notifikasi tetap muncul", en: "Keep running so notifications still come" },
  "settings.closeWindow.tray": { id: "Tetap berjalan di latar", en: "Keep running in the background" },
  "settings.closeWindow.quit": { id: "Tutup aplikasi", en: "Quit the app" },

  // Desktop: the test notification, the tray and its one-time explainer
  "alert.test": { id: "Notifikasi berfungsi", en: "Notifications work" },
  "alert.test.body": { id: "Klik untuk membuka Tugas & Ujian", en: "Click to open Tasks & Exams" },
  "tray.open": { id: "Buka Edunex Plus", en: "Open Edunex Plus" },
  "tray.quit": { id: "Keluar dari Edunex Plus", en: "Quit Edunex Plus" },
  "tray.explainer.title": { id: "Edunex Plus tetap berjalan", en: "Edunex Plus keeps running" },
  "tray.explainer.body": {
    id: "Notifikasi tetap muncul saat jendela ditutup. Buka lagi dari ikon Edunex Plus di bilah menu atau baki sistem. Kamu bisa mengubahnya di Pengaturan.",
    en: "Notifications keep coming while the window is closed. Open it again from the Edunex Plus icon in the menu bar or system tray. You can change this in Settings.",
  },
  "tray.explainer.keep": { id: "Tetap berjalan", en: "Keep running" },
  "tray.explainer.quit": { id: "Keluar sepenuhnya", en: "Quit completely" },
} as const satisfies Record<string, Entry>;
