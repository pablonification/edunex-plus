// Text for "Laporkan masalah" (ADR 0007): sending the app's maintainer a page the app couldn't
// read, with the Student's details taken out on their computer, on LINE or GitHub. Pages are named
// the way the app's screens name them, and the engine's own words stay in the technical details.
import type { Entry } from "./entry";

export const reportStrings = {
  // Where it opens: a source's status, a screen's note about its SIX page, Settings
  "report.open": { id: "Laporkan", en: "Report" },
  "report.title": { id: "Laporkan masalah", en: "Report a problem" },
  "report.settingsHint": { id: "Ke pengelola aplikasi, lewat LINE atau GitHub", en: "To the app's maintainer, on LINE or GitHub" },

  // What's sent, before anything is
  "report.lead": {
    id: "Pengelola aplikasi bisa memperbaikinya dari laporan ini. Tidak ada yang terkirim sebelum kamu memilih caranya.",
    en: "The app's maintainer can fix it from this report. Nothing is sent until you choose how.",
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

  // When something doesn't work
  "report.failed": { id: "Laporan tidak bisa disiapkan. Coba lagi.", en: "The report couldn't be prepared. Try again." },
  "report.saveFailed": { id: "Berkas laporan tidak bisa disimpan. Coba lagi.", en: "The report file couldn't be saved. Try again." },
  "report.openFailed": { id: "{place} tidak bisa dibuka. Coba lagi.", en: "{place} couldn't be opened. Try again." },
  "report.revealFailed": { id: "Folder berkasnya tidak bisa dibuka. Coba lagi.", en: "The file's folder couldn't be opened. Try again." },

  // The report's own title on GitHub, when no page is in it
  "report.summaryTitle": { id: "Laporan dari Edunex Plus {version}", en: "Report from Edunex Plus {version}" },
} as const satisfies Record<string, Entry>;
