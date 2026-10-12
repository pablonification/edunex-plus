// Text for what lecturers write and upload, shown in the app: links that open
// in the browser, pictures in notes, long notes folded, files that can't be shown.
import type { Entry } from "./entry";

export const contentStrings = {
  "link.opensIn": { id: "Buka di browser · {host}", en: "Opens in your browser · {host}" },
  "link.failed": { id: "Tautan ke {host} tidak bisa dibuka", en: "Couldn't open the link to {host}" },
  "link.failedNoHost": { id: "Tautan ini tidak bisa dibuka", en: "Couldn't open this link" },
  "image.loading": { id: "Memuat gambar…", en: "Loading the picture…" },
  "image.from": { id: "Gambar dari {host}", en: "Picture from {host}" },
  "image.alt": { id: "Gambar dari dosen", en: "Picture from the lecturer" },
  "image.altYours": { id: "Gambar dalam jawabanmu", en: "Picture in your answer" },
  "file.problem.expired": { id: "Tautan berkas ini sudah tidak berlaku di Edunex.", en: "This file's link no longer works on Edunex." },
  "file.problem.missing": { id: "Berkas ini sudah tidak ada di Edunex.", en: "This file isn't on Edunex any more." },
  "file.problem.too-big": { id: "Berkas ini terlalu besar untuk ditampilkan di aplikasi.", en: "This file is too big to show in the app." },
  "file.problem.unreadable": { id: "Berkas ini tidak bisa ditampilkan di aplikasi.", en: "This file can't be shown in the app." },
  "file.problem.unreachable": { id: "Penyimpanan Edunex tidak terjangkau. Cek koneksimu.", en: "Couldn't reach Edunex's storage. Check your connection." },
  "note.more": { id: "Tampilkan semua", en: "Show all" },
  "note.less": { id: "Tampilkan lebih sedikit", en: "Show less" },
  "note.posted": { id: "Diposting {when}", en: "Posted {when}" },
  "note.updated": { id: "Diperbarui {when}", en: "Updated {when}" },
  "note.empty": { id: "Catatan ini kosong", en: "This note is empty" },
} as const satisfies Record<string, Entry>;
