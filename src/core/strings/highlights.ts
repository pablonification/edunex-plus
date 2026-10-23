// Text for highlighting in the file viewers ("Sorotan"): the highlighter's
// colors, the bar over the selected text or a highlight, what a highlight is
// called to a screen reader, and what's said back. Color names are plain
// words, never "warna 2".
import type { Entry } from "./entry";

export const highlightStrings = {
  "highlight.color.yellow": { id: "kuning", en: "yellow" },
  "highlight.color.green": { id: "hijau", en: "green" },
  "highlight.color.blue": { id: "biru", en: "blue" },
  "highlight.color.pink": { id: "merah muda", en: "pink" },
  // The bar over selected text: one button per color
  "highlight.bar": { id: "Sorot teks", en: "Highlight text" },
  "highlight.add": { id: "Sorot {color}", en: "Highlight in {color}" },
  "highlight.addKeys": { id: "Sorot {color} ({keys})", en: "Highlight in {color} ({keys})" },
  // The bar over a highlight: its colors, then Remove
  "highlight.edit": { id: "Sorotan", en: "Highlight" },
  "highlight.colors": { id: "Warna sorotan", en: "Highlight color" },
  "highlight.remove": { id: "Hapus sorotan", en: "Remove highlight" },
  "highlight.removeKeys": { id: "Hapus sorotan ({keys})", en: "Remove highlight ({keys})" },
  // A highlight, as a screen reader names it
  "highlight.label": { id: "Sorotan {color}: {text}", en: "Highlight in {color}: {text}" },
  // Said back
  "highlight.added": { id: "Disorot {color}", en: "Highlighted in {color}" },
  "highlight.recolored": { id: "Sorotan sekarang {color}", en: "The highlight is {color} now" },
  "highlight.removed": { id: "Sorotan dihapus", en: "Highlight removed" },
  "highlight.removedUndo": { id: "Sorotan dihapus. Urungkan dengan {keys}.", en: "Highlight removed. Undo with {keys}." },
  "highlight.restored": { id: "Sorotan dikembalikan", en: "Highlight put back" },
  "highlight.saveFailed": { id: "Sorotan tidak bisa disimpan. Coba lagi.", en: "Couldn't save the highlight. Try again." },
} as const satisfies Record<string, Entry>;
