// Text for "new version available" (#82).
import type { Entry } from "./entry";

export const updatesStrings = {
  "update.available": { id: "Versi baru tersedia", en: "New version available" },
  "update.version": { id: "Edunex Plus {version}", en: "Edunex Plus {version}" },
  "update.download": { id: "Unduh", en: "Download" },
} as const satisfies Record<string, Entry>;
