// Text only the Android app shows on Akademik, Nilai and the study plan's screens (round 2's phone redesign). Written with the copywriting skill.
import type { Entry } from "./entry";

export const mobileAcademicStrings = {
  // Nilai (v4): the IPK card's quiet line and pill, the rows on the way to graduating, this term's two dates.
  "mobile.grades.lastIp": { id: "IP semester lalu {ip}", en: "Last semester's IP {ip}" },
  "mobile.grades.toGraduation": { id: "Menuju lulus", en: "On the way to graduating" },
  "mobile.grades.fromSix": { id: "Dari KRS-mu di SIX", en: "From your KRS on SIX" },
  // Beside the IPK, as plain words: the predicate it heads for, named as the one at graduation when today's differs.
  "mobile.grades.predicateAtEnd": { id: "{predicate} saat lulus", en: "{predicate} at graduation" },
  // An honor still open: the average it needs, as the blind pair preferred it (round 3). Over which SKS is its ⓘ sheet,
  // so "26 SKS" never sits beside the card's "125 dari 144" (which leaves 19).
  "mobile.grades.honorsAverage": { id: "Butuh rata-rata {avg}", en: "Needs a {avg} average" },
  // The sheet: the SKS that average is over, where they are, and, when it's more, why it isn't the SKS left to graduate.
  "mobile.grades.honorsWhy": {
    id: "Rata-rata nilai di {sks} SKS yang belum bernilai: {term} SKS semester ini dan {plan} SKS di rencanamu.",
    en: "Your average over the {sks} SKS not graded yet: {term} SKS this semester and {plan} SKS in your plan.",
  },
  "mobile.grades.honorsWhyTerm": {
    id: "Rata-rata nilai di {sks} SKS semester ini yang belum bernilai.",
    en: "Your average over this semester's {sks} SKS not graded yet.",
  },
  "mobile.grades.honorsWhyMore": {
    id: "Ini bukan SKS yang tersisa untuk lulus ({left} SKS), karena semua mata kuliah di rencanamu ikut dihitung.",
    en: "That isn't the SKS left to graduate ({left} SKS), since every course in your plan counts.",
  },
  // An honor even straight A's can't reach: one word in place of a second number.
  "mobile.grades.honorsOut": { id: "Tak terkejar", en: "Out of reach" },
  // The best IPK still possible: straight A's in what has no grade yet (which SKS: the honor's ⓘ sheet), in a short meta.
  "mobile.grades.bestHint": { id: "Jika semua A", en: "With straight A's" },
  "mobile.grades.questionnaire": { id: "Isi kuesioner agar nilai terlihat", en: "Fill in the questionnaire to see grades" },
  "mobile.grades.questionnaireUntil": { id: "Sampai {date}", en: "Until {date}" },
  "mobile.grades.gradeDeadline": { id: "Batas dosen memasukkan nilai", en: "Lecturers' deadline for grades" },
  // Rencana (v4): the leading card's label over the semester the plan graduates in, or over its SKS when it can't yet.
  "mobile.planner.finishIn": { id: "Lulus di semester", en: "Graduating in semester" },
  "mobile.planner.sksInPlan": { id: "SKS di rencanamu", en: "SKS in your plan" },
  // Rencana's section headings, short.
  "mobile.planner.rules": { id: "Aturan", en: "Rules" },
  "mobile.planner.minors": { id: "Minor terdekat", en: "Closest minors" },
  // Rencana's last row: where the plan is kept and how honors are decided, in a sheet.
  "mobile.planner.about": { id: "Tentang rencana ini", en: "About this plan" },
  "mobile.planner.aboutMeta": { id: "Tersimpan di HP ini · syarat predikat", en: "Kept on this phone · honors rules" },
  // Akademik's leading card: the IPK and SKS passed, the whole card opening Nilai.
  "mobile.academic.sksOf": { id: "dari {need}", en: "of {need}" },
  "mobile.academic.openGrades": { id: "Buka Nilai", en: "Open Nilai" },
  "mobile.academic.noIpk": { id: "IPK muncul di sini setelah SIX terbaca.", en: "Your IPK shows here once SIX is read." },
  // The to-do chips under it: only while there's something to do this term.
  "mobile.academic.todo": { id: "Perlu kamu urus", en: "To take care of" },
  "mobile.academic.todo.krs": { id: "Kirim KRS", en: "Send your KRS" },
  "mobile.academic.todo.bills": { id: "Bayar UKT", en: "Pay UKT" },
  "mobile.academic.todo.deadlines": { id: "Isi kuesioner", en: "Fill in the questionnaire" },
  // Each screen's row: one line that answers its question, never the card's IPK or SKS again.
  "mobile.academic.meta.plannerSemester": { id: "Lulus di semester {n}", en: "Graduating in semester {n}" },
  "mobile.academic.meta.plannerShort": { id: "Rencanamu belum cukup untuk lulus", en: "Your plan isn't enough to graduate yet" },
  // A row's one status, as a pill: KRS's clashes still to come, the date this term's UKT is due by.
  "mobile.academic.pill.clash": {
    id: "{count} bentrok",
    en: { one: "{count} clash", other: "{count} clashes" },
  },
  "mobile.academic.pill.billsDue": { id: "Bayar s.d. {date}", en: "Pay by {date}" },
  // Kalender akademik's line, where a date's full name ran to two lines: what to do, short ("Isi kuesioner · 30 Nov").
  "mobile.academic.deadline.questionnaire": { id: "Isi kuesioner", en: "Questionnaire" },
  "mobile.academic.meta.deadlineNow": { id: "{what} · sekarang", en: "{what} · now" },
  "mobile.academic.meta.deadlineNext": { id: "{what} · {date}", en: "{what} · {date}" },
  // Kurikulum: the leading figure's unit ("112 dari 144 SKS").
  "mobile.curriculum.ofSks": { id: "dari {need} SKS", en: "of {need} SKS" },
  // Kurikulum: the one row about the curriculum itself, its sheet saying why. An older start, leading its line.
  "mobile.curriculum.started": { id: "Mulai di Kurikulum {from}", en: "Started on Kurikulum {from}" },
  // KRS: the SKS taken as the leading figure, SIX's KRS page while there's one to send, each clash as a row.
  "mobile.krs.sksLabel": { id: "SKS diambil", en: "SKS taken" },
  "mobile.krs.ofMax": { id: "dari maks. {max} SKS", en: "of max. {max} SKS" },
  "mobile.krs.openSix": { id: "Buka KRS di SIX", en: "Open KRS in SIX" },
  "mobile.krs.clash.title": { id: "{a} bentrok dengan {b}", en: "{a} clashes with {b}" },
  "mobile.krs.clash.meta": {
    id: "Berikutnya {when} · {count} pertemuan",
    en: { one: "Next {when} · {count} meeting", other: "Next {when} · {count} meetings" },
  },
  "mobile.krs.clashPast.title": { id: "{a} dan {b} sempat bentrok", en: "{a} and {b} overlapped" },
  "mobile.krs.clashPast.meta": {
    id: "Terakhir {when} · {count} pertemuan",
    en: { one: "Last {when} · {count} meeting", other: "Last {when} · {count} meetings" },
  },
  // UKT: the deadline under the leading amount, and SIX's bill page while there's something to pay.
  "mobile.bills.deadlineOn": { id: "Batas bayar {date}", en: "Due {date}" },
  "mobile.bills.openSix": { id: "Buka tagihan di SIX", en: "Open the bill in SIX" },
  // Kalender akademik: the next date's days to go as the leading figure, and the folds' counts.
  "mobile.calendar.daysLeft": { id: "hari lagi", en: { one: "day to go", other: "days to go" } },
  "mobile.calendar.today": { id: "Hari ini", en: "Today" },
  "mobile.calendar.noneLeft": { id: "Belum ada tanggal berikutnya di kalender ITB.", en: "No next date on ITB's calendar yet." },
  "mobile.calendar.dates": { id: "{count} tanggal", en: { one: "{count} date", other: "{count} dates" } },
} as const satisfies Record<string, Entry>;
