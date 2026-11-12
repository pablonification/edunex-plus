// Text only the Android app shows: its tabs, its notification channels, and what a phone does
// that the desktop doesn't (signing in on a page inside the app, the phone's calendar, files
// opened in other apps). Everything else on the phone uses the desktop's own keys, and
// phoneWording, at the end, says the few of them that speak of a computer the phone's way.
import type { StringKey } from "../strings";
import type { Entry } from "./entry";

export const mobileStrings = {
  // Bottom tabs: short, the screen's own title says the rest ("Tugas & Ujian").
  "mobile.tab.tasks": { id: "Tugas", en: "Tasks" },
  "mobile.tab.more": { id: "Lainnya", en: "More" },
  // Kuliah: the term's courses with each one's absences left (Presensi's page). Akademik: IPK, Nilai, the study plan, KRS, UKT.
  "mobile.tab.courses": { id: "Kuliah", en: "Courses" },
  "mobile.tab.academic": { id: "Akademik", en: "Academic" },
  // The last tab: the Student, their IPK and SKS, everything Akademik held, and the way to Settings and the account.
  "mobile.tab.profile": { id: "Profil", en: "Profile" },
  // Beranda's strip: counts to tap. A count of none is a check and two words, never "0".
  "mobile.strip.tasksNone": { id: "Tugas beres", en: "Tasks done" },
  "mobile.strip.absencesNone": { id: "Absen aman", en: "Absences fine" },
  "mobile.strip.classes": { id: "Kuliah lagi", en: "Classes left" },
  // superapp: Beranda
  // The strip's three tiles: Tasks due within 7 days (late ones too), courses with no absence left, days to the next exam.
  "mobile.strip.due": { id: "Tugas minggu ini", en: "Tasks this week" },
  "mobile.strip.dueNone": { id: "Tak ada tenggat", en: "Nothing due" },
  "mobile.strip.limit": { id: "Jatah absen habis", en: "No absences left" },
  "mobile.strip.limitSpoken": {
    id: "{count} mata kuliah, jatah absen habis",
    en: { one: "{count} course with no absences left", other: "{count} courses with no absences left" },
  },
  "mobile.strip.examIn": { id: "hari ke {kind}", en: { one: "day to {kind}", other: "days to {kind}" } },
  "mobile.strip.examToday": { id: "{kind} hari ini", en: "{kind} today" },
  // Round 2: the soonest thing due ("2 hari ini", else its date over the Task's name), the absence status Kuliah
  // names, the exam's own day; and a tile's plain name while its source is still being read.
  "mobile.strip.today": { id: "hari ini", en: "due today" },
  "mobile.strip.todaySpoken": {
    id: "{count} Tugas tenggat hari ini",
    en: { one: "{count} Task due today", other: "{count} Tasks due today" },
  },
  "mobile.strip.lateSpoken": { id: "{count} Tugas terlambat", en: { one: "{count} late Task", other: "{count} late Tasks" } },
  "mobile.strip.undated": { id: "tanpa tenggat", en: "no due date" },
  "mobile.strip.undatedSpoken": {
    id: "{count} Tugas tanpa tenggat",
    en: { one: "{count} Task with no due date", other: "{count} Tasks with no due date" },
  },
  "mobile.strip.nextSpoken": { id: "Tugas berikutnya, {date}: {title}", en: "Next Task, {date}: {title}" },
  "mobile.strip.overSpoken": {
    id: "{count} mata kuliah lewat batas absen",
    en: { one: "{count} course over its absence limit", other: "{count} courses over their absence limit" },
  },
  "mobile.strip.examSpoken": { id: "{away} lagi ke {kind}", en: "{away} to {kind}" },
  "mobile.strip.wait.tasks": { id: "Tugas", en: "Tasks" },
  "mobile.strip.wait.absences": { id: "Absen", en: "Absences" },
  "mobile.strip.wait.exam": { id: "Ujian", en: "Exams" },
  // superapp: Beranda, round 3. The strip's three as one family: a figure over two words with the noun. The absence
  // tile counts every course with no absence left (at the limit or past it). The search bar's hint, kept short.
  // Round 4: the date's tile carries the Task's own name and hour.
  "mobile.strip.lateTasks": { id: "tugas terlambat", en: { one: "late Task", other: "late Tasks" } },
  "mobile.strip.out": { id: "absen habis", en: "absences out" },
  "mobile.strip.outSpoken": {
    id: "{count} mata kuliah tanpa sisa absen",
    en: { one: "{count} course with no absences left", other: "{count} courses with no absences left" },
  },
  "mobile.strip.examTo": { id: "ke {kind}", en: "to {kind}" },
  // The app's own name, for a screen reader on its mark (Beranda's header): a name, the same in both languages.
  "mobile.appName": { id: "Edunex Plus", en: "Edunex Plus" },
  // Beside the mark and the bell the bar is short: the magnifier says "search", the words say what it finds.
  "mobile.home.searchHint": { id: "Kuliah, tugas, materi", en: "Courses, Tasks, materials" },
  // The block's one time while a class is on with no Presence open, and its calm line once nothing is left.
  "mobile.home.ends": { id: "selesai {time}", en: "ends {time}" },
  "mobile.home.noneLeft": { id: "Kuliah hari ini selesai", en: "No more classes today" },
  // Beranda's services, round and four across, and Semua layanan behind "Lainnya": every service in named groups.
  "mobile.home.services": { id: "Layanan", en: "Services" },
  "mobile.services.title": { id: "Semua layanan", en: "All services" },
  "mobile.services.search": { id: "Cari layanan", en: "Search services" },
  "mobile.services.none": { id: "Tak ada layanan bernama “{query}”", en: "No service named “{query}”" },
  "mobile.services.group.daily": { id: "Harian", en: "Daily" },
  "mobile.services.group.academic": { id: "Akademik", en: "Academic" },
  "mobile.services.group.app": { id: "Aplikasi", en: "App" },
  "mobile.service.calendar": { id: "Kalender", en: "Calendar" },
  "mobile.service.material": { id: "Materi", en: "Materials" },
  "mobile.service.exams": { id: "Ujian", en: "Exams" },
  "mobile.service.month": { id: "Jadwal bulanan", en: "Monthly schedule" },
  "mobile.service.needs": { id: "Perlu kamu urus", en: "To handle" },
  "mobile.service.report": { id: "Lapor", en: "Report" },
  "mobile.service.scan": { id: "Ringkasan", en: "Summary" },
  // Profil: the counts under the Student's name, and the two groups of rows.
  "mobile.profile.studies": { id: "Studi", en: "Studies" },
  "mobile.profile.app": { id: "Aplikasi", en: "App" },
  "mobile.profile.semester": { id: "Semester", en: "Semester" },
  "mobile.profile.report": { id: "Laporkan masalah", en: "Report a problem" },
  // superapp: Profil
  // The card: a first-term Student with no grades yet, and what it says when SIX can't be read.
  "mobile.profile.noGrades": { id: "Belum ada nilai", en: "No grades yet" },
  "mobile.profile.connectSix": { id: "IPK, KRS dan UKT muncul setelah kamu masuk ke SIX.", en: "Your IPK, KRS and UKT show once you sign in to SIX." },
  "mobile.profile.sixUnread": {
    id: "SIX belum terbaca. IPK, KRS dan UKT muncul setelah terbaca.",
    en: "SIX hasn't been read yet. Your IPK, KRS and UKT show once it is.",
  },
  // Kurikulum's row: the required courses still to pass.
  "mobile.profile.requiredLeft": {
    id: "{count} mata kuliah wajib lagi",
    en: { one: "{count} required course left", other: "{count} required courses left" },
  },
  "mobile.profile.requiredDone": { id: "Wajib tuntas", en: "Required courses done" },
  // Notifikasi's row.
  "mobile.profile.unread": { id: "{count} belum dibaca", en: "{count} unread" },
  // Profil: the heading over Nilai, Rencana, Kurikulum, KRS, UKT and Kalender akademik: the Student's own record.
  "mobile.profile.record": { id: "Akademikmu", en: "Your academics" },
  // Settings › Notifikasi while the phone has notifications off for the app: where they're off (the heading over it
  // says what), and the one button.
  "mobile.settings.alertsOff": { id: "Mati di pengaturan HP", en: "Off in your phone's settings" },
  "mobile.settings.alertsTurnOn": { id: "Nyalakan", en: "Turn on" },
  // Settings › Tentang: the row that opens what the app found the first time it read Edunex and SIX ("Ringkasan awal"
  // was a name no judge understood).
  "mobile.settings.firstFound": { id: "Temuan saat pertama masuk", en: "Found at first sign-in" },
  // The phone's guide (mobile/src/shell/guide): the invitation, then one line for each part it points at. The
  // rest of its words are the desktop guide's (./guide.ts).
  "mobile.guide.intro.body": {
    id: "Lihat yang tidak ada di Edunex dan SIX, kurang dari semenit. Bisa dilewati kapan saja.",
    en: "See what Edunex and SIX don't have, in under a minute. Skip it any time.",
  },
  "mobile.guide.now.body": {
    id: "Kuliah yang sedang berjalan atau berikutnya, dengan ruangnya. Saat presensinya dibuka, tombol Isi Presensi muncul di sini.",
    en: "The class on now or next, with its room. When its Presence opens, Fill in Presence shows here.",
  },
  "mobile.guide.strip.title": { id: "Tugas, absen, ujian", en: "Tasks, absences, exams" },
  "mobile.guide.strip.body": {
    id: "Tugas yang menunggu, mata kuliah yang jatah absennya habis, dan ujian berikutnya. Ketuk salah satu untuk rinciannya.",
    en: "Tasks waiting, courses out of absences and your next exam. Tap one for the detail.",
  },
  "mobile.guide.services.title": { id: "Layanan SIX dan Edunex", en: "SIX and Edunex services" },
  "mobile.guide.services.body": {
    id: "KRS, nilai, UKT, dan lainnya terbuka di aplikasi ini. Sisanya ada di Lainnya.",
    en: "KRS, grades, UKT and more open in this app. The rest are under More.",
  },
  "mobile.guide.schedule.body": {
    id: "Kuliah dari SIX dan pertemuan dari Edunex dalam satu jadwal, dengan ruangnya. Bisa ditambahkan ke kalender HP-mu.",
    en: "Classes from SIX and meetings from Edunex in one schedule, with their rooms. You can add it to your phone's calendar.",
  },
  "mobile.guide.tasks.body": {
    id: "Tugas semua mata kuliah dalam satu daftar. Buka satu untuk menulis jawaban, melampirkan berkas, lalu mengumpulkan dari HP.",
    en: "Tasks from every course in one list. Open one to write your answer, attach files and submit from your phone.",
  },
  "mobile.guide.courses.body": {
    id: "Tiap mata kuliah dengan sisa jatah absennya, dihitung dari kehadiranmu di SIX. Yang paling berisiko ada di atas.",
    en: "Each course with the absences it has left, counted from your SIX attendance. The ones most at risk come first.",
  },
  "mobile.guide.profile.title": { id: "Nilai dan rencana studi", en: "Grades and study plan" },
  "mobile.guide.profile.body": {
    id: "Nilai, rencana studi, KRS, dan UKT-mu. Ikon mata di kartu IPK menyembunyikan nilai saat layarmu terlihat orang lain.",
    en: "Your grades, study plan, KRS and UKT. The eye on the IPK card hides your grades when others can see your screen.",
  },
  "mobile.guide.offer": { id: "Tawaran panduan", en: "Tour invitation" },
  // Nilai: the heading over this term's courses whose grade isn't out, saying once that the letters are the Student's
  // own estimates. The second is used under "Semester ini", when some grades are already out.
  "mobile.grades.estimates": { id: "Perkiraanmu semester ini", en: "Your estimates this semester" },
  "mobile.grades.estimatesRest": { id: "Perkiraanmu untuk yang belum keluar", en: "Your estimates for the rest" },
  // Nilai, under the IPK target: what it takes from this semester as a figure at the line's end ("Butuh rata-rata di 11 SKS ·
  // 3,66 · AB"), or the highest IPK still possible when even straight A's fall short ("Tertinggi semester ini · 3,33":
  // this semester's courses alone, so it's named apart from "IPK tertinggi yang mungkin", which counts the plan's too).
  "mobile.grades.needAverage": { id: "Butuh rata-rata di {sks} SKS", en: "Average needed over {sks} SKS" },
  "mobile.grades.termBest": { id: "Tertinggi semester ini", en: "Highest this semester" },
  // The top bar of every tab: the avatar opens the account and Settings, ⋮ the screen's rarer actions.
  "mobile.account.open": { id: "Akun dan pengaturan", en: "Account and settings" },
  "mobile.menu.more": { id: "Opsi lainnya", en: "More options" },
  // search: the field's hint, short enough for a phone's field (the desktop's names modules too and ran past its end).
  // Settings › Tentang, Android's update from inside the app: downloaded, Android's installer waiting for the Student.
  "mobile.update.ready": { id: "Edunex Plus {version} siap dipasang.", en: "Edunex Plus {version} is ready to install." },
  "mobile.update.install": { id: "Pasang", en: "Install" },
  "mobile.search.placeholder": { id: "Cari mata kuliah, tugas, materi", en: "Search courses, Tasks, materials" },
  // superapp: search and notifications
  // Search: the services found by name, and what's offered under a search that found nothing.
  "mobile.search.group.services": { id: "Layanan", en: "Services" },
  "mobile.search.close": { id: "Mungkin yang kamu cari ada di sini:", en: "Maybe what you need is here:" },
  // superapp: search, round 2. Before anything is typed: the next three Tasks due, by that name (the Tugas tab has all).
  "mobile.search.group.nextDue": { id: "Tenggat terdekat", en: "Due next" },
  // Akademik: the screens behind it, as a list.
  "mobile.academic.screens": { id: "Studimu", en: "Your studies" },
  // Android's notification channels, as Settings › Notifications lists them.
  "mobile.channel.presence": { id: "Presensi dibuka dan ditutup", en: "Presence opening and closing" },
  "mobile.channel.alerts": { id: "Tugas, tenggat dan perubahan", en: "Tasks, deadlines and changes" },
  // The button Android shows on a notification about a class to mark present in: SIX's own name for it.
  "mobile.notification.checkIn": { id: "Tandai Hadir", en: "Tandai Hadir" },
  // Hiding grades (src/core/hide-grades.ts): one name on the eye button, Settings' switch and the quiet line.
  "mobile.hideGrades": { id: "Sembunyikan nilai", en: "Hide grades" },
  "mobile.hideGrades.hint": { id: "IPK, IP, dan nilai tiap mata kuliah", en: "IPK, IP and every course's grade" },
  "mobile.hideGrades.show": { id: "Tampilkan nilai", en: "Show grades" },
  "mobile.hideGrades.hidden": { id: "Nilai disembunyikan", en: "Grades hidden" },
  // What a screen reader hears in a hidden figure's place ("IPK disembunyikan"), never the number.
  "mobile.hideGrades.said": { id: "{name} disembunyikan", en: "{name} hidden" },
  // A new grade's notification while grades are hidden: the course, never the grade or the IPK.
  "mobile.alert.grade.new": { id: "Nilai baru · {course}", en: "New grade · {course}" },
  "mobile.alert.grade.changed": { id: "Nilai berubah · {course}", en: "Grade changed · {course}" },

  // alerts
  // At the start of a class SIX counts: with the app closed nothing reads SIX for the button, so the Student hears the class began.
  "mobile.alert.classStarted": { id: "Kuliah sudah mulai · {course}", en: "Class has started · {course}" },
  "mobile.alert.classStarted.body": {
    id: "Tekan Tandai Hadir di SIX saat tombolnya muncul · kuliah sampai {time}",
    en: "Press Tandai Hadir in SIX when it shows · class until {time}",
  },
  // superapp: first minute (mobile/src/shell/first-minute). The one button under the desktop's headline; once tapped it
  // becomes the sign-in's status, in the desktop's words (welcome.waitingShort, signIn.finishing, welcome.bringingAlong,
  // welcome.sixLater). When the first read is in, the snackbar says the desktop's "Semua siap." once
  // (welcome.readyTitlePlain), with the one action that opens the summary (mobile.home.scanOpen).
  "mobile.welcome.signIn": { id: "Masuk dengan akun ITB", en: "Sign in with your ITB account" },
  // The headline turns into this as the first door lights with the name: the greeting, said once (Beranda has none).
  "mobile.welcome.hello.morning": { id: "Pagi, {name}.", en: "Morning, {name}." },
  "mobile.welcome.hello.midday": { id: "Siang, {name}.", en: "Afternoon, {name}." },
  "mobile.welcome.hello.afternoon": { id: "Sore, {name}.", en: "Afternoon, {name}." },
  "mobile.welcome.hello.evening": { id: "Malam, {name}.", en: "Evening, {name}." },
  // The sign-in stopped because nothing could be reached: said under the button, which tries again.
  "mobile.welcome.offline": { id: "Tidak bisa terhubung. Cek internetmu, lalu coba lagi.", en: "Couldn't connect. Check your internet, then try again." },
  // home
  // The now card is one target: a tap opens its class's sheet. Said to TalkBack after the card's own words.
  "mobile.home.nowHint": { id: "Buka rincian kuliah", en: "Opens the class details" },
  // Chips on the now card: what's unusual about the class, the details in its sheet.
  "mobile.home.timeMoved": { id: "Jam berubah", en: "New time" },
  "mobile.home.roomMoved": { id: "Ruang berubah", en: "New room" },
  // The class sheet's way to an exam sitting's page.
  "mobile.home.openExam": { id: "Buka ujian", en: "Open exam" },
  // Beranda, round 2's v4: the greeting is the screen's one title, short like the reference apps'.
  "mobile.home.hello.morning": { id: "Pagi, {name}", en: "Morning, {name}" },
  "mobile.home.hello.midday": { id: "Siang, {name}", en: "Afternoon, {name}" },
  "mobile.home.hello.afternoon": { id: "Sore, {name}", en: "Afternoon, {name}" },
  "mobile.home.hello.evening": { id: "Malam, {name}", en: "Evening, {name}" },
  // The now card's line above the course: "Sekarang · R.SG PWK LT.6", "Berikutnya · TVST C".
  "mobile.home.next": { id: "Berikutnya", en: "Next" },
  // Big numbers with their unit: "53 mnt lagi", "7 hari", "2 hari lewat".
  "mobile.home.unit.minute": { id: "mnt", en: "min" },
  "mobile.home.unit.hour": { id: "jam", en: { one: "hr", other: "hrs" } },
  "mobile.home.unit.day": { id: "hari", en: { one: "day", other: "days" } },
  "mobile.home.left": { id: "lagi", en: "left" },
  "mobile.home.late": { id: "lewat", en: "late" },
  // After the Student went to SIX's Tandai Hadir from the card and SIX no longer shows it: their step, not a claim.
  "mobile.home.wentToSix": { id: "Sudah ke SIX · {time}", en: "Went to SIX · {time}" },
  // Beranda's two sections, and the screen behind the first.
  "mobile.home.toHandle": { id: "Perlu kamu urus", en: "To handle" },
  "mobile.home.laterToday": { id: "Nanti hari ini", en: "Later today" },
  // Nothing in "Perlu kamu urus": one line, still the way to its screen.
  "mobile.home.toHandleNone": { id: "Tak ada yang perlu diurus", en: "Nothing to handle" },
  // A card's kind where a word says it: "Pertemuan · Jum 13:00" on Perlu kamu urus, a Presence's pill on Jadwal's month.
  "mobile.home.kind.presence": { id: "Presensi", en: "Presence" },
  "mobile.home.kind.meeting": { id: "Pertemuan", en: "Meeting" },
  // Perlu kamu urus: a card whose action counts for attendance shows Edunex's hand, and TalkBack says it.
  "mobile.home.countsPresence": { id: "Dihitung untuk Presensi", en: "Counts for Presence" },
  // A course's absences, one name for each state wherever the phone says it (Beranda, Perlu kamu urus, Kuliah, an exam),
  // in absence words so "lewat" can't read as a Task past its deadline (round 3's fourth review: Beranda and Kuliah had
  // two phrasings): none left, or over the limit by how many. Both name the Glossary's "Jatah absen", never a bare
  // "Absen" (the final review: it read as "you were absent"). Over the limit is the
  // desktop's "Tak bisa lagi capai 80%": Kuliah's big number and the course's sheet say that, with the target, and it's
  // what TalkBack hears. Never "Di bawah target": a course with none left can be under its target today too.
  "mobile.absence.none": { id: "Jatah absen habis", en: "No absences left" },
  "mobile.absence.over": { id: "Lewat jatah absen {count}×", en: { one: "{count} absence too many", other: "{count} absences too many" } },
  // "Perlu kamu urus"'s chevron when Beranda holds back rows: how many more the whole list has ("+2 lagi").
  "mobile.home.moreRows": { id: "+{count} lagi", en: "+{count} more" },
  // Beranda's clash row: when, as the title, so neither course's name is cut ("Kelas bentrok · Kam 16:00"); the two
  // short names on the line under it ("Pemrograman dan Teknik").
  "mobile.home.clash": { id: "Kelas bentrok · {when}", en: "Classes clash · {when}" },
  "mobile.home.clashPair": { id: "{a} dan {b}", en: "{a} and {b}" },
  // The now card's day for a class two days ahead, said once ("Lusa 08:00").
  "mobile.home.dayAfter": { id: "Lusa", en: "{weekday}" },
  // A class row's one chip.
  "mobile.home.chip.clash": { id: "Bentrok", en: "Clash" },
  // "Perlu kamu urus"'s row for a course that can't reach its target any more: the best it can still reach, short enough
  // for one line beside its "Lewat jatah absen" words (the target itself is on the course's page).
  "mobile.needs.best": { id: "Maks {best}%", en: "At most {best}%" },
  // Yang berubah and Notifikasi: a moved class's or an Edunex-only meeting's one meta line, the day and its time or room,
  // short enough for one line beside the row's time (the title says what changed). The desktop's whole line, with the
  // usual time or room and "tidak ada di jadwal SIX", is what TalkBack reads; Jadwal and the class sheet show them too.
  "mobile.change.moved.time": { id: "{dateId}, {time}", en: "{dateEn}, {time}" },
  "mobile.change.moved.room": { id: "{dateId} di {room}", en: "{dateEn} in {room}" },
  "mobile.change.meeting.body": { id: "{dateId}, {time}", en: "{dateEn}, {time}" },
  // Notifikasi: a meeting's row when its Teams link or its material came with it (mobile/src/screens/alerts/same-meeting.ts),
  // what came first, then the meeting's day and time.
  "mobile.change.meeting.withLink": { id: "Link baru · {when}", en: "New link · {when}" },
  "mobile.change.meeting.withMaterial": { id: "Materi baru · {when}", en: "New material · {when}" },
  // Notifikasi's and Yang berubah's meta line for a moved class: what moved, old → new, only the day, time or room that
  // changed ("08:00–09:30 → 08:00–10:00"). The whole of both is in what TalkBack reads.
  "mobile.change.moved.diff": { id: "{oldId} → {newId}", en: "{oldEn} → {newEn}" },
  // Notifikasi and Yang berubah: a moved class's day, before what moved when the day itself didn't ("Kam, 19 Nov · 08:00–09:30
  // → 08:00–10:00").
  "mobile.change.moved.onDay": { id: "{dayId} · {oldId} → {newId}", en: "{dayEn} · {oldEn} → {newEn}" },
  // Notifikasi, once a class or a Presence window is over: what happened, never the action any more ("Tandai Hadir · sampai
  // 17:50" five days later read as still to do). The outcome is SIX's count after the class, or what Edunex recorded.
  "mobile.alert.classOver": { id: "Kuliah selesai · {course}", en: "Class over · {course}" },
  "mobile.alert.presenceOver": { id: "Presensi ditutup · {course}", en: "Presence closed · {course}" },
  "mobile.alert.present": { id: "Hadir", en: "Present" },
  "mobile.alert.notRecorded": { id: "Tidak tercatat", en: "Not recorded" },
  // Notifikasi, once a Task's deadline has passed: its "Tenggat 1 jam lagi" (and the earlier reminders) say what happened,
  // "Terkumpul" (taskStatus.submitted) or this, never the countdown any more.
  "mobile.alert.deadlineOver": { id: "Tenggat lewat · {task}", en: "Deadline passed · {task}" },
  "mobile.alert.notHandedIn": { id: "Belum dikumpulkan", en: "Not submitted" },
  // Notifikasi's meta line for Tandai Hadir: the action and how long the class runs, never how to press it.
  "mobile.change.classStarted": { id: "Tandai Hadir · sampai {time}", en: "Tandai Hadir · until {time}" },
  "mobile.change.checkIn": { id: "Kuliah sampai {time}", en: "Class until {time}" },
  // The class sheet's one status (a chip), and its one quiet line: what it clashes with, or where it usually is.
  "mobile.home.chip.now": { id: "Sekarang", en: "Now" },
  "mobile.home.chip.moved": { id: "Berubah", en: "Changed" },
  "mobile.home.clashWith": { id: "Dengan {course} {time}", en: "With {course} {time}" },
  "mobile.home.usually": { id: "Biasanya {usual}", en: "Usually {usual}" },
  "mobile.home.online": { id: "daring", en: "online" },
  // The class sheet's facts as labels, never the how: the share against the target, Tandai Hadir's state, the Presence.
  "mobile.home.share": { id: "Kehadiran {percent}% · target {target}%", en: "Attendance {percent}% · target {target}%" },
  // The now card with no class in the week ahead.
  "mobile.home.free": { id: "Tak ada kelas 7 hari ke depan", en: "No classes in the next 7 days" },
  // The first read's card on Beranda: the summary the welcome used to show.
  "mobile.home.scanOpen": { id: "Lihat ringkasan", en: "See summary" },
  // Notifications, asked on Beranda the first time there's a class.
  "mobile.home.notifyTitle": { id: "Ingatkan sebelum kuliah?", en: "Remind you before class?" },
  "mobile.home.notifyOn": { id: "Nyalakan", en: "Turn on" },
  "mobile.home.notifyLater": { id: "Nanti", en: "Not now" },
  // The top bar's status line while the first read runs: which system and which part.
  "mobile.home.reading": { id: "Membaca {part}…", en: "Reading {part}…" },
  // tasks
  // A file from Edunex opens in the phone's own apps (A12, A13), or goes elsewhere through the share sheet.
  // Edunex's and SIX's own pages inside the app (W14): the demo's pages are pretend, so it says what the real app shows.
  "mobile.page.demo": {
    id: "Di aplikasi asli, halaman {site} terbuka di sini, sudah masuk dengan akunmu.",
    en: "In the real app, {site}'s page opens here, already signed in with your account.",
  },
  "mobile.file.openFor": { id: "Buka {name}", en: "Open {name}" },
  "mobile.file.share": { id: "Bagikan", en: "Share" },
  "mobile.file.shareFor": { id: "Bagikan {name}", en: "Share {name}" },
  "mobile.file.noApp": {
    id: "Belum ada aplikasi di HP ini yang bisa membuka {name}. Bagikan ke aplikasi lain.",
    en: "No app on this phone opens {name}. Share it to another app.",
  },
  // The phone's app for it didn't open it: the copy is still here, so Share is the other way.
  "mobile.file.openFailed": {
    id: "{name} tidak bisa dibuka. Coba lagi, atau bagikan ke aplikasi lain.",
    en: "Couldn't open {name}. Try again, or share it to another app.",
  },
  // The copy went (signing out of Edunex takes it): a tap on the file downloads it again.
  "mobile.file.shareFailed": {
    id: "{name} tidak bisa dibagikan. Ketuk berkasnya untuk mengunduh ulang, lalu bagikan lagi.",
    en: "Couldn't share {name}. Tap the file to download it again, then share it.",
  },
  // The answer box on the phone is plain text: an answer with bold, lists or links is changed on Edunex.
  "mobile.handIn.textPlain": {
    id: "Kotak jawaban di HP hanya untuk teks biasa, jadi ubah jawaban berformat ini di Edunex. Berkasnya tetap bisa diatur di sini.",
    en: "The answer box on the phone takes plain text only, so change this formatted answer on Edunex. You can still manage the files here.",
  },
  // settings
  "mobile.settings.notificationsOff": {
    id: "Notifikasi untuk Edunex Plus mati. Nyalakan di pengaturan HP.",
    en: "Notifications for Edunex Plus are off. Turn them on in your phone's settings.",
  },
  // At the top of Notifikasi while Android's permission is off; the button asks for it, or opens the app's notification settings.
  "mobile.settings.notificationsOffTitle": { id: "Mati di HP ini", en: "Off on this phone" },
  "mobile.settings.notificationsTurnOn": { id: "Nyalakan notifikasi", en: "Turn on notifications" },
  // Settings › Akun: the line under "Ringkasan awal", saying what it is.
  "mobile.settings.firstScanMeta": { id: "Yang ditemukan saat pertama terhubung", en: "What turned up when you first connected" },
  // course
  // "Simpan untuk offline" on the phone: the course's files go into the app, a few at a time. It keeps going off the page.
  "mobile.offline.saving": {
    id: "Menyimpan {done} dari {total} berkas",
    en: { one: "Saving {done} of {total} file", other: "Saving {done} of {total} files" },
  },
  // schedule
  // Between Jadwal's arrows, the week or month on screen, said from today; "Hari ini" beside the view is the way back.
  "mobile.schedule.lastWeek": { id: "Minggu lalu", en: "Last week" },
  "mobile.schedule.nextWeek": { id: "Minggu depan", en: "Next week" },
  "mobile.schedule.weeksAgo": { id: "{count} minggu lalu", en: { one: "{count} week ago", other: "{count} weeks ago" } },
  "mobile.schedule.weeksAhead": { id: "{count} minggu lagi", en: { one: "In {count} week", other: "In {count} weeks" } },
  "mobile.schedule.lastMonth": { id: "Bulan lalu", en: "Last month" },
  "mobile.schedule.nextMonth": { id: "Bulan depan", en: "Next month" },
  "mobile.schedule.monthsAgo": { id: "{count} bulan lalu", en: { one: "{count} month ago", other: "{count} months ago" } },
  "mobile.schedule.monthsAhead": { id: "{count} bulan lagi", en: { one: "In {count} month", other: "In {count} months" } },
  "mobile.schedule.today": { id: "Hari ini", en: "Today" },
  // Jadwal without SIX, one row above the day beside Masuk ke SIX.
  "mobile.schedule.needsSix": { id: "Kuliah & ruang ada di SIX", en: "Classes and rooms are in SIX" },
  "mobile.schedule.todayLabel": { id: "Kembali ke hari ini", en: "Back to today" },
  // Under the month in Jadwal's bar: the term's week alone (the week strip under the bar shows its days).
  "mobile.schedule.week": { id: "Minggu ke-{n}", en: "Week {n}" },
  // Jadwal's day (v4): a day with no class, a hand-in's time ("II4091 · sebelum 23:59"), and where a class the app
  // couldn't read is.
  "mobile.schedule.noClasses": { id: "Tidak ada kuliah", en: "No classes" },
  "mobile.schedule.before": { id: "sebelum {time}", en: "by {time}" },
  "mobile.schedule.unreadMeta": { id: "Jam dan ruangnya ada di SIX", en: "Its time and room are on SIX" },
  // A day with no class: the next class's card under "Berikutnya", as TalkBack names it (a tap goes to its day).
  "mobile.schedule.nextLabel": { id: "Ke kuliah berikutnya, {when}", en: "Go to the next class, {when}" },
  // A day on the week strip with two classes at once, as TalkBack says it after the date (on screen: the clash icon).
  "mobile.schedule.clashDay": { id: "ada kuliah bentrok", en: "classes clash" },
  // Jadwal's ⋮, named for what it holds.
  "mobile.schedule.menu": { id: "Opsi jadwal", en: "Schedule options" },
  // Jadwal's top bar: the month, a screen away.
  "mobile.schedule.month": { id: "Lihat jadwal bulanan", en: "See the monthly schedule" },
  // Jadwal's ⋮: the reminder before each class (the engine's "Kuliah sebentar lagi"), with how long before. The label fits
  // on one line beside its switch in the menu's 280 dp (the judge's round 2, pass 6).
  "mobile.schedule.remind": { id: "Pengingat kuliah", en: "Class reminders" },
  "mobile.schedule.remind.hint": { id: "15 menit sebelumnya", en: "15 minutes before" },
  "mobile.schedule.remind.on": { id: "Pengingat menyala, 15 menit sebelum tiap kuliah.", en: "Reminders on, 15 minutes before each class." },
  "mobile.schedule.remind.off": { id: "Pengingat kuliah dimatikan.", en: "Class reminders are off." },
  // superapp: Jadwal
  // superapp: Jadwal, round 3: a changed class says what changed, with the times Notifikasi shows for the same change.
  "mobile.schedule.changed.end": { id: "Selesai {time} (tadinya {old})", en: "Ends {time} (was {old})" },
  "mobile.schedule.changed.start": { id: "Mulai {time} (tadinya {old})", en: "Starts {time} (was {old})" },
  "mobile.schedule.changed.time": { id: "{time} (tadinya {old})", en: "{time} (was {old})" },
  "mobile.schedule.changed.room": { id: "Pindah ke {room} (tadinya {old})", en: "Moved to {room} (was {old})" },
  // Jadwal's top bar: the month view, by its name in the decisions.
  "mobile.schedule.monthly": { id: "Jadwal bulanan", en: "Monthly schedule" },
  // Jadwal's day strip, for TalkBack: how many classes a day holds (the number under its date).
  "mobile.schedule.dayCount": { id: "{count} kuliah", en: { one: "{count} class", other: "{count} classes" } },
  // Jadwal's ⋮: the phone's calendar kept the same as Jadwal, in a calendar of the app's own (W13). Label and hint each
  // on one line in the menu; the calendar's name is in the toast and the off toast.
  "mobile.calendar.sync": { id: "Kalender HP", en: "Phone calendar" },
  "mobile.calendar.sync.hint": { id: "Selalu sama dengan Jadwal", en: "Matches your schedule" },
  // The snackbar once it's on: one line (the ⋮ row's hint already says it stays up to date).
  "mobile.calendar.sync.on": {
    id: "{count} acara masuk Kalender HP",
    en: { one: "{count} event in your phone calendar", other: "{count} events in your phone calendar" },
  },
  "mobile.calendar.sync.off": { id: "Kalender Edunex Plus dihapus dari HP.", en: "The Edunex Plus calendar is off your phone." },
  "mobile.calendar.sync.failed": { id: "Kalender HP belum bisa diperbarui", en: "Couldn't update your phone's calendar" },
  "mobile.calendar.sync.failedHint": {
    id: "Jadwal di sini tetap terbaru. Coba lagi sebentar lagi.",
    en: "Your schedule here is up to date. Try again in a moment.",
  },
  // "Tambahkan ke kalender HP" on the phone (S8): the events go into the phone's own calendar, in one called Edunex Plus.
  "mobile.calendar.lead": {
    id: "Kuliah, ujian dan tenggatmu masuk ke kalender HP, di kalender bernama Edunex Plus.",
    en: "Your classes, exams and deadlines go into your phone's calendar, in one called Edunex Plus.",
  },
  "mobile.calendar.add": { id: "Tambahkan {count} acara", en: { one: "Add {count} event", other: "Add {count} events" } },
  "mobile.calendar.again": {
    id: "Menambahkan lagi memperbarui acaranya, tidak menggandakannya.",
    en: "Adding again updates the events instead of adding copies.",
  },
  "mobile.calendar.added": {
    id: "{count} acara ada di kalender HP",
    en: { one: "{count} event in your phone's calendar", other: "{count} events in your phone's calendar" },
  },
  // The Student said no to calendar access (or Android won't ask again): the way to allow it, or the file instead.
  "mobile.calendar.denied": { id: "Kalender HP belum diizinkan", en: "Calendar access is off" },
  "mobile.calendar.deniedHint": {
    id: "Izinkan Kalender untuk Edunex Plus di setelan HP, atau bagikan .ics ke aplikasi kalender.",
    en: "Allow Calendar for Edunex Plus in your phone's settings, or share the .ics with a calendar app.",
  },
  "mobile.calendar.settings": { id: "Buka setelan", en: "Open settings" },
  // Once the events are in: the phone's calendar app, opened on today.
  "mobile.calendar.open": { id: "Buka kalender", en: "Open calendar" },
  "mobile.calendar.openFailed": {
    id: "Aplikasi kalender tidak bisa dibuka. Acaranya ada di kalender Edunex Plus.",
    en: "Couldn't open your calendar app. The events are in the Edunex Plus calendar.",
  },
  // A date (Kalender akademik) or an exam already in the phone's calendar: the row that added it is now its state.
  // Added on its own, a tap takes it out; kept by Jadwal's "Kalender HP" switch, the row only says so.
  "mobile.calendar.in": { id: "Di kalender HP", en: "In phone calendar" },
  "mobile.calendar.in.remove": { id: "Ketuk untuk menghapusnya", en: "Tap to remove it" },
  "mobile.calendar.in.kept": { id: "Ikut Kalender HP di Jadwal", en: "Kept by Phone calendar in Schedule" },
  "mobile.calendar.removed": { id: "Dihapus dari kalender HP.", en: "Removed from your phone's calendar." },
  // Kalender akademik: the phone refused the write (access is on). The date is still one tap away.
  "mobile.calendar.addFailed": { id: "Belum masuk kalender HP. Coba lagi.", en: "Couldn't add it to your phone's calendar. Try again." },
  // The exam page's and Kalender akademik's "Tambahkan ke kalender HP": said on the page, with Buka setelan as its button.
  "mobile.exam.calendarDenied": {
    id: "Kalender HP belum diizinkan. Izinkan Kalender untuk Edunex Plus di setelan HP.",
    en: "Calendar access is off. Allow Calendar for Edunex Plus in your phone's settings.",
  },
  "mobile.calendar.failed": {
    id: "Kalender HP tidak bisa diisi. Coba lagi, atau bagikan .ics.",
    en: "Couldn't add to your phone's calendar. Try again, or share the .ics.",
  },
  // The desktop's calendar file, through the share sheet (Drive, email, another calendar app).
  "mobile.calendar.share": { id: "Bagikan .ics", en: "Share .ics" },
  "mobile.calendar.shareFailed": { id: "Berkas .ics tidak bisa dibagikan. Coba lagi.", en: "Couldn't share the .ics file. Try again." },
  // widget
  // The "Hari ini" home-screen widget on a day without classes; a tap opens Jadwal.
  "mobile.widget.todayNone": { id: "Tidak ada kuliah hari ini.", en: "No classes today." },
  // The "Ujian" widget with no exam dated in SIX or Edunex yet; a tap opens Tugas & Ujian.
  "mobile.widget.examNone": { id: "Belum ada ujian terjadwal", en: "No exams scheduled yet" },
  // "Satu mata kuliah": the page that asks which course the widget shows, as it's placed or from "Ubah widget".
  "mobile.widget.pickCourse": { id: "Pilih mata kuliah", en: "Pick a course" },
  // The same widget with no course picked and no class ahead to pick by: what's true, no how-to (the link under it says where the tap goes).
  "mobile.widget.pickCourseHint": { id: "Belum ada mata kuliah yang dipilih.", en: "No course picked yet." },
  // superapp: widgets
  // "Kelas berikutnya" in one cell on a week without classes: two words, as the cell holds no more. A tap opens Jadwal.
  "mobile.widget.noClass": { id: "Tidak ada kuliah", en: "No classes" },
  // A widget with nothing of its own to show, the same on all seven: its name, one sentence, one thing to tap.
  "mobile.widget.name.now": { id: "Sekarang", en: "Now" },
  "mobile.widget.name.exam": { id: "Ujian", en: "Exams" },
  "mobile.widget.name.next": { id: "Kelas berikutnya", en: "Next class" },
  "mobile.widget.name.course": { id: "Mata kuliah", en: "Course" },
  "mobile.widget.signedOutAny": { id: "Kamu belum masuk.", en: "You're not signed in." },
  // The same in a one-cell widget.
  "mobile.widget.signedOutShort": { id: "Belum masuk", en: "Signed out" },
  "mobile.widget.dueNone": { id: "Tidak ada tenggat", en: "Nothing due" },
  // The one thing to tap on such a widget: "Buka Jadwal".
  "mobile.widget.open": { id: "Buka {place}", en: "Open {place}" },
  // The class block's first words. A widget doesn't tick, so times of day: "Mulai 11:00", and beside "Sedang berlangsung", "selesai 10:00".
  "mobile.widget.starts": { id: "Mulai {time}", en: "Starts {time}" },
  "mobile.widget.ends": { id: "selesai {time}", en: "ends {time}" },
  // The foot when the last read didn't get through: the data stays, from when ("08:12", "kemarin, 20:16").
  "mobile.widget.offline": { id: "Tidak terhubung · data {when}", en: "Offline · data from {when}" },
  // The same where that line doesn't fit (two cells wide): still says it's offline, then from when.
  "mobile.widget.offlineMid": { id: "Tidak terhubung · {when}", en: "Offline · {when}" },
  // The same in a one-cell widget.
  "mobile.widget.offlineShort": { id: "Data {when}", en: "Data {when}" },
  // The foot while all is well: when the data was last read, small and quiet.
  "mobile.widget.updated": { id: "Diperbarui {time}", en: "Updated {time}" },
  // "Tenggat": how close a deadline is, beside its Task, up to two weeks out ("Besok" and "Hari ini" say the nearer ones).
  "mobile.widget.inDays": { id: "{count} hari", en: { one: "{count} day", other: "{count} days" } },
  // presence
  // Kuliah's ⋮: the attendance targets, with the range in force under it ("80%", "75–80%").
  "mobile.courses.targets": { id: "Target kehadiran", en: "Attendance targets" },
  // grades-plan
  // The planner's ⋯ on a course: the desktop plans a course in a semester, the phone moves it there from a sheet.
  "mobile.planner.options": { id: "Pilihan untuk {code}", en: "Options for {code}" },
  "mobile.planner.moveTo": { id: "Pindahkan ke {term}", en: "Move to {term}" },
  "mobile.planner.moved": { id: "{code} dipindah ke {term}", en: "{code} moved to {term}" },
  // Rencana's summary: the count of things to check scrolls down to the rules, which sit beside the plan on the desktop.
  "mobile.planner.toCheckHint": { id: "Ke daftar aturan di bawah", en: "Goes to the rules below" },
  // UKT › Riwayat: whose date each row shows, said once over the list (a date alone under a term read as when it was paid,
  // and the card above may go by ITB's earlier one). Each row's date with it, for TalkBack.
  "mobile.bills.historyDates": { id: "Tanggal: batas bayar di SIX", en: "Dates: last day to pay in SIX" },
  "mobile.bills.due": { id: "Batas bayar di SIX {date}", en: "Due {date} in SIX" },
  // Kalender akademik: a date goes into the phone's Edunex Plus calendar, the one Jadwal's "Kalender HP" keeps.
  "mobile.deadline.toCalendar": { id: "Tambahkan ke kalender HP", en: "Add to phone calendar" },
  // Kalender akademik, under the view switch: what a tap on a date does.
  "mobile.deadline.tapHint": { id: "Ketuk tanggal untuk menambahkannya ke kalender HP.", en: "Tap a date to add it to your phone's calendar." },
  // report
  // "Laporkan masalah" on the phone (A9): the report file goes out through the share sheet, not a folder.
  "mobile.report.nothingKept": {
    id: "Saat ini tidak ada halaman yang gagal dibaca. Laporannya berisi versi aplikasi, sistem HP-mu, dan ceritamu.",
    en: "No page is failing to read right now. The report has the app's version, your phone's system and what you write.",
  },
  "mobile.report.ready": { id: "Berkas laporan siap", en: "Report file ready" },
  "mobile.report.share": { id: "Bagikan berkas", en: "Share the file" },
  "mobile.report.shareFailed": { id: "Berkas laporan tidak bisa dibagikan. Coba lagi.", en: "Couldn't share the report file. Try again." },
  // LINE is on this phone: no QR code to scan, the ID is searched in LINE instead.
  "mobile.report.lineAddHint": {
    id: "Di LINE, buka Tambah teman, lalu cari ID {id}. Sudah berteman? Lewati langkah ini.",
    en: "In LINE, open Add friends and search for the ID {id}. Already friends? Skip this step.",
  },
  "mobile.report.copyId": { id: "Salin ID", en: "Copy ID" },
  "mobile.report.idCopied": { id: "ID {id} disalin", en: "{id} copied" },
  "mobile.report.lineSendHint": { id: "Tekan Bagikan berkas, pilih LINE, lalu pilih {id}.", en: "Tap Share the file, pick LINE, then pick {id}." },
  "mobile.report.githubAttach": { id: "Lampirkan berkasnya di kotak terakhir, lalu kirim", en: "Attach the file in the last box, then submit" },
  "mobile.report.githubAttachHint": {
    id: "Simpan dulu lewat Bagikan berkas, misalnya ke Drive atau File, supaya bisa dipilih di GitHub.",
    en: "Save it first with Share the file, to Drive or Files for example, so you can pick it on GitHub.",
  },
  // settings: Tentang › Versi. The button beside the version says only the verb (its accessible name is update.check),
  // so "Diperiksa sendiri sekali sehari." keeps its room on a phone's width.
  "mobile.update.checkShort": { id: "Periksa", en: "Check" },
  // superapp: material and exams
  // Materi (/material): the term's courses to pick from, and the picked one's modules with their material. A module's
  // mark is the course tab's own (course.thisWeek, course.latest); a new item says course.new.
  "mobile.material.title": { id: "Materi", en: "Materials" },
  // The row under a long module's first few items: it opens the rest, and says how many.
  "mobile.material.more": { id: "{count} materi lainnya", en: { one: "{count} more item", other: "{count} more items" } },
  // What a screen reader says after a course's name on its chip, for the dot: how many items came this week.
  "mobile.material.newCount": { id: "{count} materi baru", en: { one: "{count} new item", other: "{count} new items" } },
  "mobile.material.empty": { id: "Belum ada materi semester ini", en: "No materials yet this term" },
  "mobile.material.emptyHint": { id: "Yang dosenmu unggah ke Edunex muncul di sini.", en: "What your lecturers post on Edunex shows up here." },
  "mobile.material.noEdunex": { id: "Materi dibaca dari Edunex", en: "Materials come from Edunex" },
  // Ujian (/exams): every exam of the term, the nearest one first with the time left as its big figure.
  "mobile.exams.title": { id: "Ujian", en: "Exams" },
  "mobile.exams.past": { id: "Sudah lewat", en: "Past" },
  "mobile.exams.count": { id: "{count} ujian", en: { one: "{count} exam", other: "{count} exams" } },
  // A row for an exam SIX lists on two days: its first day is the row's start, the line says the other ("Kam · dan 17 Des").
  "mobile.exams.alsoOn": { id: "dan {days}", en: "and {days}" },
  "mobile.exams.empty": { id: "Belum ada ujian diumumkan", en: "No exams announced yet" },
  "mobile.exams.emptyHint": {
    id: "Ujian muncul di sini begitu SIX atau dosenmu menjadwalkannya.",
    en: "Exams show up here once SIX or a lecturer schedules them.",
  },
  "mobile.exams.noSix": { id: "Jadwal ujian dibaca dari SIX", en: "Exam times come from SIX" },
} as const satisfies Record<string, Entry>;

// The desktop's words the phone says its own way: the same facts, numbers and {placeholders}, with
// "HP ini" for "komputer ini", a page for a window, a tap for a click. translate() takes them on the
// phone only (./wording.native.ts), so the desktop's words stay as they are.
export const phoneWording: Partial<Record<StringKey, Entry>> = {
  // superapp: one name per thing (mobile/qa/superapp-names.md). The phone's tab is "Tugas" and holds the exams too; the
  // list on Beranda and its screen are "Perlu kamu urus"; the bell's history is "Notifikasi" wherever it's named; a
  // Task handed in is "Terkumpul"; a course's outline of material is "Materi", as the Materi tile and the search hint
  // call it.
  "nav.tasks": { id: "Tugas", en: "Tasks" },
  "task.backToTasks": { id: "Ke Tugas", en: "Go to Tasks" },
  "home.needs": { id: "Perlu kamu urus", en: "To handle" },
  "home.changes": { id: "Notifikasi", en: "Notifications" },
  "handIn.final": { id: "Sudah terkumpul. Hanya dosen yang bisa mengembalikannya.", en: "Submitted. Only your lecturer can hand it back." },
  // Settings › Notifikasi: the two attendance alerts, each named by what it warns about (Presensi and Kehadiran read as
  // one thing to a student): the moment to check in (a class SIX counts starts, an Edunex Presence opens or is about to
  // close), and a problem with SIX's count (a class it didn't record, no absences left).
  "settings.alerts.presence": { id: "Waktunya presensi", en: "Time to check in" },
  "settings.alerts.attendanceRisk": { id: "Masalah kehadiran", en: "Attendance problems" },
  // Settings › Akun: the row that opens what the app found when Edunex and SIX were first read, on one line (round 3's
  // third review preferred a short name to "Yang tak disampaikan Edunex dan SIX" on two); when it was found is the row's
  // spoken hint.
  // Settings › Notifikasi: the switch for a class moved, a Task edited or a meeting added, named by what changes ("Ada
  // perubahan" didn't say what).
  "settings.alerts.changes": { id: "Jadwal atau Tugas berubah", en: "Class or Task changes" },
  // Over a Kumpulkan that can't be pressed yet, in one line: the box above says why.
  "handIn.why.noText": { id: "Tulis jawabanmu dulu", en: "Write your answer first" },
  // The snackbar after "Sudah beres": what happened and when it's back, short enough for two lines beside Urungkan
  // (a snackbar's text never truncates). The same conditions as the desktop's.
  "done.toast.checked": { id: "Sudah dicek. Kembali hanya jika dosen mengubahnya lagi.", en: "Checked. Back only if your lecturer edits it again." },
  "done.toast.groupDone": { id: "Dikumpulkan kelompokmu. Kembali hanya jika tugasnya berubah.", en: "Your group handed it in. Back only if the Task changes." },
  "done.toast.handedElsewhere": { id: "Sudah dikumpulkan. Kembali hanya jika tugasnya berubah.", en: "Handed in. Back only if the Task changes." },
  "done.toast.notHandingIn": {
    id: "Tidak dikumpulkan. Kembali hanya jika tenggat atau tugasnya berubah.",
    en: "Not handing it in. Back only if the deadline or Task changes.",
  },
  "done.toast.gotIt": { id: "Sudah tahu. Kembali hanya jika target {course} berubah.", en: "Got it. Back only if {course}'s target changes." },
  "done.toast.gotItClass": { id: "Sudah tahu. Kembali sehari sebelum kuliah berikutnya.", en: "Got it. Back the day before the next class." },
  "done.toast.gotItCount": { id: "Sudah tahu. Kembali setelah SIX menghitung kuliah berikutnya.", en: "Got it. Back after SIX counts the next class." },
  "done.toast.paid": { id: "Sudah dibayar. Kembali jika tagihan berubah atau lewat batas.", en: "Paid. Back if the bill changes or passes its due date." },
  // "Perlu kamu urus"'s row for a Task changed after the hand-in: its meta line, short (what changed is on its page).
  "home.need.task.edited": { id: "Diubah dosen · cek lagi", en: "Changed · check again" },
  "home.need.task.editedCount": {
    id: "Diubah dosen · {count} perubahan",
    en: { one: "Changed · {count} change", other: "Changed · {count} changes" },
  },
  "home.need.task.editedMove": { id: "Diubah dosen · {change}", en: "Changed · {change}" },
  // The first-run summary's title, short enough for the top bar.
  "scan.heading": { id: "Ringkasan awal", en: "First summary" },
  // settings: Beranda › how far ahead its list looks. The phone's Beranda calls that list "Perlu kamu urus", not the
  // desktop's "Perlu perhatianmu", and the group's title already says it's about Beranda.
  "settings.needsAhead": { id: "Tampilkan tenggat hingga", en: "Show what's due within" },
  // settings: the test notification's body, as Android shows it.
  "alert.test.body": { id: "Ketuk untuk membuka Tugas & Ujian", en: "Tap to open Tasks & Exams" },
  // settings: Notifikasi › Coba notifikasi, once sent.
  "settings.alerts.testSent": {
    id: "Terkirim. Tidak muncul? Izinkan notifikasi Edunex Plus di pengaturan HP.",
    en: "Sent. Didn't see it? Allow Edunex Plus notifications in your phone's settings.",
  },
  // settings: Notifikasi › Presensi. Tandai Hadir is only seen by checking SIX, which a closed app doesn't: the phone reminds at
  // the start of a class SIX counts instead (mobile.alert.classStarted).
  "settings.alerts.presenceHint": {
    id: "Saat kuliah yang dihitung di SIX mulai, saat Presensi Edunex dibuka, dan 15 menit sebelum tutup jika belum tercatat. Tandai Hadir di SIX hanya dicek selama aplikasi terbuka.",
    en: "When a class SIX counts starts, when an Edunex Presence opens, and 15 minutes before it closes if you're not recorded. Tandai Hadir in SIX is checked only while the app is open.",
  },
  // A new Task's notification: the title, then its deadline, the first thing a Student wants to know.
  "alert.newTask.body": { id: "{title} · tenggat {dateId}, {time}", en: "{title} · due {dateEn}, {time}" },
  // Why Tandai Hadir hasn't shown: the phone checks SIX only while the app is open.
  "presence.row.watchingWhy": {
    id: "Selama aplikasi terbuka, SIX dicek tiap 2 menit.",
    en: "While the app is open, it checks SIX every 2 minutes.",
  },
  "presence.footer": {
    id: "Kehadiran dihitung di SIX. Tekan Tandai Hadir di SIX saat tombolnya muncul. Buka aplikasi saat kuliah agar langsung tahu.",
    en: "Attendance counts in SIX. Press Tandai Hadir in SIX when it shows. Open the app in class to hear of it right away.",
  },
  "presence.how.check": {
    id: "Setelah tiap kuliah, aplikasi mengecek apakah hitungan SIX bertambah, dan memberi tahu jika tidak. Pengecekannya saat aplikasi dibuka, dan sesekali saat tertutup.",
    en: "After each class the app checks that SIX's count went up, and tells you if it didn't. It checks when you open the app, and now and then while it's closed.",
  },
  // settings: Pengingat yang ditunda. They're kept on this phone only.
  "settings.snoozed.hint": {
    id: "Hanya di HP ini, untuk Beranda, halaman tugas, dan halaman mata kuliah. Notifikasi perubahan baru tetap muncul.",
    en: "Only on this phone, for Home, Task pages and course pages. Notifications about new changes still come.",
  },
  // settings: Keluar & hapus data, and its confirm. The phone has no phone linked to it, so it isn't in the list.
  "settings.signOutAllHint": {
    id: "Keluar dari Edunex dan SIX, lalu menghapus semua datamu dari HP ini.",
    en: "Signs out of Edunex and SIX, then removes all your data from this phone.",
  },
  "settings.signOutAllBody": {
    id: "Kamu keluar dari Edunex dan SIX, dan semua yang disimpan aplikasi di HP ini dihapus. Itu termasuk yang kamu isi sendiri, seperti rencana studi, koreksi kurikulum, bobot dan nilai mata kuliah, target kehadiran per mata kuliah, warna mata kuliah, dan pengingat yang ditunda. Ini tidak bisa dibatalkan.",
    en: "You're signed out of Edunex and SIX, and everything the app keeps on this phone is removed. That includes what you entered yourself, like your study plan, curriculum corrections, course weights and scores, each course's attendance target, course colors and snoozed reminders. You can't undo this.",
  },
  // sign-in, and the data status line: Edunex's or SIX's sign-in is a page in the app, not a window.
  "signIn.slowHint": {
    id: "Halaman masuknya terbuka lagi. Tunggu sebentar, atau tutup lalu coba lagi.",
    en: "Its sign-in page is open again. Wait a moment, or close it and try again.",
  },
  // grades-plan: under the planner. The plan is kept on this phone.
  "planner.local": {
    id: "Rencana ini tersimpan di HP ini. Aplikasi tidak pernah mengirim KRS.",
    en: "This plan stays on this phone. The app never sends a KRS.",
  },
  // grades-plan: Kurikulum's note. A course's corrections open from a tap on its row, not a ⋯ menu.
  "curriculum.unlistedNote": {
    id: "Ada {count} mata kuliah di luar catatan SIX-mu, jadi tidak dihitung sebagai sisa. Kalau prodimu bilang itu wajib untukmu, ketuk barisnya lalu pilih “Ada di kurikulumku”.",
    en: {
      one: "There's {count} course not on your SIX record, so it isn't counted as left. If your program says it's yours, tap its row and choose “In my curriculum”.",
      other:
        "There are {count} courses not on your SIX record, so they aren't counted as left. If your program says one is yours, tap its row and choose “In my curriculum”.",
    },
  },
  // tasks and schedule: a Task that is also attendance counts only while its Presence is open. No student
  // says "jendela", so the phone says when Presence is open, or "dalam waktu ini" beside a time.
  "task.note.attendanceCounted": {
    id: "Terhitung hadir. Kamu mengumpulkannya selama Presensi dibuka ({when}).",
    en: "Counted as present. You handed it in while Presence was open ({when}).",
  },
  "task.note.attendanceOutside": {
    id: "Tidak dihitung hadir karena tidak dikumpulkan selama Presensi dibuka ({when}). Tugasnya tetap terkumpul.",
    en: "Not counted as present, since it wasn't handed in while Presence was open ({when}). The Task itself is handed in.",
  },
  "task.note.attendanceMissed": {
    id: "Presensi tugas ini sudah ditutup ({when}). Kalau dikumpulkan sekarang, tugas terkumpul tapi tidak dihitung hadir.",
    en: "This Task's Presence has closed ({when}). Handed in now, it counts as handed in, not as present.",
  },
  "handIn.why.early": {
    id: "Presensi belum dibuka. Simpan draf sekarang, lalu kumpulkan {when} agar terhitung hadir.",
    en: "Presence isn't open yet. Save a draft now, then hand in {when} to be counted present.",
  },
  "handIn.check.attendanceIn": { id: "Presensi sedang dibuka, jadi terhitung hadir.", en: "Presence is open, so you'll be counted present." },
  // schedule: a hand-in Presence's details, beside its time, and its event in the phone's calendar.
  "schedule.window.only": {
    id: "Hadir tercatat hanya jika dikumpulkan dalam waktu ini.",
    en: "You're marked present only if you hand it in during this time.",
  },
  "ics.handIn.note": {
    id: "Hadir tercatat hanya jika tugasnya dikumpulkan dalam waktu ini.",
    en: "You're marked present only if you hand the Task in during this time.",
  },
  // tasks: the hand-in's buttons and the lines about handing in. The phone says "hand in" for the act
  // everywhere, as most of its lines already do. "Submitted" stays the status (Terkumpul in the Glossary).
  "handIn.submit": { id: "Kumpulkan", en: "Hand in" },
  "handIn.submitLate": { id: "Kumpulkan terlambat", en: "Hand in late" },
  "handIn.submitNow": { id: "Kumpulkan sekarang", en: "Hand in now" },
  "handIn.submitAnyway": { id: "Tetap kumpulkan (tidak dihitung hadir)", en: "Hand in anyway (not counted present)" },
  "handIn.explainer": {
    id: "Dosen bisa melihat draf yang tersimpan, tapi hanya Kumpulkan yang menyerahkannya.",
    en: "Your lecturer can see a saved draft, but only Hand in sends it.",
  },
  "handIn.confirmTitle": { id: "Kumpulkan tugas ini?", en: "Hand in this Task?" },
  "handIn.confirmBody": {
    id: "Jawabanmu dan {files} akan diserahkan ke dosen. Setelah dikumpulkan, jawabanmu final.",
    en: "Your answer and {files} go to your lecturer. Once handed in, your answer is final.",
  },
  "handIn.confirmBodyText": {
    id: "Jawabanmu akan diserahkan ke dosen. Setelah dikumpulkan, jawabanmu final.",
    en: "Your answer goes to your lecturer. Once handed in, your answer is final.",
  },
  "history.submitted": { id: "Kamu mengumpulkan", en: "You handed it in" },
  "task.note.editedAfterSubmit": {
    id: "Dosen mengubah tugas ini pada {edited}, setelah kamu mengumpulkan pada {sent}. Edunex tidak memberi tahu. Pastikan jawabanmu masih sesuai instruksi.",
    en: "Your lecturer changed this Task on {edited}, after you handed it in on {sent}. Edunex didn't tell you. Check that your answer still fits the instructions.",
  },
  "task.change.afterSubmit": {
    id: "Dosen mengubah tugas ini pada {edited}, setelah kamu mengumpulkan pada {sent}.",
    en: "Your lecturer changed this Task on {edited}, after you handed it in on {sent}.",
  },
  "task.editedAfterSubmitLine": { id: "Diubah setelah kamu kumpulkan ({date}) · cek lagi", en: "Changed after you handed it in ({date}) · check again" },
  "scan.edited.afterSubmit": { id: "{count} di antaranya setelah kamu mengumpulkan.", en: "{count} after you'd already handed it in." },
  "alert.due.body": { id: "{title} · belum dikumpulkan", en: "{title} · not handed in yet" },
  "alert.due.draft": { id: "{title} · masih draf, belum dikumpulkan", en: "{title} · still a draft, not handed in yet" },
  "settings.alerts.deadlineHint": { id: "Sebelum tenggat, hanya jika belum dikumpulkan", en: "Before the deadline, only if not handed in" },
  // attendance: the absences still allowed, on Beranda, Presensi and a course page.
  "presence.budget.safe": {
    id: "Masih boleh absen {count} kali",
    en: { one: "{count} absence left", other: "{count} absences left" },
  },
  // grades-plan: Kalender akademik, the last day of classes. "Hari ini" read as today.
  "deadline.lectureEnd": { id: "Jatah absenmu dihitung sampai hari itu.", en: "Your absences left count up to that day." },
  // grades-plan: UKT, when SIX and the ITB calendar give two deadlines for one bill.
  "bills.otherSix": {
    id: "Di SIX tertulis {date}. Bayar paling lambat tanggal yang lebih awal.",
    en: "SIX says {date}. Pay by the earlier one.",
  },
  "bills.otherItb": {
    id: "Di Kalender ITB tertulis {date}. Bayar paling lambat tanggal yang lebih awal.",
    en: "ITB's calendar says {date}. Pay by the earlier one.",
  },
  // grades-plan: KRS's state once SIX has made it official (SIX's "Pengesahan"), with or without a clash.
  "krs.stage.done": { id: "KRS sudah disahkan", en: "KRS is official" },
  "krs.stage.clash": {
    id: "KRS sudah disahkan, tapi ada {count} bentrok",
    en: { one: "KRS is official, but {count} class clashes", other: "KRS is official, but {count} classes clash" },
  },
};
