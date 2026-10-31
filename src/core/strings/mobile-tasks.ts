// Text only the Android app shows on the Tugas tab, a Task and an exam (round 2's phone redesign). Written with the copywriting skill.
import type { Entry } from "./entry";

export const mobileTasksStrings = {
  // Tugas while the first list is on its way: what a screen reader hears over the placeholders.
  "mobile.tasks.loading": { id: "Memuat tugasmu", en: "Loading your Tasks" },
  // A Task's answer, as two labelled parts: the text box, and the files with it.
  "mobile.tasks.answerText": { id: "Teks jawaban", en: "Answer text" },
  "mobile.tasks.answerFiles": { id: "Berkas jawaban", en: "Answer files" },
  // The moment a Task is handed in, over the page for a breath: its detail is handIn.recorded ("Edunex mencatatnya hari ini, 10:02").
  "mobile.tasks.handedIn": { id: "Terkumpul", en: "Handed in" },
} as const satisfies Record<string, Entry>;
