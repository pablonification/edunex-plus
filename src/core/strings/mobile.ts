// Text only the Android app shows: its tabs, its notification channels, and what a phone does
// that the desktop doesn't (signing in on a page inside the app, the phone's calendar, files
// opened in other apps). Everything else on the phone uses the desktop's own keys.
import type { Entry } from "./entry";

export const mobileStrings = {
  // Bottom tabs: short, the screen's own title says the rest ("Tugas & Ujian").
  "mobile.tab.tasks": { id: "Tugas", en: "Tasks" },
  "mobile.tab.more": { id: "Lainnya", en: "More" },
  // Android's notification channels, as Settings › Notifications lists them.
  "mobile.channel.presence": { id: "Presensi dibuka dan ditutup", en: "Presence opening and closing" },
  "mobile.channel.alerts": { id: "Tugas, tenggat dan perubahan", en: "Tasks, deadlines and changes" },
} as const satisfies Record<string, Entry>;
