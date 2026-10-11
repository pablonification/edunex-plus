// Text for the attendance guard (#85): the Presensi screen, its alerts and
// the attendance target in Settings.
import type { Entry } from "./entry";

export const attendanceStrings = {
  // Alerts: a Presence window opened, naming the action EduNex counts there
  "alert.presenceOpen": { id: "Presensi dibuka · {course}", en: "Presence open · {course}" },
  "alert.presence.course": { id: "Buka mata kuliahnya di EduNex · tutup {time}", en: "Open the course in EduNex · closes {time}" },
  "alert.presence.module": { id: "Buka modulnya di EduNex · tutup {time}", en: "Open the module in EduNex · closes {time}" },
  "alert.presence.thread": { id: "Ikut diskusinya di EduNex · tutup {time}", en: "Join the discussion in EduNex · closes {time}" },
  "alert.presence.assignment": { id: "Kumpulkan {task} · tutup {time}", en: "Hand in {task} · closes {time}" },
  "alert.presence.assignmentUnknown": { id: "Kumpulkan tugasnya di EduNex · tutup {time}", en: "Hand in the Task in EduNex · closes {time}" },
  "alert.presence.note": { id: "{note} · tutup {time}", en: "{note} · closes {time}" },
  "alert.presence.exam": { id: "Kerjakan ujiannya di EduNex · tutup {time}", en: "Take the exam in EduNex · closes {time}" },
  "alert.presence.vicon": { id: "Gabung kelas daring dari EduNex · tutup {time}", en: "Join the online class from EduNex · closes {time}" },
  "alert.presence.crs": { id: "Ikut CRS di EduNex · tutup {time}", en: "Join CRS in EduNex · closes {time}" },
  "alert.presence.other": { id: "Lakukan yang diminta dosen di EduNex · tutup {time}", en: "Do what the lecturer set in EduNex · closes {time}" },

  // Alerts: SIX after a class, and the absence budget
  "alert.six.absent": { id: "SIX mencatatmu tidak hadir · {course}", en: "SIX marked you absent · {course}" },
  "alert.six.missing": { id: "SIX belum mencatat kuliah hari ini · {course}", en: "SIX hasn't recorded today's class · {course}" },
  "alert.six.body": {
    id: "Hadir {attended} dari {held} di SIX. Jika kamu hadir, minta dosen memperbaikinya hari ini.",
    en: "Attended {attended} of {held} in SIX. If you were there, ask your lecturer to fix it today.",
  },
  "alert.attendance.none": { id: "Tidak boleh absen lagi · {course}", en: "No absences left · {course}" },
  "alert.attendance.none.body": {
    id: "Hadir {attended} dari {held} di SIX: hadiri setiap pertemuan tersisa untuk tetap {target}%.",
    en: "Attended {attended} of {held} in SIX: attend every remaining meeting to stay at {target}%.",
  },
  "alert.attendance.out": { id: "Target {target}% tak tercapai lagi · {course}", en: "{target}% out of reach · {course}" },
  "alert.attendance.out.body": {
    id: "Paling tinggi {best}%. Jika SIX melewatkan pertemuan yang kamu hadiri, minta dosen memperbaikinya.",
    en: "Best case {best}%. If SIX missed a meeting you attended, ask your lecturer to fix it.",
  },

  // The Presensi screen
  "presence.target": { id: "Target {value}%", en: "Target {value}%" },
  "presence.target.lower": { id: "Turunkan target", en: "Lower the target" },
  "presence.target.raise": { id: "Naikkan target", en: "Raise the target" },
  "presence.summary.out": { id: "Tak bisa lagi capai {target}%", en: "Can't reach {target}% anymore" },
  "presence.summary.none": { id: "Tidak boleh absen lagi", en: "No absences left" },
  "presence.summary.risk": { id: "Tinggal satu absen", en: "One absence left" },
  "presence.summary.safe": { id: "Masih aman", en: "Room to spare" },
  "presence.countedIn": { id: "Dihitung di", en: "Counted in" },
  "presence.countedIn.unknown": { id: "Belum ada catatan kehadiran", en: "No attendance record yet" },
  "presence.next": { id: "Berikutnya: {when}", en: "Next: {when}" },
  "presence.meetings": { id: "Pertemuan semester ini", en: "Meetings this semester" },
  "presence.tally": { id: "{attended} hadir · {missed} absen · {left} lagi", en: "{attended} attended · {missed} missed · {left} to go" },
  "presence.tallyAbout": { id: "{attended} hadir · {missed} absen · sekitar {left} lagi", en: "{attended} attended · {missed} missed · about {left} to go" },
  "presence.share": { id: "Kehadiran di SIX {value}%, target {target}%", en: "Attendance in SIX {value}%, target {target}%" },
  "presence.budget.safe": { id: "Boleh absen {count}x lagi", en: { one: "{count} more absence allowed", other: "{count} more absences allowed" } },
  "presence.budget.none": { id: "Tidak boleh absen lagi", en: "No more absences" },
  "presence.budget.out": { id: "{target}% tak tercapai · maks. {best}%", en: "{target}% out of reach · best {best}%" },
  "presence.budget.unknown": { id: "Belum ada hitungan SIX", en: "No SIX count yet" },
  "presence.best": { id: "Paling tinggi {value}%", en: "Best case {value}%" },
  "presence.recover": {
    id: "Kembali ke {target}% setelah {count}x hadir berturut-turut",
    en: { one: "Back to {target}% after {count} in a row", other: "Back to {target}% after {count} in a row" },
  },
  "presence.note.edunexUnused": {
    id: "EduNex mencatat {recorded} dari {closed} Presensi, tapi SIX, tempat kehadiranmu dihitung, mencatat {attended} dari {held}. Presensi EduNex yang tak tercatat bukan absen.",
    en: "EduNex recorded {recorded} of {closed} Presence windows, but SIX, where you're counted, has {attended} of {held}. An unrecorded EduNex window isn't an absence.",
  },
  "presence.note.edunexOnly": {
    id: "Hanya EduNex yang mencatat: {recorded} dari {closed} Presensi tercatat hadir.",
    en: "Only EduNex keeps a record: present in {recorded} of {closed} Presence windows.",
  },
  "presence.note.assignment": {
    id: "Sebagian Presensi EduNex hanya terhitung jika tugasnya dikumpulkan di dalam jendela waktunya.",
    en: "Some EduNex Presence windows count only if you hand in their Task inside the window.",
  },
  "presence.note.exam": { id: "{activity} {date} memakai slot kuliah, bukan pertemuan.", en: "{activity} on {date} takes a lecture slot; it isn't a meeting." },
  "presence.note.out": {
    id: "Jika SIX melewatkan pertemuan yang kamu hadiri, minta dosen memperbaikinya sekarang. Cek kontrak kuliah untuk akibatnya di bawah {target}%.",
    en: "If SIX missed a meeting you attended, ask your lecturer to fix it now. Check your course contract for what happens below {target}%.",
  },
  "presence.open": { id: "Presensi EduNex dibuka", en: "EduNex Presence is open" },
  "presence.open.alsoSix": { id: "Kehadiranmu dihitung di SIX; Presensi EduNex juga dibuka.", en: "You're counted in SIX; EduNex Presence is open too." },
  "presence.open.copy": {
    id: "Salinan materi di aplikasi ini tidak dihitung, jadi tombolnya membuka EduNex.",
    en: "The saved copy in this app doesn't count, so the button opens EduNex.",
  },
  "presence.action.course": { id: "Buka mata kuliahnya di EduNex", en: "Open the course in EduNex" },
  "presence.action.module": { id: "Buka modulnya di EduNex", en: "Open the module in EduNex" },
  "presence.action.thread": { id: "Ikut diskusinya di EduNex", en: "Join the discussion in EduNex" },
  "presence.action.assignment": { id: "Kumpulkan {task}", en: "Hand in {task}" },
  "presence.action.assignmentUnknown": { id: "Kumpulkan tugasnya di EduNex", en: "Hand in the Task in EduNex" },
  "presence.action.exam": { id: "Kerjakan ujiannya di EduNex", en: "Take the exam in EduNex" },
  "presence.action.vicon": { id: "Gabung kelas daring dari EduNex", en: "Join the online class from EduNex" },
  "presence.action.crs": { id: "Ikut CRS di EduNex", en: "Join CRS in EduNex" },
  "presence.action.other": { id: "Lakukan yang diminta dosen di EduNex", en: "Do what the lecturer set in EduNex" },
  "presence.openInEdunex": { id: "Buka di EduNex", en: "Open in EduNex" },
  "presence.how": { id: "Cara menghitungnya", en: "How this is counted" },
  "presence.how.six": {
    id: "Hadir dan jumlah pertemuan dari hitungan SIX sendiri (“Hadir X dari Y pertemuan”), catatan resmi.",
    en: "Attended and held meetings come from SIX's own count (“Hadir X dari Y pertemuan”), the official record.",
  },
  "presence.how.left": {
    id: "Sisa pertemuan mengikuti jadwal SIX, lalu jadwal mingguannya sampai hari kuliah terakhir ({date}, Kalender ITB), tanpa minggu UTS, UAS dan libur.",
    en: "Meetings left follow SIX's timetable, then the weekly slot up to the last lecture day ({date}, ITB calendar), skipping UTS, UAS and holidays.",
  },
  "presence.how.target": {
    id: "Tidak ada batas minimal untuk seluruh ITB: kontrak tiap mata kuliah yang menentukan.",
    en: "There's no ITB-wide minimum: each course contract sets its own.",
  },
  "presence.how.check": {
    id: "Setelah tiap kuliah, aplikasi memeriksa hitungan SIX bertambah, dan memberi tahu hari itu juga jika tidak.",
    en: "After each class the app checks that SIX's count went up, and tells you the same day if it didn't.",
  },
  "presence.empty": { id: "Belum ada mata kuliah", en: "No courses yet" },
  "presence.absencesLeft": { id: "Jatah absen", en: "Absences left" },

  // Settings
  "settings.attendance.target": { id: "Target kehadiran", en: "Attendance target" },
  "settings.attendance.targetHint": { id: "Kontrak tiap mata kuliah menentukan batasnya", en: "Each course contract sets its own minimum" },
  "settings.alerts.presence": { id: "Presensi dibuka", en: "Presence opens" },
  "settings.alerts.presenceHint": { id: "Langsung, dengan aktivitas yang dihitung", en: "Immediately, with the action that counts" },
  "settings.alerts.attendanceRisk": { id: "Kehadiran", en: "Attendance" },
  "settings.alerts.attendanceRiskHint": {
    id: "SIX tidak mencatat kuliah, jatah absen habis",
    en: "SIX didn't count a class, no absences left",
  },
} as const satisfies Record<string, Entry>;
