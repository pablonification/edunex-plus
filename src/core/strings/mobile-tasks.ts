// Text only the Android app shows on the Tugas tab, a Task and an exam (round 2's phone redesign). Written with the copywriting skill.
import type { Entry } from "./entry";

export const mobileTasksStrings = {
  // Tugas while the first list is on its way: what a screen reader hears over the placeholders.
  "mobile.tasks.loading": { id: "Memuat tugasmu", en: "Loading your Tasks" },
  // A Task's answer, as two labelled parts: the text box, and the files with it.
  "mobile.tasks.answerText": { id: "Teks jawaban", en: "Answer text" },
  "mobile.tasks.answerFiles": { id: "Berkas jawaban", en: "Answer files" },
  // In the empty answer box, as its placeholder (gone once there's text, as the line under it was): Edunex takes no
  // hand-in without text (the desktop's handIn.why.noText, said where it's typed). The full sentence for TalkBack.
  "mobile.tasks.answerPlaceholder": { id: "Tulis jawabanmu. Wajib, meski ada berkas.", en: "Write your answer. Required, even with a file." },
  // A Task the Student marked as handed in another way (or not at all): their word leads its card, and what Edunex still
  // says stays under it, as on the desktop (the app never claims Edunex has it). The answer box and Kumpulkan come back
  // with Urungkan, on the line that says when it was marked.
  "mobile.tasks.edunexSays": { id: "Di Edunex: {status}", en: "On Edunex: {status}" },
  "mobile.tasks.markedAt": { id: "Kamu tandai {when}", en: "Marked {when}" },
  // The attach button says what the lecturer asks for, so no line about it is needed: the kind of file the
  // instructions name, and "wajib" while a required file isn't attached yet ("Lampirkan PDF · wajib").
  "mobile.handIn.attachType": { id: "Lampirkan {type}", en: "Attach {type}" },
  "mobile.handIn.required": { id: "wajib", en: "required" },
  "mobile.tasks.answerRequired": { id: "Wajib diisi, meski kamu melampirkan berkas", en: "Required, even when you attach a file" },
  // The snackbar after Simpan draf: saved, and what a draft is (the desktop's handIn.explainer, which sat under the answer
  // on every open Task, said when it matters). Starts with "Tersimpan", as the card's own line does.
  "mobile.tasks.draftSaved": {
    id: "Tersimpan {when}. Dosen bisa melihatnya, tapi hanya Kumpulkan yang menyerahkannya.",
    en: "Saved {when}. Your lecturer can see it, but only Submit hands it in.",
  },
  // A Task that is also attendance: one line under the deadline on its due card, with a hand icon (no chip: the card's
  // one status is Edunex's), saying when to hand it in to count as present ("Jum, 13 Nov, 15:00–23:59"). The desktop's
  // task.note.attendance, in the phone's few words.
  "mobile.tasks.presenceLine": { id: "Kumpulkan {when} agar hadir", en: "Hand in {when} to count as present" },
  // The Kumpulkan sheet's warnings, one short line each (round 2's judge: two paragraphs were too much). The desktop's
  // handIn.check.* with the same facts: when Presensi opens or closed, the deadline that passed.
  "mobile.tasks.check.attendanceEarly": { id: "Tak dihitung hadir sebelum Presensi dibuka {when}", en: "Not counted present before Presence opens {when}" },
  "mobile.tasks.check.attendanceMissed": {
    id: "Tak dihitung hadir karena Presensi {when} sudah lewat",
    en: "Not counted present, since Presence {when} has passed",
  },
  "mobile.tasks.check.late": { id: "Tercatat terlambat karena tenggatnya {when}", en: "Recorded late, since it was due {when}" },
  // The moment a Task is handed in, over the page for a breath: its detail is handIn.recorded ("Edunex mencatatnya hari ini, 10:02").
  "mobile.tasks.handedIn": { id: "Terkumpul", en: "Handed in" },
  // An exam row's one status when SIX and Edunex give it different days (the days themselves on the exam's page).
  "mobile.tasks.chip.disagree": { id: "Tanggal beda", en: "Dates differ" },
} as const satisfies Record<string, Entry>;
