// Text for each course's color: the picker (the sidebar, the course page and
// Settings open it), what it says back, and Settings' list. Color names are
// plain words, never "warna 3".
import type { Entry } from "./entry";

export const courseColorStrings = {
  // The picker
  "courseColor.title": { id: "Warna {code}", en: "Color for {code}" },
  "courseColor.current": { id: "Warna {code}: {color}", en: "Color for {code}: {color}" },
  "courseColor.auto": { id: "Otomatis: {color}", en: "Automatic: {color}" },
  "courseColor.picked": { id: "Pilihanmu: {color}. Otomatisnya {auto}.", en: "Your pick: {color}. Automatic would be {auto}." },
  "courseColor.autoChoice": { id: "Otomatis ({color})", en: "Automatic ({color})" },
  // Swatches, as screen readers say them: whole sentences, never "swatch 3"
  "courseColor.swatch.used": { id: "{color}, dipakai {codes}", en: "{color}, used by {codes}" },
  "courseColor.swatch.usedAuto": { id: "{color}, dipakai {codes}, yang akan pindah ke {next}", en: "{color}, used by {codes}, which would move to {next}" },
  "courseColor.swatch.alsoPicked": { id: "{color}, juga dipilih untuk {codes}", en: "{color}, also picked for {codes}" },
  // The note under the swatches: neutral, said once
  "courseColor.shared": {
    id: "{codes} juga {color}. Pilih warna lain supaya mudah dibedakan.",
    en: { one: "{codes} is {color} too. Pick another color to tell them apart.", other: "{codes} are {color} too. Pick another color to tell them apart." },
  },
  "courseColor.moved": { id: "{code} tadinya otomatis {color}, jadi pindah ke {next}.", en: "{code} had {color} automatically, so it moves to {next}." },
  "courseColor.full": {
    id: "Semua warna sudah dipakai. Dua mata kuliah boleh berwarna sama, kodenya tetap membedakan.",
    en: "Every color is in use. Two courses may share one, and the code tells them apart.",
  },
  // Said back, with Undo
  "courseColor.done": { id: "{code} sekarang {color}", en: "{code} is {color} now" },
  "courseColor.doneMoved": { id: "{code} sekarang {color}. {other} pindah ke {next}.", en: "{code} is {color} now. {other} moved to {next}." },
  "courseColor.backToAuto": { id: "{code} kembali ke warna otomatis", en: "{code} is back to its automatic color" },
  "courseColor.allBack": {
    id: "{count} mata kuliah kembali ke warna otomatis",
    en: { one: "{count} course is back to its automatic color", other: "{count} courses are back to their automatic colors" },
  },
  // Where it opens, and how a course's color is described
  "courseColor.change": { id: "Ganti warna", en: "Change color" },
  "courseColor.automatic": { id: "otomatis", en: "automatic" },
  "courseColor.yours": { id: "pilihanmu", en: "your pick" },
  "courseColor.sameAs": { id: "sama dengan {codes}", en: "same as {codes}" },
  "nav.courseColors": { id: "Warna mata kuliah", en: "Course colors" },
  // The palette, in its automatic order (src/core/course-colors.ts)
  "courseColor.name.cyan": { id: "Biru muda", en: "Cyan" },
  "courseColor.name.indigo": { id: "Nila", en: "Indigo" },
  "courseColor.name.berry": { id: "Beri", en: "Berry" },
  "courseColor.name.blue": { id: "Biru", en: "Blue" },
  "courseColor.name.orchid": { id: "Anggrek", en: "Orchid" },
  "courseColor.name.magenta": { id: "Magenta", en: "Magenta" },
  "courseColor.name.purple": { id: "Ungu", en: "Purple" },
  "courseColor.name.pink": { id: "Merah muda", en: "Pink" },
  "courseColor.name.plum": { id: "Plum", en: "Plum" },
  "courseColor.name.lavender": { id: "Lavender", en: "Lavender" },
  // Settings
  "settings.courseColors": { id: "Warna mata kuliah", en: "Course colors" },
  "settings.courseColors.note": {
    id: "Warna otomatis diberikan saat mata kuliah pertama muncul dan tidak berubah sendiri. Warna pilihanmu tetap ikut mata kuliahnya, semester depan juga.",
    en: "A course gets its automatic color when it first shows, and it never changes by itself. A color you pick stays with the course, next semester too.",
  },
  "settings.courseColors.preview": { id: "Pratinjau", en: "Preview" },
  "settings.courseColors.all": { id: "Semua mata kuliah", en: "All courses" },
  "settings.courseColors.allHint": { id: "{count} pilihanmu", en: { one: "{count} picked by you", other: "{count} picked by you" } },
  "settings.courseColors.allAuto": { id: "Semua otomatis", en: "All automatic" },
  "settings.courseColors.reset": { id: "Kembalikan semua ke otomatis", en: "Set all to automatic" },
} as const satisfies Record<string, Entry>;
