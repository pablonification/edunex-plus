// Text for SIX records: grades, curriculum, KRS, bills (#78, #79, #80).
import type { Entry } from "./entry";

export const sixRecordsStrings = {
  // Nilai and Rencana studi, when a grade or SKS on SIX's records can't be read yet (ADR 0011): the courses their estimates leave out.
  "sixRecords.unread": {
    id: "Perkiraan di sini belum menghitung {codes} karena nilai atau SKS-nya di SIX belum terbaca.",
    en: {
      one: "Estimates here leave out {codes}, since its grade or SKS on SIX isn't read yet.",
      other: "Estimates here leave out {codes}, since their grades or SKS on SIX aren't read yet.",
    },
  },
  // The same, for more courses than a line can name.
  "sixRecords.unreadMany": {
    id: "Perkiraan di sini belum menghitung {count} mata kuliah karena nilai atau SKS-nya di SIX belum terbaca.",
    en: "Estimates here leave out {count} courses, since their grades or SKS on SIX aren't read yet.",
  },
} as const satisfies Record<string, Entry>;
