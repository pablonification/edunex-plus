// Text only the Android app shows on Akademik, Nilai and the study plan's screens (round 2's phone redesign). Written with the copywriting skill.
import type { Entry } from "./entry";

export const mobileAcademicStrings = {
  // Akademik's leading card: the IPK and SKS passed, the whole card opening Nilai.
  "mobile.academic.sksOf": { id: "dari {need}", en: "of {need}" },
  "mobile.academic.openGrades": { id: "Buka Nilai", en: "Open Nilai" },
  "mobile.academic.noIpk": { id: "IPK muncul di sini setelah SIX terbaca.", en: "Your IPK shows here once SIX is read." },
  // The to-do chips under it: only while there's something to do this term.
  "mobile.academic.todo": { id: "Perlu kamu urus", en: "To take care of" },
  "mobile.academic.todo.krs": { id: "Kirim KRS", en: "Send your KRS" },
  "mobile.academic.todo.bills": { id: "Bayar UKT", en: "Pay UKT" },
  "mobile.academic.todo.deadlines": { id: "Isi kuesioner", en: "Fill in the questionnaire" },
  // Each screen's row: one line that answers its question.
  "mobile.academic.meta.grades": { id: "IPK {ipk} · IP terakhir {ip}", en: "IPK {ipk} · last IP {ip}" },
  "mobile.academic.meta.gradesIpk": { id: "IPK {ipk}", en: "IPK {ipk}" },
  "mobile.academic.meta.plannerSemester": { id: "Lulus di semester {n}", en: "Graduating in semester {n}" },
  "mobile.academic.meta.plannerShort": { id: "Rencanamu belum cukup untuk lulus", en: "Your plan isn't enough to graduate yet" },
  "mobile.academic.meta.curriculum": { id: "{passed} dari {need} SKS lulus", en: "{passed} of {need} SKS passed" },
  "mobile.academic.meta.curriculumRequired": {
    id: "{count} mata kuliah wajib tersisa",
    en: { one: "{count} required course left", other: "{count} required courses left" },
  },
  "mobile.academic.meta.krsClash": {
    id: "{count} jadwal bentrok",
    en: { one: "{count} timetable clash", other: "{count} timetable clashes" },
  },
  "mobile.academic.meta.billsDue": { id: "Bayar paling lambat {date}", en: "Pay by {date}" },
  "mobile.academic.meta.deadlineNow": { id: "{what} · sekarang", en: "{what} · now" },
  "mobile.academic.meta.deadlineNext": { id: "{what} · {date}", en: "{what} · {date}" },
  "mobile.academic.meta.needSix": { id: "Butuh SIX", en: "Needs SIX" },
} as const satisfies Record<string, Entry>;
