// Text for SIX sign-in, courses and timetable (#76).
import type { Entry } from "./entry";

export const sixStrings = {
  // Connecting (welcome screen, Settings)
  "welcome.sixDetail": { id: "Jadwal dan ruang, hitungan kehadiran, nilai, KRS, UKT", en: "Timetable and rooms, attendance count, grades, KRS, UKT" },
  "welcome.connectSource": { id: "Hubungkan {source}", en: "Connect {source}" },
  "welcome.continue": { id: "Lanjut", en: "Continue" },
  "account.signInTo": { id: "Masuk ke {source}", en: "Sign in to {source}" },
  "account.signOutOf": { id: "Keluar dari {source}", en: "Sign out of {source}" },
  "signIn.sixTitle": { id: "Masuk ke SIX", en: "Sign in to SIX" },

  // This term's courses
  "course.sks": { id: "{count} SKS", en: "{count} SKS" },
  "course.noMeetingsYet": { id: "Belum ada pertemuan", en: "No meetings yet" },
  "course.notOnEdunex": { id: "Tidak ada di Edunex", en: "Not on Edunex" },
  "action.openInSix": { id: "Buka di SIX", en: "Open in SIX" },
} as const satisfies Record<string, Entry>;
