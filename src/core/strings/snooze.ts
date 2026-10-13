// Text for "Ingatkan nanti" (Remind me later): putting a Beranda item or a
// course's attendance banner off until a moment that fits, the Undo, the
// list of what's put off, and Settings' "show all again".
import type { Entry } from "./entry";

export const snoozeStrings = {
  "snooze.action": { id: "Ingatkan nanti", en: "Remind me later" },
  "snooze.actionFor": { id: "Ingatkan nanti: {title}", en: "Remind me later: {title}" },
  // The choices, each with until when under it
  "snooze.choice.hours": { id: "3 jam lagi", en: "In 3 hours" },
  "snooze.choice.morning": { id: "Besok pagi", en: "Tomorrow morning" },
  "snooze.choice.opens": { id: "Saat dibuka", en: "When it opens" },
  "snooze.choice.dayBefore": { id: "Sehari sebelumnya", en: "The day before" },
  "snooze.choice.dayBeforeDue": { id: "Sehari sebelum tenggat", en: "The day before it's due" },
  "snooze.choice.beforeClass": { id: "Sebelum kuliah berikutnya", en: "Before the next class" },
  "snooze.choice.change": { id: "Sampai ada perubahan", en: "Until something changes" },
  "snooze.atLatest": { id: "Paling lambat {when}", en: "{when} at the latest" },
  // Said back, with Undo
  "snooze.done": { id: "Diingatkan lagi {when}", en: "Back {when}" },
  "snooze.doneChange": { id: "Disembunyikan sampai ada perubahan", en: "Hidden until something changes" },
  "action.undo": { id: "Urungkan", en: "Undo" },
  // What's put off, at the end of "Perlu perhatianmu"
  "snooze.count": { id: "{count} ditunda", en: "{count} snoozed" },
  "snooze.showList": { id: "Tampilkan", en: "Show" },
  "snooze.hideList": { id: "Sembunyikan", en: "Hide" },
  "snooze.list": { id: "Yang ditunda", en: "Snoozed" },
  "snooze.until": { id: "Kembali {when}", en: "Back {when}" },
  "snooze.untilChange": { id: "Sampai ada perubahan, paling lambat {when}", en: "Until something changes, {when} at the latest" },
  "snooze.wake": { id: "Ingatkan sekarang", en: "Remind me now" },
  "snooze.wakeFor": { id: "Ingatkan sekarang: {title}", en: "Remind me now: {title}" },
  "home.needs.allSnoozed": { id: "Tidak ada lagi yang perlu perhatianmu sekarang", en: "Nothing else needs you now" },
  // Settings
  "settings.snoozed": { id: "Pengingat yang ditunda ({count})", en: "Snoozed reminders ({count})" },
  "settings.snoozed.hint": { id: "Di Beranda dan halaman mata kuliah. Notifikasi tetap muncul.", en: "On Home and course pages. Notifications still come." },
  "settings.snoozed.wakeAll": { id: "Tampilkan semua lagi", en: "Show all again" },
  "settings.snoozed.woken": { id: "Semua pengingat tampil lagi", en: "All reminders are back" },
} as const satisfies Record<string, Entry>;
