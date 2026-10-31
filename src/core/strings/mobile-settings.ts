// Text only the Android app shows on Settings, Search and Notifikasi (round 2's phone redesign). Written with the copywriting skill.
import type { Entry } from "./entry";

export const mobileSettingsStrings = {
  // Settings: the group with the attendance target (SIX's count, Kehadiran in the glossary).
  "mobile.settings.attendance": { id: "Kehadiran", en: "Attendance" },
  // Search: the × in the field empties it.
  "mobile.search.clear": { id: "Hapus pencarian", en: "Clear search" },
  // Notifikasi: the row at the end, to the notification settings.
  "mobile.alerts.settingsHint": { id: "Pilih yang dikirim ke HP-mu", en: "Choose what reaches your phone" },
} as const satisfies Record<string, Entry>;
