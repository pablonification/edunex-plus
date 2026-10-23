// Text for the Student's own notes in the file viewers ("Catatan halaman"):
// the toolbar's button, the panel beside the file, a page's mark, and what's
// said back. "Catatanku" on the button, so they're never taken for a
// lecturer's "Catatan" on Edunex.
import type { Entry } from "./entry";

export const pageNoteStrings = {
  // The toolbar's button, and its tooltip for a PDF or for a file read as one text
  "pageNote.open": { id: "Catatanku", en: "My notes" },
  "pageNote.openHint": { id: "Catatan per halaman, hanya di komputer ini", en: "A note for each page, on this computer only" },
  "pageNote.openHintFile": { id: "Catatan untuk berkas ini, hanya di komputer ini", en: "A note on this file, on this computer only" },
  // The panel: its title (also a page's mark), the box, and the file's other notes
  "pageNote.title": { id: "Catatan halaman {page}", en: "Note on page {page}" },
  "pageNote.titleFile": { id: "Catatan berkas ini", en: "Note on this file" },
  // The empty note's placeholder says once, on a line of its own, where notes stay
  "pageNote.placeholder": {
    id: "Tulis catatan untuk halaman ini.\nHanya disimpan di komputer ini.",
    en: "Write a note for this page.\nIt stays on this computer.",
  },
  "pageNote.placeholderFile": {
    id: "Tulis catatan untuk berkas ini.\nHanya disimpan di komputer ini.",
    en: "Write a note for this file.\nIt stays on this computer.",
  },
  // Shown for a moment after a note is saved, and the box's description for screen readers
  "pageNote.saved": { id: "Tersimpan", en: "Saved" },
  "pageNote.kept": { id: "Tersimpan otomatis saat kamu berhenti mengetik, hanya di komputer ini.", en: "Saved when you stop typing, on this computer only." },
  "pageNote.remove": { id: "Hapus catatan", en: "Delete note" },
  "pageNote.removeShort": { id: "Hapus", en: "Delete" },
  "pageNote.close": { id: "Tutup catatan", en: "Close notes" },
  "pageNote.others": { id: "Catatan di halaman lain", en: "Notes on other pages" },
  "pageNote.page": { id: "Hal. {page}", en: "p. {page}" },
  "pageNote.item": { id: "Halaman {page}, {text}", en: "Page {page}, {text}" },
  // Said back
  "pageNote.removed": { id: "Catatan dihapus", en: "Note deleted" },
  "pageNote.saveFailed": { id: "Catatan tidak bisa disimpan. Coba lagi.", en: "Couldn't save the note. Try again." },
} as const satisfies Record<string, Entry>;
