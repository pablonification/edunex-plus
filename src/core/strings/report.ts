// Text for "Laporkan masalah" (ADR 0007): sending the app's maintainer a page the app couldn't
// read, scrubbed on the Student's computer, on GitHub or LINE. And the report's own words, which go
// with it in the Student's language.
import type { Entry } from "./entry";

export const reportStrings = {
  // Where it opens: a source's status, a screen's note about its SIX page, Settings
  "report.open": { id: "Laporkan", en: "Report" },
  "report.title": { id: "Laporkan masalah", en: "Report a problem" },
  "report.settingsHint": { id: "Ke pengelola aplikasi, lewat GitHub atau LINE", en: "To the app's maintainer, on GitHub or LINE" },

  // What's sent, before anything is
  "report.lead": {
    id: "Dari laporan ini, pengelola bisa memperbaiki aplikasinya. Belum ada yang terkirim sampai kamu memilih caranya.",
    en: "With this report, the maintainer can fix the app. Nothing is sent until you choose how.",
  },
  "report.sent": { id: "Yang dikirim", en: "What's sent" },
  "report.app": { id: "Edunex Plus {version} di {os}", en: "Edunex Plus {version} on {os}" },
  "report.changed": { id: "Tidak bisa dibaca", en: "Couldn't be read" },
  "report.skipped": { id: "{count} baris dilewati", en: { one: "{count} row left out", other: "{count} rows left out" } },
  "report.check": { id: "Yang tidak cocok: {check}", en: "What didn't fit: {check}" },
  "report.nothingKept": {
    id: "Saat ini tidak ada halaman yang gagal dibaca. Laporannya berisi versi aplikasi, sistem komputermu, dan ceritamu.",
    en: "No page is failing to read right now. The report has the app's version, your computer's system and what you write.",
  },
  "report.showPage": { id: "Lihat halamannya", en: "Show the page" },
  "report.hidePage": { id: "Tutup halamannya", en: "Hide the page" },
  "report.scrubbed": {
    id: "Nama, NIM, kontak, dan tautan sudah diganti. Nilai dan jumlah uang diganti angka karangan.",
    en: "Names, NIM, contacts and links are replaced. Grades and amounts are made up.",
  },
  "report.note": { id: "Apa yang sedang kamu lakukan?", en: "What were you doing?" },
  "report.notePlaceholder": { id: "Opsional, misalnya membuka tab UKT", en: "Optional, for example opening the UKT tab" },
  "report.how": { id: "Kirim lewat", en: "Send it on" },
  "report.github": { id: "Buka di GitHub", en: "Open on GitHub" },
  "report.githubHint": { id: "Butuh akun GitHub. Laporannya bisa dibaca siapa saja.", en: "Needs a GitHub account. Anyone can read the report." },
  "report.line": { id: "Kirim lewat LINE", en: "Send on LINE" },
  "report.lineHint": {
    id: "Ke LINE pengelola aplikasi: {id}. Hanya pengelola yang membacanya.",
    en: "To the app maintainer's LINE: {id}. Only the maintainer reads it.",
  },

  // After choosing
  "report.githubOpened": { id: "Lanjutkan di GitHub", en: "Finish on GitHub" },
  "report.githubFile": {
    id: "GitHub terbuka di browsermu. Seret {file} dari folder Unduhan ke laporannya, lalu kirim.",
    en: "GitHub opened in your browser. Drag {file} from your Downloads folder into the report, then submit it.",
  },
  "report.githubNoFile": {
    id: "GitHub terbuka di browsermu. Cek laporannya, lalu kirim.",
    en: "GitHub opened in your browser. Check the report, then submit it.",
  },
  "report.lineOpened": { id: "Lanjutkan di LINE", en: "Finish on LINE" },
  "report.lineFile": {
    id: "Laporannya sudah tersalin. Tempel di chat dengan {id}, lalu kirim juga {file} dari folder Unduhan.",
    en: "The report is copied. Paste it in the chat with {id}, then send {file} from your Downloads folder too.",
  },
  "report.lineNoFile": {
    id: "Laporannya sudah tersalin. Tempel di chat dengan {id}, lalu kirim.",
    en: "The report is copied. Paste it in the chat with {id}, then send it.",
  },
  "report.lineId": {
    id: "LINE pengelola aplikasi: {id}. Kalau LINE tidak terbuka, cari ID ini di LINE.",
    en: "The app maintainer's LINE: {id}. If LINE didn't open, search for this ID in LINE.",
  },
  "report.showFile": { id: "Tampilkan berkas", en: "Show the file" },
  "report.copy": { id: "Salin laporan", en: "Copy the report" },
  "report.copied": { id: "Laporan tersalin", en: "Report copied" },
  "report.openLine": { id: "Buka LINE", en: "Open LINE" },
  "report.done": { id: "Selesai", en: "Done" },
  "report.failed": { id: "Laporan tidak bisa disiapkan. Coba lagi.", en: "The report couldn't be prepared. Try again." },
  "report.sendFailed": { id: "Laporan tidak bisa disimpan atau dibuka. Coba lagi.", en: "The report couldn't be saved or opened. Try again." },

  // The report's own words: the summary pasted on LINE and put in the GitHub issue
  "report.summary.title": { id: "Laporan dari Edunex Plus {version}", en: "Report from Edunex Plus {version}" },
  "report.summary.from": { id: "Laporan dari Edunex Plus {version} di {os}", en: "Report from Edunex Plus {version} on {os}" },
  "report.summary.status": { id: "Status: {list}", en: "Status: {list}" },
  "report.summary.doing": { id: "Yang sedang kulakukan: {note}", en: "What I was doing: {note}" },
  "report.summary.file": { id: "Halaman yang sudah disamarkan: {file}", en: "The scrubbed page: {file}" },
} as const satisfies Record<string, Entry>;
