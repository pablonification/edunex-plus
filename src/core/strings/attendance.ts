// Text for the attendance guard (#85): the Presensi screen, its alerts and
// the attendance target in Settings. SIX's own button keeps its name in both
// languages, "Tandai Hadir": that's what the Student looks for in SIX.
import type { Entry } from "./entry";

export const attendanceStrings = {
  // Alerts: SIX's "Tandai Hadir" button showed in a class's popup
  "alert.checkIn": { id: "Tandai Hadir sudah dibuka · {course}", en: "Tandai Hadir is open in SIX · {course}" },
  "alert.checkInClosing": { id: "Belum Tandai Hadir · {course}", en: "Not marked present yet · {course}" },
  "alert.checkIn.body": {
    id: "Buka kelasnya di SIX, lalu tekan Tandai Hadir · kuliah sampai {time}",
    en: "Open the class in SIX and press Tandai Hadir · class until {time}",
  },

  // Alerts: a Presence window opened, naming the action Edunex counts there
  "alert.presenceOpen": { id: "Presensi dibuka · {course}", en: "Presence open · {course}" },
  "alert.presenceClosing": { id: "Presensi tutup 15 menit lagi · {course}", en: "Presence closes in 15 minutes · {course}" },
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
  "alert.six.missing": { id: "SIX belum menghitung kuliah hari ini · {course}", en: "SIX hasn't counted today's class · {course}" },
  "alert.six.body": {
    id: "Hadir {attended} dari {held} di SIX. Jika kamu hadir, minta dosen membetulkannya hari ini.",
    en: "Attended {attended} of {held} in SIX. If you were there, ask your lecturer to fix it today.",
  },
  "alert.attendance.none": { id: "Jatah absen habis · {course}", en: "No absences left · {course}" },
  "alert.attendance.none.body": {
    id: "Hadir {attended} dari {held} di SIX. Hadiri setiap pertemuan tersisa agar tetap {target}%.",
    en: "Attended {attended} of {held} in SIX. Attend every class left to stay at {target}%.",
  },
  "alert.attendance.out": { id: "Tak bisa lagi capai {target}% · {course}", en: "Can't reach {target}% anymore · {course}" },
  "alert.attendance.out.body": {
    id: "Kalaupun hadir di semua sisa pertemuan, kehadiranmu berakhir di {best}%. Jika SIX melewatkan pertemuan yang kamu hadiri, minta dosen membetulkannya.",
    en: "Even attending every class left, you'd end at {best}%. If SIX missed a class you attended, ask your lecturer to fix it.",
  },

  // The Presensi screen: the next class day, on top
  "presence.day.today": { id: "Hari ini ada {count} kuliah.", en: { one: "{count} class today.", other: "{count} classes today." } },
  "presence.day.tomorrow": { id: "Besok ada {count} kuliah.", en: { one: "{count} class tomorrow.", other: "{count} classes tomorrow." } },
  "presence.day.only": {
    id: "Hanya {codes} yang masih ada jatah absen.",
    en: { one: "Only {codes} has an absence to spare.", other: "Only {codes} have an absence to spare." },
  },
  "presence.day.all": { id: "Semuanya masih ada jatah absen.", en: "Each has an absence to spare." },
  "presence.day.one": { id: "Masih ada jatah absen.", en: "It has an absence to spare." },
  "presence.day.none": { id: "Tak ada yang masih punya jatah absen.", en: "None has an absence to spare." },
  "presence.day.oneNone": { id: "Jatah absennya sudah habis.", en: "It has no absences left." },
  "presence.day.next": { id: "Tak ada kuliah hari ini dan besok. Berikutnya {day}.", en: "No classes today or tomorrow. Your next is {day}." },
  "presence.ended": { id: "Kuliah berakhir {date}.", en: "Lectures ended {date}." },
  "presence.answer.noSix": { id: "Jatah absen dihitung dari SIX", en: "Absences left are counted from SIX" },
  "presence.noSix.noWatch": {
    id: "Sebelum itu, aplikasi tak bisa memberi tahu saat Tandai Hadir muncul.",
    en: "Before then, the app can't tell you when Tandai Hadir shows.",
  },

  // The targets
  "presence.target": { id: "Target {value}%", en: "Target {value}%" },
  "presence.targets.button": { id: "Target", en: "Targets" },
  "presence.targets.default": { id: "Target umum", en: "Default" },
  "presence.targets.own": { id: "Target sendiri", en: "Own target" },
  "presence.targets.useDefault": { id: "Pakai target umum ({value}%)", en: "Use the default ({value}%)" },
  "presence.targets.useDefaultFor": { id: "Pakai target umum untuk {code} ({value}%)", en: "Use the default for {code} ({value}%)" },
  "presence.target.lower": { id: "Turunkan target umum", en: "Lower the default target" },
  "presence.target.raise": { id: "Naikkan target umum", en: "Raise the default target" },
  "presence.target.lowerFor": { id: "Turunkan target {code}", en: "Lower the {code} target" },
  "presence.target.raiseFor": { id: "Naikkan target {code}", en: "Raise the {code} target" },
  "presence.target.for": { id: "Target {value}% untuk {code}", en: "Target {value}% for {code}" },
  "presence.target.course": { id: "Target kehadiran {code}", en: "{code} attendance target" },
  "presence.target.followsDefault": { id: "Sekarang ikut target umum.", en: "It follows your default target now." },
  "presence.target.ownSet": { id: "Target khusus mata kuliah ini.", en: "This course's own target." },
  "presence.target.useDefault": { id: "Pakai target umum ({value}%)", en: "Use the default ({value}%)" },
  "presence.target.contract": {
    id: "Samakan tiap mata kuliah dengan batas minimal di kontrak kuliahnya.",
    en: "Match each course to the minimum in its course contract.",
  },
  "presence.changeTarget": { id: "Ubah target", en: "Change target" },

  // What's left, in words: the same on every screen
  "presence.budget.safe": {
    id: "Sisa jatah absen {count}×",
    en: { one: "{count} absence left", other: "{count} absences left" },
  },
  "presence.budget.none": { id: "Jatah absen habis", en: "No absences left" },
  "presence.budget.out": { id: "Tak bisa lagi capai {target}%", en: "Can't reach {target}% anymore" },
  "presence.budget.unknown": { id: "Belum ada hitungan SIX", en: "No SIX count yet" },
  // Lectures are over: the final word, calm
  "presence.budget.met": { id: "Selesai, {target}% tercapai", en: "Finished, {target}% reached" },
  "presence.budget.missed": { id: "Selesai di bawah {target}%", en: "Finished below {target}%" },
  "presence.status.out": { id: "Tak bisa lagi capai {target}%", en: "Can't reach {target}% anymore" },

  // The groups, by what each course asks of the Student
  "presence.group.outMixed": { id: "Tak bisa lagi capai target", en: "Can't reach the target anymore" },
  "presence.group.none": { id: "Jatah absen habis", en: "No absences left" },
  "presence.group.edunex": { id: "Dicatat di Edunex", en: "Recorded in Edunex" },
  "presence.group.spare": { id: "Masih ada jatah absen", en: "Absences to spare" },
  "presence.group.met": { id: "{target}% tercapai", en: "{target}% reached" },
  "presence.group.metMixed": { id: "Target tercapai", en: "Target reached" },
  "presence.group.missedMixed": { id: "Selesai di bawah target", en: "Finished below the target" },

  // The absence bar ("Jatah absen"): one segment per absence the target allows this term
  "presence.bar.label": { id: "Jatah absen", en: "Absences" },
  "presence.bar.used": { id: "Terpakai {count}×", en: "{count} used" },
  "presence.bar.noneUsed": { id: "Belum terpakai", en: "None used" },
  "presence.bar.left": { id: "sisa {count}×", en: "{count} left" },
  "presence.bar.noneLeft": { id: "habis", en: "none left" },
  "presence.bar.over": { id: "lebih {count}× untuk {target}%", en: "{count} too many for {target}%" },
  "presence.bar.about": { id: "Sekitar {count}× semester ini", en: "About {count} allowed this term" },
  "presence.bar.zero": { id: "Tak boleh absen", en: "No absences allowed" },
  "presence.bar.a11y": {
    id: "Jatah absen semester ini {allowed}×. Terpakai {used}×, sisa {left}×.",
    en: "Absences this term. {used} of {allowed} used, {left} left.",
  },
  "presence.bar.a11yFull": {
    id: "Jatah absen semester ini {allowed}×. Semua sudah terpakai.",
    en: "Absences this term. All {allowed} used, none left.",
  },
  "presence.bar.a11yOver": {
    id: "Jatah absen semester ini {allowed}×. Terpakai {used}×, lebih {over}×.",
    en: "Absences this term. {used} used, {allowed} allowed, {over} too many.",
  },
  "presence.bar.a11yAbout": {
    id: "Jatah absen semester ini sekitar {count}×.",
    en: { one: "About {count} absence allowed this term.", other: "About {count} absences allowed this term." },
  },
  "presence.bar.a11ySoFar": {
    id: "Jatah absen di jadwal SIX sejauh ini {allowed}×. Terpakai {used}×, sisa {left}×.",
    en: "Absences on SIX's timetable so far. {used} of {allowed} used, {left} left.",
  },

  // A course's row
  "presence.courses": { id: "Mata kuliah", en: "Courses" },
  "presence.row.count": { id: "Kehadiran {percent}% sejauh ini ({attended} dari {held})", en: "{percent}% attended so far ({attended} of {held})" },
  "presence.row.final": { id: "Selesai dengan kehadiran {percent}%", en: "Finished at {percent}% attended" },
  "presence.row.ownTarget": { id: "target {value}%", en: "target {value}%" },
  "presence.edunexTally": { id: "Hadir {recorded} dari {closed} di Edunex", en: "Present in {recorded} of {closed} in Edunex" },
  "presence.row.now": { id: "Sedang berlangsung sampai {time}", en: "On now until {time}" },
  "presence.row.nextToday": { id: "Berikutnya hari ini, {time}", en: "Next class today, {time}" },
  "presence.row.nextTomorrow": { id: "Berikutnya besok, {time}", en: "Next class tomorrow, {time}" },
  "presence.row.nextOn": { id: "Berikutnya {day}, {time}", en: "Next class {day}, {time}" },
  "presence.row.window": { id: "Presensi Edunex {when}", en: "Edunex Presence {when}" },
  "presence.row.windowDo": { id: "Presensi Edunex {when}. {action}.", en: "Edunex Presence {when}. {action}." },
  // A window that counts by handing something in: its close is a deadline, not a class's time.
  "presence.row.handIn": { id: "{day}, kumpulkan sebelum {time}", en: "{day}, hand in by {time}" },
  "presence.row.byTime": { id: "{action} sebelum {time}", en: "{action} by {time}" },
  "presence.row.watching": {
    id: "Tandai Hadir belum muncul. Aplikasi memeriksa SIX tiap 2 menit.",
    en: "Tandai Hadir hasn't shown yet. The app checks SIX every 2 minutes.",
  },
  "presence.row.gone": {
    id: "Tandai Hadir sudah tidak tampil di SIX. Sudah kamu tekan, atau sudah ditutup. Aplikasi memeriksa hitungan SIX setelah kuliah.",
    en: "Tandai Hadir is gone from SIX. You pressed it, or it closed. The app checks SIX's count after class.",
  },
  "presence.row.clashEvery": { id: "Bentrok dengan {code} tiap {weekday}, {time}.", en: "Clashes with {code} every {weekday}, {time}." },
  "presence.row.clashOn": { id: "Bentrok dengan {code} {day}, {time}.", en: "Clashes with {code} on {day}, {time}." },
  "presence.row.clashPicked": { id: "Pilih ini kalau hanya bisa hadir di salah satunya.", en: "Go to this one if you can make only one." },
  "presence.row.clashOther": { id: "Kalau hanya bisa hadir di salah satunya, pilih {code}.", en: "If you can make only one, go to {code}." },
  "presence.row.clashAsk": { id: "Tanyakan ke kedua dosen mana yang harus dihadiri.", en: "Ask both lecturers which one to attend." },
  "presence.row.lab": { id: "Praktikum biasanya wajib tiap sesi. Cek aturan praktikumnya.", en: "Labs often need every session. Check the lab's own rules." },
  "presence.record.bothDo": { id: "Tandai Hadir di SIX, lalu {action} sebelum {time}.", en: "Press Tandai Hadir, then {action} by {time}." },
  "presence.record.edunexDo": { id: "Presensi Edunex. {action} sebelum {time}.", en: "Edunex Presence. {action} by {time}." },
  "presence.warn.uncertain": {
    id: "{date} masuk {period}, jadi kuliahnya mungkin tak ada. Kalau tetap ada, hadiri. Tetap dihitung.",
    en: "{date} is in {period}, so the class may not run. If it runs, go. It still counts.",
  },
  "presence.warn.uncertainHoliday": {
    id: "{date} hari libur, jadi kuliahnya mungkin tak ada. Kalau tetap ada, hadiri. Tetap dihitung.",
    en: "{date} is a holiday, so the class may not run. If it runs, go. It still counts.",
  },
  "presence.warn.needed": {
    id: "{date} masuk {period}. {target}% hanya masih bisa kalau kuliah itu tetap ada dan kamu hadir.",
    en: "{date} is in {period}. You reach {target}% only if that class runs and you go.",
  },
  "presence.warn.neededHoliday": {
    id: "{date} hari libur. {target}% hanya masih bisa kalau kuliah itu tetap ada dan kamu hadir.",
    en: "{date} is a holiday. You reach {target}% only if that class runs and you go.",
  },
  "presence.weekNote": {
    id: "Kuliah di {period} ({range}) mungkin tak ada. Kalau tetap ada, hadiri. Tetap dihitung.",
    en: "Classes in {period} ({range}) may not run. If one runs, go. It still counts.",
  },
  "presence.period.uts": { id: "masa UTS", en: "the UTS period" },
  "presence.period.uas": { id: "masa UAS", en: "the UAS period" },
  "presence.period.off": { id: "masa ujian atau libur", en: "an exam week or a holiday" },
  "presence.warn.out": {
    id: "Ada pertemuan yang kamu hadiri tapi tak tercatat? Minta dosen membetulkannya di SIX.",
    en: "Was a class you attended not counted? Ask your lecturer to fix it in SIX.",
  },
  "presence.checkSix": { id: "Buka jadwal di SIX", en: "Open the timetable in SIX" },

  // Under the groups, said once for every course
  "presence.footer": {
    id: "Kehadiran dihitung di SIX. Tekan Tandai Hadir di SIX saat tombolnya muncul. Aplikasi akan memberi tahu.",
    en: "Attendance counts in SIX. Press Tandai Hadir in SIX when it shows. The app tells you when it does.",
  },
  "presence.estimate": {
    id: "Kuliah berakhir {date}. Pertemuan setelah {day} diperkirakan dari jadwal mingguan tiap mata kuliah.",
    en: "Lectures end {date}. Classes after {day} are estimated from each course's weekly slot.",
  },
  "presence.estimateEnd": { id: "Kuliah berakhir {date}.", en: "Lectures end {date}." },
  "presence.estimateNoDate": {
    id: "Jatah absen hanya menghitung pertemuan di jadwal SIX sejauh ini.",
    en: "Absences left only count the classes on SIX's timetable so far.",
  },

  // Two classes at once, today
  "presence.clash.today": { id: "{a} dan {b} bentrok hari ini, {time}", en: "{a} and {b} clash today, {time}" },
  "presence.clash.none": {
    id: "Kalau hanya bisa hadir di salah satunya, pilih {code}. Jatah absennya sudah habis.",
    en: "If you can make only one, go to {code}. It has no absences left.",
  },
  "presence.clash.fewer": {
    id: "Kalau hanya bisa hadir di salah satunya, pilih {code}. Sisanya {count}×, {other} masih {otherCount}×.",
    en: "If you can make only one, go to {code}. It has {count} left, {other} has {otherCount}.",
  },
  "presence.clash.noneOut": {
    id: "Kalau hanya bisa hadir di salah satunya, pilih {code}. Jatah absennya sudah habis, dan {other} sudah tak bisa capai {target}%.",
    en: "If you can make only one, go to {code}. It has no absences left, and {other} can't reach {target}% anymore.",
  },
  "presence.clash.spareOut": {
    id: "Kalau hanya bisa hadir di salah satunya, pilih {code}. Sisanya {count}×, dan {other} sudah tak bisa capai {target}%.",
    en: "If you can make only one, go to {code}. It has {count} left, and {other} can't reach {target}% anymore.",
  },
  "presence.clash.bothNone": {
    id: "Jatah absen keduanya habis. Bicarakan dengan dosennya sebelum kuliah.",
    en: "Neither has absences left. Talk to the lecturers before class.",
  },
  "presence.clash.even": { id: "Keduanya sisa {count}×.", en: "Both have {count} left." },

  // What SIX's count did after today's class
  "presence.six.absent": { id: "SIX mencatatmu tidak hadir di {code} hari ini", en: "SIX marked you absent in {code} today" },
  "presence.six.missing": { id: "SIX belum menghitung kuliah {code} hari ini", en: "SIX hasn't counted today's {code} class" },
  "presence.six.absentOn": { id: "SIX mencatatmu tidak hadir di {code} {day}", en: "SIX marked you absent in {code} on {day}" },
  "presence.six.missingOn": { id: "SIX belum menghitung kuliah {code} {day}", en: "SIX hasn't counted the {code} class on {day}" },
  "presence.six.absentOut": {
    id: "Kalau kamu tadi hadir, minta dosen membetulkannya hari ini. Sampai dibetulkan, {code} tak bisa capai {target}%.",
    en: "If you were in class, ask your lecturer to fix it today. Until then, {code} can't reach {target}%.",
  },
  "presence.six.counted": { id: "{codes} sudah dihitung di SIX hari ini.", en: "{codes} counted in SIX today." },
  "presence.six.countedLate": { id: "{code} akhirnya dihitung di SIX.", en: "{code} counted in SIX after all." },

  // SIX's "Tandai Hadir" open now in a class
  "presence.checkIn.title": { id: "Tandai Hadir yang dibuka sekarang", en: "Tandai Hadir open now" },
  "presence.checkIn.class": { id: "{code} · belum kamu tekan · kuliah sampai {time}", en: "{code} · not pressed yet · class until {time}" },

  // An Edunex Presence window open now that counts
  "presence.open.title": { id: "Presensi yang dibuka sekarang", en: "Presence open now" },
  "presence.now": { id: "Perlu perhatianmu sekarang", en: "Needs you now" },
  "presence.open.do": { id: "{action} sebelum {time}", en: "{action} before {time}" },
  "presence.open.counts": { id: "{code} · dicatat lewat Presensi Edunex", en: "{code} · recorded through Edunex Presence" },
  "presence.open.notKnown": {
    id: "{code} · belum tahu dihitung di mana. Mengisinya tidak ada ruginya.",
    en: "{code} · not known yet where it counts. Filling it in costs nothing.",
  },
  "presence.open.noSix": {
    id: "{code} · tanpa SIX, belum pasti ini dihitung. Catat saja untuk berjaga-jaga.",
    en: "{code} · without SIX it's not certain this counts. Record it just in case.",
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
    id: "Jumlahnya diambil dari SIX (“Hadir X dari Y pertemuan”), catatan resminya. SIX hanya memberi totalnya, bukan pertemuan mana yang kamu lewatkan.",
    en: "The counts come from SIX (“Hadir X dari Y pertemuan”), the official record. SIX gives totals only, not which classes you missed.",
  },
  "presence.how.left": {
    id: "Jatah absen menghitung pertemuan yang masih akan ada sampai hari kuliah terakhir ({date}), dari jadwal SIX lalu jadwal mingguan tiap mata kuliah.",
    en: "Absences left counts the classes still to come until the last lecture day ({date}), from SIX's timetable and then each course's weekly slot.",
  },
  "presence.how.uncertain": {
    id: "Kuliah yang dijadwalkan SIX di minggu UTS, UAS atau hari libur mungkin tak ada. Itu tak dihitung dalam jatah absenmu. Kalau tetap ada, hadiri. Tetap dihitung.",
    en: "A class SIX lists in a UTS or UAS week or on a holiday may not run. It isn't counted in your absences left. If it runs, go. It still counts.",
  },
  "presence.how.edunex": {
    id: "Di mata kuliah yang dicatat SIX, Presensi Edunex yang tak kamu isi bukan absen.",
    en: "Where SIX keeps the count, an Edunex Presence you didn't fill in isn't an absence.",
  },
  "presence.how.target": {
    id: "Tak ada batas minimal untuk seluruh ITB. Samakan target tiap mata kuliah dengan batas di kontrak kuliahnya.",
    en: "ITB has no institute-wide minimum. Set each course's target to the minimum in its course contract.",
  },
  "presence.how.check": {
    id: "Setelah tiap kuliah, aplikasi memeriksa hitungan SIX bertambah, dan memberi tahu hari itu juga jika tidak.",
    en: "After each class the app checks that SIX's count went up, and tells you the same day if it didn't.",
  },
  "presence.openSix": { id: "Buka jadwal di SIX", en: "Open the timetable in SIX" },
  "presence.empty": { id: "Belum ada mata kuliah semester ini", en: "No courses this term yet" },
  "presence.emptyHint": {
    id: "Mata kuliahmu muncul di sini setelah SIX mencantumkan kelasmu semester ini.",
    en: "They show here once SIX lists your classes for the term.",
  },
  "presence.noSix.hint": {
    id: "Masuk ke SIX untuk melihat kehadiran resmimu dan berapa kali lagi kamu bisa absen di tiap mata kuliah.",
    en: "Sign in to SIX to see your official attendance and how many more classes you can miss in each course.",
  },
  "presence.signInSix": { id: "Masuk ke SIX", en: "Sign in to SIX" },

  // Settings
  "settings.attendance.target": { id: "Target kehadiran", en: "Attendance target" },
  "settings.attendance.targetHint": {
    id: "Untuk semua mata kuliah. Target satu mata kuliah diatur lewat Target di Presensi.",
    en: "For every course. Set one course's own target with Targets on Presence.",
  },
  "settings.attendance.targetHintOwn": { id: "Untuk mata kuliah tanpa target sendiri", en: "For courses without their own target" },
  "settings.attendance.own": { id: "{code} · target sendiri", en: "{code} · its own target" },
  "settings.attendance.useDefault": { id: "Pakai target umum", en: "Use the default" },
  "settings.attendance.useDefaultFor": { id: "Pakai target umum untuk {code}", en: "Use the default for {code}" },
  "settings.alerts.presence": { id: "Presensi", en: "Presence" },
  "settings.alerts.presenceHint": {
    id: "Saat Tandai Hadir muncul di SIX atau Presensi Edunex dibuka, dan 15 menit sebelum tutup jika belum tercatat",
    en: "When Tandai Hadir shows in SIX or an Edunex Presence opens, and 15 minutes before it closes if you're not recorded",
  },
  "settings.alerts.needsSix": { id: "butuh SIX", en: "needs SIX" },
  "settings.alerts.attendanceRisk": { id: "Kehadiran", en: "Attendance" },
  "settings.alerts.attendanceRiskHint": {
    id: "SIX tidak mencatat kuliah, jatah absen habis",
    en: "SIX didn't count a class, no absences left",
  },
} as const satisfies Record<string, Entry>;
