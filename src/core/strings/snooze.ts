// Text for "Ingatkan nanti" (Remind me later): putting a Beranda item or a
// course's attendance banner off until a moment that fits, the Undo, the
// list of what's put off, and Settings' "show all again". Then "Sudah beres"
// (Handled): the ✓ where only the Student can know an item is dealt with, in
// a casual first person ("Sudah kucek"), what it says back, and its list.
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
  // Handled: the ✓ on a row (its name and tooltip say which item)
  "done.checked": { id: "Sudah kucek", en: "Mark as checked" },
  "done.checkedFor": { id: "Sudah kucek: {title}", en: "Mark as checked: {title}" },
  "done.groupDone": { id: "Kelompokku sudah kumpul", en: "Mark as done" },
  "done.groupDoneFor": { id: "Kelompokku sudah kumpul: {title}", en: "Mark as done: {title}" },
  "done.gotIt": { id: "Sudah tahu", en: "Got it" },
  "done.gotItFor": { id: "Sudah tahu: {title}", en: "Got it: {title}" },
  "done.paid": { id: "Sudah kubayar", en: "Mark as paid" },
  "done.paidFor": { id: "Sudah kubayar: {title}", en: "Mark as paid: {title}" },
  // Handled on the Task page: a Task not handed in on Edunex
  "done.otherWay": { id: "Tidak mengumpulkan lewat Edunex?", en: "Not handing it in on Edunex?" },
  "done.otherWay.menu": { id: "Tandai", en: "Mark it" },
  "done.otherWay.menuFor": { id: "Tandai tugas yang tidak dikumpulkan lewat Edunex", en: "Mark a Task not handed in on Edunex" },
  "done.handedElsewhere": { id: "Sudah kukumpulkan dengan cara lain", en: "Handed in another way" },
  "done.handedElsewhere.hint": {
    id: "Lewat email atau langsung ke dosen. Tidak ada pengingat lagi, kecuali tugasnya berubah.",
    en: "By email or in person. No more reminders unless the Task changes.",
  },
  "done.notHandingIn": { id: "Tidak kukumpulkan", en: "Not handing it in" },
  "done.notHandingIn.hint": {
    id: "Tidak ada pengingat lagi, kecuali tenggat atau tugasnya berubah.",
    en: "No more reminders unless the deadline or the Task changes.",
  },
  "done.undoFor": { id: "Urungkan: {what}", en: "Undo: {what}" },
  "done.groupAsk": { id: "Kelompokmu sudah mengumpulkan?", en: "Has your group handed it in?" },
  "done.groupDone.hint": { id: "Tidak ada pengingat lagi, kecuali tugasnya berubah.", en: "No more reminders unless the Task changes." },
  // Said back, with Undo
  "done.toast.checked": {
    id: "Ditandai sudah dicek. Muncul lagi hanya jika dosen mengubahnya lagi.",
    en: "Marked as checked. Back only if your lecturer edits it again.",
  },
  "done.toast.groupDone": {
    id: "Ditandai sudah dikumpulkan kelompokmu. Muncul lagi hanya jika tugasnya berubah.",
    en: "Marked as done. Back only if the Task changes.",
  },
  "done.toast.handedElsewhere": {
    id: "Ditandai sudah dikumpulkan. Muncul lagi hanya jika tugasnya berubah.",
    en: "Marked as handed in. Back only if the Task changes.",
  },
  "done.toast.notHandingIn": {
    id: "Ditandai tidak dikumpulkan. Muncul lagi hanya jika tenggat atau tugasnya berubah.",
    en: "Marked as not handing it in. Back only if the deadline or the Task changes.",
  },
  "done.toast.gotIt": {
    id: "Sudah tahu. Muncul lagi hanya jika target kehadiran {course} berubah.",
    en: "Got it. Back only if {course}'s attendance target changes.",
  },
  "done.toast.gotItClass": { id: "Sudah tahu. Muncul lagi sehari sebelum kuliah berikutnya.", en: "Got it. Back the day before the next class." },
  "done.toast.gotItCount": { id: "Sudah tahu. Muncul lagi saat SIX mencatat pertemuan berikutnya.", en: "Got it. Back when SIX counts the next class." },
  "done.toast.paid": {
    id: "Ditandai sudah dibayar. Muncul lagi jika tagihannya berubah atau lewat batas bayar.",
    en: "Marked as paid. Back if the bill changes or passes its due date.",
  },
  // What's handled, at the end of "Perlu perhatianmu"
  "done.count": { id: "{count} sudah beres", en: "{count} handled" },
  "done.list": { id: "Sudah beres", en: "Handled" },
  "done.line.checked": { id: "Sudah dicek {when}", en: "Checked {when}" },
  "done.line.groupDone": { id: "Dikumpulkan kelompokmu, ditandai {when}", en: "Your group handed it in, marked {when}" },
  "done.line.handedElsewhere": { id: "Dikumpulkan dengan cara lain, ditandai {when}", en: "Handed in another way, marked {when}" },
  "done.line.notHandingIn": { id: "Tidak dikumpulkan, ditandai {when}", en: "Not handing it in, marked {when}" },
  "done.line.gotIt": { id: "Sudah tahu sejak {when}", en: "Got it {when}" },
  "done.line.paid": { id: "Ditandai sudah dibayar {when}", en: "Marked as paid {when}" },
  "done.showAgain": { id: "Tampilkan lagi", en: "Show again" },
  "done.showAgainFor": { id: "Tampilkan lagi: {title}", en: "Show again: {title}" },
  "home.needs.allHandled": { id: "Semua sudah beres untuk sekarang", en: "You've handled everything for now" },
  // Settings
  "settings.snoozed": { id: "Pengingat yang ditunda atau sudah beres ({count})", en: "Snoozed and handled ({count})" },
  "settings.snoozed.hint": {
    id: "Hanya di komputer ini, untuk Beranda, halaman tugas, dan halaman mata kuliah. Notifikasi perubahan baru tetap muncul.",
    en: "Only on this computer, for Home, Task pages and course pages. Notifications about new changes still come.",
  },
  "settings.snoozed.wakeAll": { id: "Tampilkan semua lagi", en: "Show all again" },
  "settings.snoozed.woken": { id: "Semua pengingat tampil lagi", en: "All reminders are back" },
} as const satisfies Record<string, Entry>;
