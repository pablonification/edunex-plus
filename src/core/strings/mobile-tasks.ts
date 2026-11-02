// Text only the Android app shows on the Tugas tab, a Task and an exam (round 2's phone redesign). Written with the copywriting skill.
import type { Entry } from "./entry";

export const mobileTasksStrings = {
  // Tugas while the first list is on its way: what a screen reader hears over the placeholders.
  "mobile.tasks.loading": { id: "Memuat tugasmu", en: "Loading your Tasks" },
  // A Task's answer, as two labelled parts: the text box, and the files with it.
  "mobile.tasks.answerText": { id: "Teks jawaban", en: "Answer text" },
  "mobile.tasks.answerFiles": { id: "Berkas jawaban", en: "Answer files" },
  // Under the empty answer box: Edunex takes no hand-in without text (the desktop's handIn.why.noText, said where it's typed).
  "mobile.tasks.answerRequired": { id: "Wajib diisi, meski kamu melampirkan berkas", en: "Required, even when you attach a file" },
  // Over a Kumpulkan that can't be pressed yet, in one line: the box above says why.
  "mobile.tasks.why.noText": { id: "Tulis jawabanmu dulu", en: "Write your answer first" },
  // Tugas's big card: what its wave says to a screen reader, how much of a Task's time (from when it opened) has gone.
  "mobile.tasks.timeGone": { id: "Sudah lewat {percent}% dari waktunya", en: "{percent}% of its time has gone" },
  // A Task that is also attendance: one line under the deadline on its due card, with a hand icon (no chip: the card's
  // one status is Edunex's), saying when to hand it in to count as present ("Jum 15:00–23:59"). The desktop's
  // task.note.attendance, in the phone's few words.
  "mobile.tasks.presenceLine": { id: "Kumpulkan {when} agar hadir", en: "Hand in {when} to count as present" },
  // The moment a Task is handed in, over the page for a breath: its detail is handIn.recorded ("Edunex mencatatnya hari ini, 10:02").
  "mobile.tasks.handedIn": { id: "Terkumpul", en: "Handed in" },
  // An exam row's one status when SIX and Edunex give it different days (the days themselves on the exam's page).
  "mobile.tasks.chip.disagree": { id: "Tanggal beda", en: "Dates differ" },
} as const satisfies Record<string, Entry>;
