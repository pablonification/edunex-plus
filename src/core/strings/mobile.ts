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
  // The top bar of every tab: the avatar opens the account and Settings, ⋮ the screen's rarer actions.
  "mobile.account.open": { id: "Akun dan pengaturan", en: "Account and settings" },
  "mobile.menu.more": { id: "Opsi lainnya", en: "More options" },
  // Akademik: the screens behind it, as a list.
  "mobile.academic.screens": { id: "Studimu", en: "Your studies" },
  // Android's notification channels, as Settings › Notifications lists them.
  "mobile.channel.presence": { id: "Presensi dibuka dan ditutup", en: "Presence opening and closing" },
  "mobile.channel.alerts": { id: "Tugas, tenggat dan perubahan", en: "Tasks, deadlines and changes" },
  // The button Android shows on a notification about a class to mark present in: SIX's own name for it.
  "mobile.notification.checkIn": { id: "Tandai Hadir", en: "Tandai Hadir" },
  // alerts
  // At the start of a class SIX counts: with the app closed nothing reads SIX for the button, so the Student hears the class began.
  "mobile.alert.classStarted": { id: "Kuliah sudah mulai · {course}", en: "Class has started · {course}" },
  "mobile.alert.classStarted.body": {
    id: "Tekan Tandai Hadir di SIX saat tombolnya muncul · kuliah sampai {time}",
    en: "Press Tandai Hadir in SIX when it shows · class until {time}",
  },
  // welcome: one screen, what the app is in a line, three reasons, one button.
  "mobile.welcome.line": { id: "Edunex dan SIX, di satu aplikasi", en: "Edunex and SIX, in one app" },
  "mobile.welcome.reason.class": { id: "Kuliah hari ini dan Tandai Hadir", en: "Today's classes and Tandai Hadir" },
  "mobile.welcome.reason.tasks": { id: "Tugas dan tenggatnya", en: "Tasks and their deadlines" },
  "mobile.welcome.reason.attendance": { id: "Jatah absen dan nilai", en: "Absences left and grades" },
  "mobile.welcome.signIn": { id: "Masuk dengan akun ITB", en: "Sign in with your ITB account" },
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
  // A course's absences, one name for each state on every chip and pill (Beranda, Perlu kamu urus, Kuliah, an exam): none
  // left, or over the limit by how many (the desktop's Presensi bar: "habis", "lewat batas 1×"). Over the limit is the
  // desktop's "Tak bisa lagi capai 80%": Kuliah's big number and the course's sheet say that, with the target, and it's
  // what TalkBack hears. Never "Di bawah target": a course with none left can be under its target today too.
  "mobile.absence.none": { id: "Jatah habis", en: "No absences left" },
  "mobile.absence.over": { id: "Lewat batas {count}×", en: "{count} over the limit" },
  // A class row's one chip.
  "mobile.home.chip.clash": { id: "Bentrok", en: "Clash" },
  // "Perlu kamu urus"'s row for a course that can't reach its target any more: the best it can still reach, short enough
  // for one line beside its "Lewat batas" chip (the target itself is on the course's page).
  "mobile.needs.best": { id: "Maks {best}%", en: "At most {best}%" },
  // Yang berubah and Notifikasi: a moved class's or an Edunex-only meeting's one meta line, the day and its time or room,
  // short enough for one line beside the row's time (the title says what changed). The desktop's whole line, with the
  // usual time or room and "tidak ada di jadwal SIX", is what TalkBack reads; Jadwal and the class sheet show them too.
  "mobile.change.moved.time": { id: "{dateId}, {time}", en: "{dateEn}, {time}" },
  "mobile.change.moved.room": { id: "{dateId} di {room}", en: "{dateEn} in {room}" },
  "mobile.change.meeting.body": { id: "{dateId}, {time}", en: "{dateEn}, {time}" },
  // Notifikasi's and Yang berubah's meta line for a moved class: what moved, old → new, only the day, time or room that
  // changed ("08:00–09:30 → 08:00–10:00"). The whole of both is in what TalkBack reads.
  "mobile.change.moved.diff": { id: "{oldId} → {newId}", en: "{oldEn} → {newEn}" },
  // Notifikasi's title for two classes at once: both courses by name, kept apart ("A dan B" read as one course).
  "mobile.change.overlap": { id: "Bentrok · {a} × {b}", en: "Clash · {a} × {b}" },
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
  "mobile.home.free": { id: "Tak ada kuliah 7 hari ke depan", en: "No classes in the next 7 days" },
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
  "mobile.settings.notificationsOffTitle": { id: "Notifikasi mati", en: "Notifications are off" },
  "mobile.settings.notificationsOffBody": {
    id: "Pengingat tenggat, kuliah dan Presensi tidak akan muncul di HP ini.",
    en: "Reminders for deadlines, classes and Presence won't show on this phone.",
  },
  "mobile.settings.notificationsTurnOn": { id: "Nyalakan notifikasi", en: "Turn on notifications" },
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
  // Jadwal's day (v4): a day with no class, a hand-in's time ("II4091 · sebelum 23:59"), and where a class the app
  // couldn't read is.
  "mobile.schedule.noClasses": { id: "Tidak ada kuliah", en: "No classes" },
  "mobile.schedule.before": { id: "sebelum {time}", en: "by {time}" },
  "mobile.schedule.unreadMeta": { id: "Jam dan ruangnya ada di SIX", en: "Its time and room are on SIX" },
  // A day with no class: the next class, a button that goes to its day ("Berikutnya Kam 08:00"), and its whole name.
  "mobile.schedule.next": { id: "Berikutnya {when}", en: "Next {when}" },
  "mobile.schedule.nextLabel": { id: "Ke kuliah berikutnya, {when}", en: "Go to the next class, {when}" },
  // A day on the week strip with two classes at once, as TalkBack says it after the date (on screen: an amber mark).
  "mobile.schedule.clashDay": { id: "ada kuliah bentrok", en: "classes clash" },
  // Jadwal's ⋮, named for what it holds.
  "mobile.schedule.menu": { id: "Opsi jadwal", en: "Schedule options" },
  // Jadwal's top bar: the month, a screen away.
  "mobile.schedule.month": { id: "Lihat sebulan", en: "Month view" },
  // Jadwal's ⋮: the reminder before each class (the engine's "Kuliah sebentar lagi"), with how long before. The label fits
  // on one line beside its switch in the menu's 280 dp (the judge's round 2, pass 6).
  "mobile.schedule.remind": { id: "Pengingat kuliah", en: "Class reminders" },
  "mobile.schedule.remind.hint": { id: "15 menit sebelumnya", en: "15 minutes before" },
  "mobile.schedule.remind.on": { id: "Pengingat menyala, 15 menit sebelum tiap kuliah.", en: "Reminders on, 15 minutes before each class." },
  "mobile.schedule.remind.off": { id: "Pengingat kuliah dimatikan.", en: "Class reminders are off." },
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
  // The exam page's "Tambahkan ke kalender HP": said in a toast, with Buka setelan as its button.
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
  // Kalender akademik: a date opens in the phone's own calendar app, filled in, for the Student to save.
  "mobile.deadline.toCalendar": { id: "Tambahkan ke kalender HP", en: "Add to phone calendar" },
  // Kalender akademik, under the view switch: what a tap on a date does.
  "mobile.deadline.tapHint": { id: "Ketuk tanggal untuk menambahkannya ke kalender HP.", en: "Tap a date to add it to your phone's calendar." },
  "mobile.deadline.calendarFailed": {
    id: "Kalender HP tidak bisa dibuka. Pasang aplikasi kalender, lalu coba lagi.",
    en: "The phone's calendar didn't open. Install a calendar app, then try again.",
  },
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
} as const satisfies Record<string, Entry>;

// The desktop's words the phone says its own way: the same facts, numbers and {placeholders}, with
// "HP ini" for "komputer ini", a page for a window, a tap for a click. translate() takes them on the
// phone only (./wording.native.ts), so the desktop's words stay as they are.
export const phoneWording: Partial<Record<StringKey, Entry>> = {
  // Settings › Notifikasi: the two attendance alerts, each named by what it warns about (Presensi and Kehadiran read as
  // one thing to a student): the moment to check in (a class SIX counts starts, an Edunex Presence opens or is about to
  // close), and a problem with SIX's count (a class it didn't record, no absences left).
  "settings.alerts.presence": { id: "Waktunya presensi", en: "Time to check in" },
  "settings.alerts.attendanceRisk": { id: "Masalah kehadiran", en: "Attendance problems" },
  // Settings › Akun: the row that opens what the app found when Edunex and SIX were first read ("Ringkasan saat pertama
  // terhubung" didn't say what's in it).
  "settings.firstScan": { id: "Temuan saat pertama masuk", en: "Found when you first signed in" },
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
  "settings.needsAhead": { id: "Jangkauan Perlu kamu urus", en: "How far ahead to look" },
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
