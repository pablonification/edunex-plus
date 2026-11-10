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
  // Long instructions folded to their first lines, so the answer box shows on a Task's first screen: the way to the rest,
  // and back.
  "mobile.tasks.more": { id: "Selengkapnya", en: "Show more" },
  "mobile.tasks.less": { id: "Lebih sedikit", en: "Show less" },
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
  // The answer card's one line beside "Draf" (its half-circle says not handed in, TalkBack hears handIn.draftStatus).
  "mobile.tasks.draftSavedShort": { id: "disimpan {when}", en: "saved {when}" },
  // A Task that is also Presensi: its line on the due card is task.attendanceLine ("Presensi 15:00–23:59"); a tap opens
  // a small sheet with why (the desktop's task.note.attendance, and what happens outside that time), under this title.
  "mobile.tasks.presenceWhy": { id: "Tugas ini juga Presensi", en: "This Task is also attendance" },
  "mobile.tasks.presenceWhyBody": {
    id: "Kamu terhitung hadir hanya jika mengumpulkannya {date}, {time}. Di luar waktu itu, tugasmu tetap terkumpul, tapi tidak dihitung hadir.",
    en: "You count as present only if you hand it in {date}, {time}. Outside that time it's still handed in, but not counted present.",
  },
  // Right over a Kumpulkan that can't be pressed yet, what's missing in a few words (the full sentence is spoken on the
  // button): the kind of file the instructions name, when they name one.
  "mobile.handIn.why.noFile": { id: "Lampirkan berkas dulu", en: "Attach a file first" },
  "mobile.handIn.why.noFileType": { id: "Lampirkan {type} dulu", en: "Attach a {type} first" },
  // Right over Kumpulkan while handing in now wouldn't count as present yet: when Presensi opens ("besok, 15:00").
  "mobile.handIn.why.opens": { id: "Presensi dibuka {when}", en: "Presence opens {when}" },
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
  // superapp: Tugas
  // The first words under the counts when nothing runs out today (a group named "Hari ini" says it when something does).
  "mobile.tasks.today": { id: "Hari ini", en: "Today" },
  "mobile.tasks.todayNone": { id: "Tidak ada tenggat hari ini", en: "Nothing due today" },
  // After a hand-in, where Kumpulkan was: what's next in one tap, or the way to see it under Selesai.
  "mobile.tasks.movedToDone": { id: "Sudah masuk Selesai", en: "Now under Done" },
  "mobile.tasks.see": { id: "Lihat", en: "See" },
  "mobile.tasks.seeDone": { id: "Lihat di Selesai", en: "See it in Done" },
  "mobile.tasks.next": { id: "Berikutnya", en: "Next" },
  // superapp: Tugas, round 2
  // A Task's page: where it stands in one line ("Terkumpul 18 Sep", with "terlambat" after it when it went in past the
  // deadline), then marks, a glyph and a word each, their sentences a sheet away: whether the hand-in counted as
  // present, a Presensi that closed without it, a window that is short ("Hanya 2 jam").
  "mobile.tasks.handedInOn": { id: "Terkumpul {date}", en: "Handed in {date}" },
  "mobile.tasks.handedInLate": { id: "terlambat", en: "late" },
  "mobile.tasks.present": { id: "Hadir", en: "Present" },
  "mobile.tasks.notPresent": { id: "Tidak hadir", en: "Not present" },
  "mobile.tasks.presenceMissed": { id: "Presensi terlewat", en: "Presence missed" },
  "mobile.tasks.shortWindow": { id: "Hanya {duration}", en: "Only {duration}" },
  // A lecturer's edit as one row ("Diubah dosen 22 Sep") with "Sudah kucek"; its info button's name for TalkBack.
  "mobile.tasks.editedOn": { id: "Diubah dosen {date}", en: "Lecturer edited {date}" },
  "mobile.tasks.editedWhy": { id: "Tentang perubahan ini", en: "About this change" },
  // What a row or the lead card is when it's an exam, beside the exam glyph.
  "mobile.tasks.kindExam": { id: "Ujian", en: "Exam" },
} as const satisfies Record<string, Entry>;
