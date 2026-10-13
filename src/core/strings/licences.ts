// Text for Settings → Tentang → Lisensi sumber terbuka: the open-source software
// the app is built with, each with its licence.
import type { Entry } from "./entry";

export const licencesStrings = {
  "licences.title": { id: "Lisensi sumber terbuka", en: "Open-source licences" },
  "licences.hint": { id: "Perangkat lunak yang dipakai Edunex Plus, beserta lisensinya", en: "The software Edunex Plus is built with, and its licences" },
  "licences.view": { id: "Lihat", en: "View" },
  "licences.viewAll": { id: "Lihat lisensi sumber terbuka", en: "View open-source licences" },
  "licences.intro": {
    id: "Edunex Plus dibangun dengan {count} perangkat lunak sumber terbuka, masing-masing dengan lisensinya sendiri.",
    en: {
      one: "Edunex Plus is built with {count} open-source project, under its own licence.",
      other: "Edunex Plus is built with {count} open-source projects, each under its own licence.",
    },
  },
  "licences.search": { id: "Cari nama atau lisensi", en: "Search by name or licence" },
  "licences.source": { id: "Kode sumber {name}", en: "Source code of {name}" },
  "licences.failed": { id: "Daftar lisensi belum bisa dimuat", en: "The list of licences couldn't be loaded" },
  "licences.chromium": {
    id: "Lisensi Chromium dan Node.js, juga semua perangkat lunak sumber terbuka di dalamnya, ada di berkas {file} di folder aplikasi.",
    en: "The licences of Chromium and Node.js, and of all the open-source software inside them, are in {file}, in the app's folder.",
  },
} as const satisfies Record<string, Entry>;
