// Text only the Android app shows on Settings, Search and Notifikasi (round 2's phone redesign). Written with the copywriting skill.
import type { Entry } from "./entry";

export const mobileSettingsStrings = {
  // Settings: the group with the attendance target (SIX's count, Kehadiran in the glossary).
  "mobile.settings.attendance": { id: "Kehadiran", en: "Attendance" },
  // Settings (v4): an alert row's one meta line while SIX is signed out and the alert needs it.
  "mobile.settings.needsSix": { id: "Butuh SIX", en: "Needs SIX" },
  // Settings (v4): the deadline reminder times row's value when no time is picked (no deadline reminders then).
  "mobile.settings.dueNone": { id: "Belum ada yang dipilih", en: "None picked" },
  // Search: the × in the field empties it.
  "mobile.search.clear": { id: "Hapus pencarian", en: "Clear search" },
  // Notifikasi's last row, to Settings › Notifikasi. The page's title already says "Notifikasi".
  "mobile.alerts.choose": { id: "Atur yang dikirim", en: "Choose what's sent" },
  "mobile.alerts.settingsHint": { id: "Pilih yang dikirim ke HP-mu", en: "Choose what reaches your phone" },
} as const satisfies Record<string, Entry>;
