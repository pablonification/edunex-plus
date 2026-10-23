// Text for alerts on the Student's phone through ntfy: Settings' "Notifikasi di
// HP" and the phone-only lines of what's sent there.
import type { Entry } from "./entry";

export const phoneStrings = {
  // Settings
  "phone.title": { id: "Notifikasi di HP", en: "Phone notifications" },
  "phone.privacy": {
    id: "Pesan lewat layanan gratis ntfy. Orang lain tidak bisa membacanya tanpa kode ini, tapi pengelola ntfy bisa.",
    en: "Messages go through ntfy's free public service. Others can't read them without this code, but ntfy can.",
  },
  "phone.off": { id: "Kirim ke HP juga", en: "Send to your phone too" },
  "phone.offHint": {
    id: "Lewat aplikasi ntfy, gratis tanpa akun, di satu HP atau lebih. Pengingat tenggat tetap sampai walau laptop ditutup.",
    en: "Through the free ntfy app, no account needed, on one phone or more. Deadline reminders still arrive with the laptop closed.",
  },
  "phone.connect": { id: "Hubungkan HP", en: "Connect phone" },
  "phone.step.install": { id: "Pasang aplikasi ntfy dari Play Store atau App Store.", en: "Install the ntfy app from the Play Store or App Store." },
  "phone.step.android": { id: "Android: pindai kode QR ini dengan kamera HP.", en: "Android: scan this QR code with your phone's camera." },
  "phone.step.iphone": { id: "iPhone: di ntfy, ketuk +, lalu ketik kode di bawah.", en: "iPhone: in ntfy, tap +, then type the code below." },
  "phone.morePhones": {
    id: "Untuk HP lain, ulangi langkah ini di HP itu. Tiap HP dengan kode ini menerima notifikasi yang sama.",
    en: "For another phone, repeat these steps on it. Every phone with this code gets the same notifications.",
  },
  "phone.qr": { id: "Kode QR untuk Android", en: "QR code for Android" },
  "phone.topic": { id: "Kode untuk iPhone", en: "Code for iPhone" },
  "phone.copy": { id: "Salin", en: "Copy" },
  "phone.copyCode": { id: "Salin kode", en: "Copy the code" },
  "phone.copied": { id: "Kode disalin", en: "Code copied" },
  "phone.test": { id: "Coba kirim ke HP", en: "Send a test" },
  "phone.testHint": { id: "Pastikan sampai di tiap HP", en: "Check that it reaches each phone" },
  "phone.testAction": { id: "Kirim tes", en: "Send test" },
  "phone.testSent": {
    id: "Terkirim. Ada HP yang tidak menerima? Pastikan kode di aplikasi ntfy-nya sama dengan kode di atas.",
    en: "Sent. A phone got nothing? Check that the code in its ntfy app matches the one above.",
  },
  "phone.quiet": { id: "Jam tenang", en: "Quiet hours" },
  "phone.quietHint": {
    id: "Notifikasi yang tidak mendesak ditahan sampai jam tenang selesai. Presensi dan tenggat dekat tetap masuk.",
    en: "Notifications that can wait are held until quiet hours end. Presence and close deadlines still come through.",
  },
  "phone.quietStart": { id: "Jam tenang mulai", en: "Quiet hours start" },
  "phone.quietEnd": { id: "Jam tenang selesai", en: "Quiet hours end" },
  "phone.disconnect": { id: "Putuskan semua HP", en: "Disconnect all phones" },
  "phone.disconnectHint": {
    id: "Semua HP berhenti menerima notifikasi. Untuk satu HP saja, hapus kode ini dari aplikasi ntfy di HP itu.",
    en: "Every phone stops getting them. For one phone only, remove this code from the ntfy app on that phone.",
  },
  "phone.disconnectAction": { id: "Putuskan", en: "Disconnect" },
  // Asked first: the code is forgotten, so connecting again means setting up a new one on every phone. Confirmed with phone.disconnect.
  "phone.disconnectTitle": { id: "Putuskan semua HP?", en: "Disconnect all phones?" },
  "phone.disconnectBody": {
    id: "Tiap HP dengan kode ini berhenti menerima notifikasi, dan pengingat yang sudah dijadwalkan dibatalkan. Untuk menghubungkan lagi, tiap HP perlu kode baru.",
    en: "Every phone with this code stops getting notifications, and reminders already booked are cancelled. To connect again, each phone needs a new code.",
  },
  "phone.notCancelled": {
    id: "ntfy tidak terjangkau, jadi pengingat yang sudah dijadwalkan mungkin tetap sampai di HP.",
    en: "Couldn't reach ntfy, so reminders already booked may still reach your phone.",
  },
  "phone.problem.offline": {
    id: "Belum terkirim ke HP karena tidak ada koneksi. Dicoba lagi nanti.",
    en: "Not sent to your phone yet because there's no connection. It tries again later.",
  },
  "phone.problem.busy": {
    id: "Belum terkirim ke HP karena ntfy sedang sibuk. Dicoba lagi nanti.",
    en: "Not sent to your phone yet because ntfy is busy. It tries again later.",
  },

  // On the phone
  "phone.message.test": { id: "Edunex Plus terhubung", en: "Edunex Plus is connected" },
  "phone.message.testBody": { id: "Notifikasi Edunex Plus akan muncul di sini.", en: "Edunex Plus notifications will show up here." },
  "phone.footnote.deadline": { id: "Abaikan kalau sudah dikumpulkan.", en: "Ignore this if you've already handed it in." },
  "phone.footnote.presence": { id: "Abaikan kalau sudah tercatat hadir.", en: "Ignore this if you're already marked present." },
  "phone.watchdog": { id: "Edunex belum dicek", en: "Edunex hasn't been checked" },
  "phone.watchdogBody": {
    id: "Edunex Plus belum mengecek Edunex sejak {dateId} {time}. Buka laptop sebentar supaya tugas baru tidak terlewat.",
    en: "Edunex Plus hasn't checked Edunex since {dateEn} {time}. Open your laptop for a moment so no new Task slips by.",
  },
} as const satisfies Record<string, Entry>;
