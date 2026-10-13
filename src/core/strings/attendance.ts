// Text for the attendance guard (#85): the Presensi screen, its alerts and
// the attendance target in Settings.
import type { Entry } from "./entry";

export const attendanceStrings = {
  // Alerts: a Presence window opened, naming the action Edunex counts there
  "alert.presenceOpen": { id: "Presensi dibuka · {course}", en: "Presence open · {course}" },
  "alert.presence.course": { id: "Buka mata kuliahnya di Edunex · tutup {time}", en: "Open the course in Edunex · closes {time}" },
  "alert.presence.module": { id: "Buka modulnya di Edunex · tutup {time}", en: "Open the module in Edunex · closes {time}" },
  "alert.presence.thread": { id: "Ikut diskusinya di Edunex · tutup {time}", en: "Join the discussion in Edunex · closes {time}" },
  "alert.presence.assignment": { id: "Kumpulkan {task} · tutup {time}", en: "Hand in {task} · closes {time}" },
  "alert.presence.assignmentUnknown": { id: "Kumpulkan tugasnya di Edunex · tutup {time}", en: "Hand in the Task in Edunex · closes {time}" },
  "alert.presence.note": { id: "{note} · tutup {time}", en: "{note} · closes {time}" },
  "alert.presence.exam": { id: "Kerjakan ujiannya di Edunex · tutup {time}", en: "Take the exam in Edunex · closes {time}" },
  "alert.presence.vicon": { id: "Gabung kelas daring dari Edunex · tutup {time}", en: "Join the online class from Edunex · closes {time}" },
  "alert.presence.crs": { id: "Ikut CRS di Edunex · tutup {time}", en: "Join CRS in Edunex · closes {time}" },
  "alert.presence.other": { id: "Lakukan yang diminta dosen di Edunex · tutup {time}", en: "Do what the lecturer set in Edunex · closes {time}" },

  // Alerts: SIX after a class, and the absence budget
  "alert.six.absent": { id: "SIX mencatatmu tidak hadir · {course}", en: "SIX marked you absent · {course}" },
  "alert.six.missing": { id: "SIX belum mencatat kuliah hari ini · {course}", en: "SIX hasn't recorded today's class · {course}" },
  "alert.six.body": {
    id: "Hadir {attended} dari {held} di SIX. Jika kamu hadir, minta dosen memperbaikinya hari ini.",
    en: "Attended {attended} of {held} in SIX. If you were there, ask your lecturer to fix it today.",
  },
  "alert.attendance.none": { id: "Jangan absen lagi · {course}", en: "Don't miss any more · {course}" },
  "alert.attendance.none.body": {
    id: "Hadir {attended} dari {held} di SIX: hadiri setiap pertemuan tersisa untuk tetap {target}%.",
    en: "Attended {attended} of {held} in SIX: attend every remaining meeting to stay at {target}%.",
  },
  "alert.attendance.out": { id: "Target {target}% tak tercapai lagi · {course}", en: "{target}% out of reach · {course}" },
  "alert.attendance.out.body": {
    id: "Paling tinggi {best}%. Jika SIX melewatkan pertemuan yang kamu hadiri, minta dosen memperbaikinya.",
    en: "Best case {best}%. If SIX missed a meeting you attended, ask your lecturer to fix it.",
  },

  // The Presensi screen: the answer on top
  "presence.answer.none": { id: "Jangan absen lagi di {codes}.", en: "Don't miss another class in {codes}." },
  "presence.answer.out": { id: "{codes} sudah tak bisa capai {target}%.", en: "{codes} can't reach {target}% anymore." },
  "presence.answer.one": { id: "Masih bisa absen 1× lagi di {codes}.", en: "You can miss 1 more class in {codes}." },
  "presence.answer.below": {
    id: "{codes} di bawah target sekarang: hadir terus untuk naik lagi.",
    en: { one: "{codes} is below target for now: keep attending to get back.", other: "{codes} are below target for now: keep attending to get back." },
  },
  "presence.answer.safe": {
    id: "Semua aman. Paling mepet {code}: masih bisa absen {count}× lagi.",
    en: {
      one: "All good. The closest is {code}: you can miss {count} more class.",
      other: "All good. The closest is {code}: you can miss {count} more classes.",
    },
  },
  "presence.answer.noSix": { id: "Jatah absen dihitung dari SIX", en: "Absences left are counted from SIX" },
  "presence.answer.noCount": { id: "SIX belum punya hitungan kehadiran", en: "SIX has no attendance count yet" },

  // The target
  "presence.target": { id: "Target {value}%", en: "Target {value}%" },
  "presence.target.button": { id: "Target kehadiran {value}%", en: "Attendance target {value}%" },
  "presence.target.global": {
    id: "Untuk mata kuliah yang tak punya target sendiri: di Presensi, Beranda, dan pengingat.",
    en: "For every course without its own target: on Presence, Home and in alerts.",
  },
  "presence.target.reset": { id: "Kembali ke {value}%", en: "Back to {value}%" },
  "presence.target.lower": { id: "Turunkan target umum", en: "Lower the default target" },
  "presence.target.raise": { id: "Naikkan target umum", en: "Raise the default target" },
  "presence.target.lowerFor": { id: "Turunkan target {code}", en: "Lower the {code} target" },
  "presence.target.raiseFor": { id: "Naikkan target {code}", en: "Raise the {code} target" },
  "presence.target.for": { id: "Target {value}% untuk {code}", en: "Target {value}% for {code}" },
  "presence.target.course": { id: "Target kehadiran {code}", en: "{code} attendance target" },
  "presence.target.followsDefault": { id: "Sekarang ikut target umum.", en: "It follows your default target now." },
  "presence.target.ownSet": { id: "Target khusus mata kuliah ini.", en: "This course's own target." },
  "presence.target.useDefault": { id: "Pakai target umum ({value}%)", en: "Use the default ({value}%)" },
  "presence.target.contract": { id: "Samakan dengan batas minimal di kontrak kuliahnya.", en: "Match the minimum in its course contract." },
  "presence.meter.target": {
    id: "Hadir {attended} dari {held}, {share}%, target {target}%",
    en: "Attended {attended} of {held}, {share}%, target {target}%",
  },

  // What's left, in words: the same on every screen
  "presence.budget.safe": {
    id: "Masih bisa absen {count}× lagi",
    en: { one: "You can miss {count} more class", other: "You can miss {count} more classes" },
  },
  "presence.budget.none": { id: "Jangan absen lagi", en: "Don't miss another class" },
  "presence.budget.out": { id: "Tak bisa lagi capai {target}% · paling tinggi {best}%", en: "Can't reach {target}% anymore · at best {best}%" },
  "presence.budget.unknown": { id: "Belum ada hitungan SIX", en: "No SIX count yet" },
  "presence.status.out": { id: "Tak bisa lagi capai {target}%", en: "Can't reach {target}% anymore" },

  // A course's row
  "presence.courses": { id: "Mata kuliah", en: "Courses" },
  "presence.row.count": { id: "Hadir {attended} dari {held}", en: "Attended {attended} of {held}" },
  "presence.row.left": {
    id: "{count} pertemuan lagi sampai {date}",
    en: { one: "{count} meeting left until {date}", other: "{count} meetings left until {date}" },
  },
  "presence.row.leftAbout": {
    id: "sekitar {count} pertemuan lagi sampai {date}",
    en: { one: "about {count} meeting left until {date}", other: "about {count} meetings left until {date}" },
  },
  "presence.row.leftNoDate": {
    id: "{count} pertemuan lagi di jadwal SIX",
    en: { one: "{count} meeting left on SIX's timetable", other: "{count} meetings left on SIX's timetable" },
  },
  "presence.row.leftNone": { id: "tak ada pertemuan lagi", en: "no meetings left" },
  "presence.row.best": { id: "paling tinggi {best}% di akhir kuliah", en: "at best {best}% by the last class" },
  "presence.edunexTally": { id: "Edunex: hadir {recorded} dari {closed} Presensi", en: "Edunex: present in {recorded} of {closed}" },
  "presence.row.next": { id: "Berikutnya: {when}", en: "Next: {when}" },
  "presence.row.now": { id: "Sedang berlangsung sampai {time}", en: "On now until {time}" },
  "presence.record.six": { id: "cukup hadir di kelas", en: "just be in class" },
  "presence.record.both": { id: "hadir, lalu isi Presensi Edunex", en: "be in class, then check in on Edunex" },
  "presence.record.edunex": { id: "isi Presensi Edunex tiap pertemuan", en: "check in on Edunex every meeting" },
  "presence.record.bothDo": { id: "hadir, lalu {action} sebelum {time}", en: "be in class, then {action} before {time}" },
  "presence.record.edunexDo": { id: "Presensi Edunex: {action} sebelum {time}", en: "Edunex Presence: {action} before {time}" },
  "presence.row.window": { id: "Presensi Edunex {when}: {action}", en: "Edunex Presence {when}: {action}" },
  "presence.row.optional": { id: "Presensi Edunex juga dibuka sampai {time}, tidak wajib.", en: "Edunex Presence is also open until {time}; it's optional." },
  "presence.warn.uncertain": {
    id: "{date} masuk {period}, jadi kuliahnya mungkin tak ada. Kalau tetap ada, hadiri: tetap dihitung.",
    en: "{date} is in {period}, so the class may not run. If it does, go: it still counts.",
  },
  "presence.warn.uncertainHoliday": {
    id: "{date} hari libur, jadi kuliahnya mungkin tak ada. Kalau tetap ada, hadiri: tetap dihitung.",
    en: "{date} is a holiday, so the class may not run. If it does, go: it still counts.",
  },
  "presence.warn.needed": {
    id: "{date} masuk {period}: {target}% hanya masih bisa kalau kuliahnya tetap ada dan kamu hadir.",
    en: "{date} is in {period}: {target}% is within reach only if that class runs and you go.",
  },
  "presence.warn.neededHoliday": {
    id: "{date} hari libur: {target}% hanya masih bisa kalau kuliahnya tetap ada dan kamu hadir.",
    en: "{date} is a holiday: {target}% is within reach only if that class runs and you go.",
  },
  "presence.period.uts": { id: "masa UTS", en: "the UTS period" },
  "presence.period.uas": { id: "masa UAS", en: "the UAS period" },
  "presence.period.off": { id: "masa ujian atau libur", en: "an exam week or a holiday" },
  "presence.warn.out": {
    id: "Ada pertemuan yang kamu hadiri tapi tak tercatat? Minta dosen membetulkannya di SIX.",
    en: "Was a class you attended not counted? Ask your lecturer to fix it in SIX.",
  },
  "presence.recover": {
    id: "Hadiri {count} pertemuan berikutnya untuk kembali ke {target}%",
    en: { one: "Attend the next class to get back to {target}%", other: "Attend the next {count} classes to get back to {target}%" },
  },
  "presence.checkSix": { id: "Cek di SIX", en: "Check in SIX" },

  // An Edunex Presence window open now that counts
  "presence.open.title": { id: "Presensi yang dibuka sekarang", en: "Presence open now" },
  "presence.open.do": { id: "{action} sebelum {time}", en: "{action} before {time}" },
  "presence.open.counts": { id: "{code} · dicatat lewat Presensi Edunex", en: "{code} · recorded through Edunex Presence" },
  "presence.open.notKnown": {
    id: "{code} · belum tahu dihitung di mana; mengisinya tidak ada ruginya",
    en: "{code} · not known yet where it counts; filling it in costs nothing",
  },
  "presence.open.noSix": {
    id: "{code} · tanpa SIX, belum pasti ini dihitung: catat saja untuk berjaga-jaga",
    en: "{code} · without SIX it's not certain this counts: record it just in case",
  },
  "presence.open.left": { id: "{time} lagi", en: "{time} left" },
  "presence.open.record": { id: "Catat di Edunex", en: "Record in Edunex" },
  "presence.open.task": { id: "Buka tugasnya", en: "Open the Task" },
  "presence.action.course": { id: "Buka mata kuliahnya di Edunex", en: "Open the course in Edunex" },
  "presence.action.module": { id: "Buka modulnya di Edunex", en: "Open the module in Edunex" },
  "presence.action.thread": { id: "Ikut diskusinya di Edunex", en: "Join the discussion in Edunex" },
  "presence.action.assignment": { id: "Kumpulkan {task}", en: "Hand in {task}" },
  "presence.action.assignmentUnknown": { id: "Kumpulkan tugasnya di Edunex", en: "Hand in the Task in Edunex" },
  "presence.action.exam": { id: "Kerjakan ujiannya di Edunex", en: "Take the exam in Edunex" },
  "presence.action.vicon": { id: "Gabung kelas daring dari Edunex", en: "Join the online class from Edunex" },
  "presence.action.crs": { id: "Ikut CRS di Edunex", en: "Join CRS in Edunex" },
  "presence.action.other": { id: "Lakukan yang diminta dosen di Edunex", en: "Do what the lecturer set in Edunex" },

  // How it's counted (closed until opened)
  "presence.how": { id: "Cara menghitungnya", en: "How this is counted" },
  "presence.how.six": {
    id: "Jumlah hadir dan pertemuan diambil dari SIX (“Hadir X dari Y pertemuan”), catatan resminya.",
    en: "Attended and held meetings come from SIX (“Hadir X dari Y pertemuan”), the official record.",
  },
  "presence.how.which": {
    id: "SIX hanya memberi jumlahnya, bukan pertemuan mana yang absen. Untuk tahu yang mana, buka jadwalmu di SIX.",
    en: "SIX gives only the totals, not which meeting you missed. To see which, open your timetable in SIX.",
  },
  "presence.how.left": {
    id: "Sisa pertemuan mengikuti jadwal SIX, lalu jadwal mingguannya sampai hari kuliah terakhir ({date}, Kalender ITB), tanpa minggu UTS, UAS dan libur.",
    en: "Meetings left follow SIX's timetable, then the weekly slot up to the last lecture day ({date}, ITB calendar), skipping UTS, UAS and holidays.",
  },
  "presence.how.uncertain": {
    id: "Kuliah yang masih dijadwalkan SIX di minggu UTS, UAS atau hari libur belum pasti ada, jadi tidak dihitung sebagai jatah absen, tapi juga tak membuat target dianggap tak terkejar. Kalau ternyata tetap ada, hadiri: tetap dihitung.",
    en: "A class SIX still lists in a UTS or UAS week or on a holiday may not run, so it isn't counted toward your absences left, nor does it put your target out of reach. If it does run, go: it still counts.",
  },
  "presence.how.edunex": {
    id: "Di mata kuliah yang dicatat SIX, Presensi Edunex yang tak kamu isi bukan absen.",
    en: "Where SIX keeps the count, an Edunex Presence you didn't fill in isn't an absence.",
  },
  "presence.how.target": {
    id: "Tidak ada batas minimal untuk seluruh ITB: kontrak tiap mata kuliah yang menentukan. Atur target tiap mata kuliah di barisnya.",
    en: "There's no ITB-wide minimum: each course contract sets its own. Set a course's target on its row.",
  },
  "presence.how.check": {
    id: "Setelah tiap kuliah, aplikasi memeriksa hitungan SIX bertambah, dan memberi tahu hari itu juga jika tidak.",
    en: "After each class the app checks that SIX's count went up, and tells you the same day if it didn't.",
  },
  "presence.openSix": { id: "Buka jadwal di SIX", en: "Open the timetable in SIX" },
  "presence.empty": { id: "Belum ada mata kuliah", en: "No courses yet" },
  "presence.noSix.hint": {
    id: "Masuk ke SIX untuk melihat kehadiran resmimu dan berapa kali lagi kamu bisa absen di tiap mata kuliah.",
    en: "Sign in to SIX to see your official attendance and how many more classes you can miss in each course.",
  },
  "presence.signInSix": { id: "Masuk ke SIX", en: "Sign in to SIX" },

  // Settings
  "settings.attendance.target": { id: "Target kehadiran", en: "Attendance target" },
  "settings.attendance.targetHint": {
    id: "Untuk semua mata kuliah. Target satu mata kuliah bisa diatur di Presensi.",
    en: "For every course. Set one course's own target on Presence.",
  },
  "settings.attendance.targetHintOwn": { id: "Untuk mata kuliah tanpa target sendiri", en: "For courses without their own target" },
  "settings.attendance.own": { id: "{code} · target sendiri", en: "{code} · its own target" },
  "settings.attendance.useDefault": { id: "Pakai target umum", en: "Use the default" },
  "settings.attendance.useDefaultFor": { id: "Pakai target umum untuk {code}", en: "Use the default for {code}" },
  "settings.alerts.presence": { id: "Presensi dibuka", en: "Presence opens" },
  "settings.alerts.presenceHint": { id: "Langsung, dengan apa yang perlu kamu lakukan", en: "Right away, with what you need to do" },
  "settings.alerts.needsSix": { id: "butuh SIX", en: "needs SIX" },
  "settings.alerts.attendanceRisk": { id: "Kehadiran", en: "Attendance" },
  "settings.alerts.attendanceRiskHint": {
    id: "SIX tidak mencatat kuliah, jatah absen habis",
    en: "SIX didn't count a class, no absences left",
  },
} as const satisfies Record<string, Entry>;
