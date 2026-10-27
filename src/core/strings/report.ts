// Text for "Laporkan masalah" (ADR 0007): sending the app's maintainer a page the app couldn't
// read, with the Student's details taken out on their computer, on LINE or GitHub, or with one
// click when the app has the maintainer's relay (ADR 0014). Pages are named the way the app's
// screens name them, and the engine's own words stay in the technical details.
import type { Entry } from "./entry";

export const reportStrings = {
  // Where it opens: a source's status, a screen's note about its SIX page, Settings
  "report.open": { id: "Laporkan", en: "Report" },
  "report.title": { id: "Laporkan masalah", en: "Report a problem" },
  "report.settingsHint": { id: "Ke pengelola aplikasi, lewat LINE atau GitHub", en: "To the app's maintainer, on LINE or GitHub" },
  "report.settingsHintRelay": {
    id: "Ke pengelola aplikasi, langsung atau lewat LINE dan GitHub",
    en: "To the app's maintainer, directly or on LINE and GitHub",
  },

  // What's sent, before anything is
  "report.lead": {
    id: "Pengelola aplikasi bisa memperbaikinya dari laporan ini. Tidak ada yang terkirim sebelum kamu memilih caranya.",
    en: "The app's maintainer can fix it from this report. Nothing is sent until you choose how.",
  },
  "report.leadAuto": {
    id: "Pengelola aplikasi bisa memperbaikinya dari laporan ini. Yang seperti ini terkirim otomatis, sesuai pilihanmu di Pengaturan.",
    en: "The app's maintainer can fix it from this report. Reports like this go by themselves, as you chose in Settings.",
  },
  "report.sent": { id: "Yang dikirim", en: "What's sent" },
  "report.changed.six": { id: "SIX mengubah halaman {page}", en: "SIX changed its {page} page" },
  "report.changed.sixAny": { id: "SIX mengubah salah satu halamannya", en: "SIX changed one of its pages" },
  "report.changed.edunex": { id: "Edunex mengubah data {page}", en: "Edunex changed its {page} data" },
  "report.changed.edunexAny": { id: "Edunex mengubah datanya", en: "Edunex changed its data" },
  "report.skipped": {
    id: "{count} baris di halaman {page} belum dikenali",
    en: { one: "{count} row on the {page} page isn't recognised", other: "{count} rows on the {page} page aren't recognised" },
  },
  "report.page.status": { id: "status mahasiswa", en: "student status" },
  "report.page.schedule": { id: "jadwal", en: "schedule" },
  "report.page.grades": { id: "nilai", en: "grades" },
  "report.page.curriculum": { id: "kurikulum", en: "curriculum" },
  "report.page.krs": { id: "KRS", en: "KRS" },
  "report.page.ukt": { id: "UKT", en: "UKT" },
  "report.page.account": { id: "akun", en: "account" },
  "report.page.courses": { id: "mata kuliah", en: "course" },
  "report.page.tasks": { id: "tugas", en: "task" },
  "report.page.materials": { id: "materi", en: "material" },
  "report.page.notifications": { id: "notifikasi", en: "notification" },
  "report.pageGoes": {
    id: "Halaman ini ikut dikirim. Nama, NIM, kontak, dan tautan diganti, nilai dan jumlah uang diganti angka karangan.",
    en: "This page goes with it. Names, NIM, contacts and links are replaced, and grades and amounts are made up.",
  },
  "report.app": { id: "Edunex Plus {version} di {os}", en: "Edunex Plus {version} on {os}" },
  "report.nothingKept": {
    id: "Saat ini tidak ada halaman yang gagal dibaca. Laporannya berisi versi aplikasi, sistem komputermu, dan ceritamu.",
    en: "No page is failing to read right now. The report has the app's version, your computer's system and what you write.",
  },
  "report.logGoes": {
    id: "Yang dilakukan aplikasi sejam terakhir juga ikut dikirim, tanpa data pribadimu.",
    en: "What the app did in the last hour goes too, without your details.",
  },
  "report.details": { id: "Detail teknis", en: "Technical details" },
  // In the technical details: how the scrubbed page reads, what the problem cost, the rows, the app's log
  "report.reproduces.yes": {
    id: "Tanpa data pribadimu pun, halaman ini masih gagal dibaca dengan cara yang sama.",
    en: "Without your details, the page still fails to read the same way.",
  },
  "report.reproduces.no": {
    id: "Tanpa data pribadimu, halaman ini tidak lagi gagal dengan cara yang sama.",
    en: "Without your details, the page no longer fails the same way.",
  },
  "report.reproduces.unknown": {
    id: "Belum bisa dicek apakah halaman ini masih gagal tanpa data pribadimu.",
    en: "Couldn't check whether the page still fails without your details.",
  },
  "report.impact.rows": { id: "{count} baris belum dikenali", en: { one: "{count} row not recognised", other: "{count} rows not recognised" } },
  "report.impact.blank": { id: "{count} isian dikosongkan", en: { one: "{count} detail left blank", other: "{count} details left blank" } },
  "report.impact.lastGood": { id: "Terakhir terbaca utuh {when}", en: "Last read whole {when}" },
  "report.impact.neverGood": { id: "Belum pernah terbaca utuh", en: "Never read whole yet" },
  "report.cell": { id: "Bentuk asli barisnya: {shape}", en: "The row's real shape: {shape}" },
  "report.log": { id: "Yang dilakukan aplikasi sejam terakhir", en: "What the app did in the last hour" },
  "report.note": { id: "Apa yang sedang kamu lakukan?", en: "What were you doing?" },
  "report.notePlaceholder": { id: "Opsional, misalnya membuka tab UKT", en: "Optional, for example opening the UKT tab" },
  "report.notePublic": {
    id: "Kalau lewat GitHub atau dikirim langsung, ceritamu bisa dibaca siapa saja.",
    en: "Sent on GitHub or straight away, anyone can read what you write.",
  },
  "report.how": { id: "Kirim lewat", en: "Send it through" },
  "report.line": { id: "Kirim lewat LINE", en: "Send on LINE" },
  "report.lineHint": {
    id: "Ke {id}, pengelola aplikasi. Hanya pengelola yang membacanya.",
    en: "To {id}, the app's maintainer. Only the maintainer reads it.",
  },
  "report.github": { id: "Buka di GitHub", en: "Open on GitHub" },
  "report.githubHint": { id: "Butuh akun GitHub. Laporannya bisa dibaca siapa saja.", en: "Needs a GitHub account. Anyone can read the report." },

  // Then, step by step
  "report.saved": { id: "Berkas laporan sudah disimpan", en: "Report file saved" },
  "report.stepDone": { id: "selesai", en: "done" },
  "report.lineAdd": { id: "Tambahkan {id} di LINE", en: "Add {id} on LINE" },
  "report.lineAddHint": {
    id: "Pindai kode ini dengan LINE di HP, atau cari ID {id}. Sudah berteman? Lewati langkah ini.",
    en: "Scan this code with LINE on your phone, or search for the ID {id}. Already friends? Skip this step.",
  },
  "report.qr": { id: "Kode QR untuk menambahkan {id} di LINE", en: "QR code to add {id} on LINE" },
  "report.lineSend": { id: "Kirim berkasnya di chat dengan {id}", en: "Send the file in your chat with {id}" },
  "report.lineSendHint": {
    id: "Di LINE komputer, seret berkasnya ke chat. LINE cuma di HP? Pindahkan berkasnya ke HP dulu, lewat AirDrop, email, atau Drive.",
    en: "In LINE on your computer, drag the file into the chat. LINE only on your phone? Move the file there first, with AirDrop, email or Drive.",
  },
  "report.githubOpen": { id: "Buka laporan baru di GitHub", en: "Open a new report on GitHub" },
  "report.githubOpenHint": { id: "Isinya sudah terisi. Kamu perlu masuk ke GitHub.", en: "It's already filled in. You need to be signed in to GitHub." },
  "report.githubOpenButton": { id: "Buka GitHub", en: "Open GitHub" },
  "report.openAgain": { id: "Buka lagi", en: "Open again" },
  "report.githubAttach": { id: "Seret berkasnya ke kotak terakhir, lalu kirim", en: "Drag the file into the last box, then submit" },
  "report.githubSubmit": { id: "Periksa isinya, lalu kirim", en: "Check it, then submit" },
  "report.done": { id: "Selesai", en: "Done" },

  // Sending with one click (ADR 0014), when this copy has the maintainer's relay
  "report.relay": { id: "Kirim langsung", en: "Send now" },
  "report.relayHint": {
    id: "Ke pengelola aplikasi, tanpa akun. Ringkasannya bisa dibaca siapa saja di GitHub, halamannya tidak.",
    en: "To the app's maintainer, no account needed. Anyone can read the summary on GitHub, not the page.",
  },
  "report.sentTitle": { id: "Laporan terkirim", en: "Report sent" },
  "report.sentIssue": { id: "Tercatat sebagai #{number} di GitHub.", en: "Filed as #{number} on GitHub." },
  "report.sentDuplicate": {
    id: "Masalah ini sudah pernah dilaporkan, jadi laporanmu ikut di #{number}.",
    en: "This was reported before, so yours joins #{number}.",
  },
  "report.sentLater": { id: "Laporan ini akan tercatat di GitHub sebentar lagi.", en: "It'll be filed on GitHub shortly." },
  "report.seeIssue": { id: "Lihat di GitHub", en: "See on GitHub" },
  "report.story": { id: "Mau tambah cerita?", en: "Want to add what happened?" },
  "report.storyPlaceholder": { id: "Misalnya, apa yang kamu buka sebelum ini terjadi", en: "For example, what you opened before this happened" },
  "report.storyPublic": { id: "Ceritamu bisa dibaca siapa saja di GitHub.", en: "Anyone can read what you add on GitHub." },
  "report.storySend": { id: "Kirim cerita", en: "Add it" },
  "report.storyAdded": { id: "Ceritamu sudah ditambahkan.", en: "Added to the report." },

  // The question the app asks once, the first time it keeps a problem, and each time after "Tanya dulu"
  "report.ask.title": { id: "Kirim laporan seperti ini otomatis?", en: "Send reports like this by themselves?" },
  "report.ask.body": {
    id: "Pengelola aplikasi bisa memperbaikinya lebih cepat. Ringkasannya bisa dibaca siapa saja di GitHub, tanpa data pribadimu.",
    en: "The app's maintainer can fix it sooner. Anyone can read its summary on GitHub, without your details.",
  },
  "report.ask.auto": { id: "Kirim otomatis", en: "Send them" },
  "report.ask.ask": { id: "Tanya tiap kali", en: "Ask each time" },
  "report.ask.never": { id: "Jangan kirim", en: "Don't send" },
  "report.ask.see": { id: "Lihat isinya", en: "See what goes" },
  "report.ask.each": { id: "Kirim laporannya ke pengelola aplikasi?", en: "Send a report to the app's maintainer?" },
  "report.ask.seeReport": { id: "Lihat laporannya", en: "See the report" },

  // Settings
  "report.settings.title": { id: "Laporan masalah", en: "Problem reports" },
  "report.settings.sending": { id: "Kirim laporan otomatis", en: "Send reports by themselves" },
  "report.settings.sendingHint": {
    id: "Saat ada halaman yang gagal dibaca, tanpa data pribadimu",
    en: "When a page can't be read, without your details",
  },
  "report.settings.auto": { id: "Otomatis", en: "Always" },
  "report.settings.ask": { id: "Tanya tiap kali", en: "Ask each time" },
  "report.settings.never": { id: "Jangan", en: "Never" },
  "report.settings.page": { id: "Halaman {page}", en: "{page} page" },
  "report.settings.noPage": { id: "Laporan dari Pengaturan", en: "Report from Settings" },
  "report.settings.byItself": { id: "Terkirim otomatis", en: "Sent by itself" },
  "report.settings.byYou": { id: "Kamu yang kirim", en: "Sent by you" },
  "report.settings.notFiled": { id: "Diterima, belum ada nomornya", en: "Received, no issue number yet" },
  "report.settings.seeIssue": { id: "Lihat #{number} di GitHub", en: "See #{number} on GitHub" },
  "report.settings.note": {
    id: "Ringkasannya bisa dibaca siapa saja di GitHub. Halaman dan yang dilakukan aplikasi hanya dibaca pengelola.",
    en: "Anyone can read the summaries on GitHub. Only the maintainer reads the pages and what the app did.",
  },

  // When something doesn't work
  "report.failed": { id: "Laporan tidak bisa disiapkan. Coba lagi.", en: "The report couldn't be prepared. Try again." },
  "report.saveFailed": { id: "Berkas laporan tidak bisa disimpan. Coba lagi.", en: "The report file couldn't be saved. Try again." },
  "report.openFailed": { id: "{place} tidak bisa dibuka. Coba lagi.", en: "{place} couldn't be opened. Try again." },
  "report.revealFailed": { id: "Folder berkasnya tidak bisa dibuka. Coba lagi.", en: "The file's folder couldn't be opened. Try again." },
  "report.sendPersonal": {
    id: "Laporan ini tidak terkirim karena masih memuat yang terlihat seperti data pribadi. Kirim lewat LINE saja.",
    en: "This report wasn't sent because it still holds what looks like personal data. Send it on LINE instead.",
  },
  "report.sendTooBig": {
    id: "Laporan ini terlalu besar untuk dikirim langsung. Kirim lewat LINE atau GitHub.",
    en: "This report is too big to send now. Send it on LINE or GitHub.",
  },
  "report.sendBusy": {
    id: "Laporan belum bisa diterima sekarang. Coba lagi beberapa menit lagi.",
    en: "Reports can't be taken right now. Try again in a few minutes.",
  },
  "report.sendFailed": {
    id: "Laporan tidak terkirim. Coba lagi, atau kirim lewat LINE atau GitHub.",
    en: "The report wasn't sent. Try again, or send it on LINE or GitHub.",
  },
  "report.storyPersonal": {
    id: "Ceritamu memuat data pribadi, jadi tidak terkirim. Hapus dulu, lalu coba lagi.",
    en: "What you wrote holds personal data, so it wasn't sent. Take it out, then try again.",
  },
  "report.storyGone": { id: "Cerita tidak bisa ditambahkan ke laporan ini lagi.", en: "This report can't take more anymore." },
  "report.storyFailed": { id: "Ceritamu tidak terkirim. Coba lagi.", en: "That wasn't sent. Try again." },
  "report.openIssueFailed": { id: "GitHub tidak bisa dibuka. Coba lagi.", en: "GitHub couldn't be opened. Try again." },

  // The report's own title on GitHub, when no page is in it
  "report.summaryTitle": { id: "Laporan dari Edunex Plus {version}", en: "Report from Edunex Plus {version}" },
} as const satisfies Record<string, Entry>;
